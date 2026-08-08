/**
 * 视觉 / 结构回归快照（playwright 真实浏览器）
 * 运行：node scripts/visual_snapshot.cjs
 * 前提：本地服务 http://localhost:8848 运行；playwright+chromium 已装
 * 产出：
 *   - scripts/visual/<route>_<width>.png   各断点截图（人工 review 用）
 *   - scripts/visual/.baseline.json        结构签名基线（DOM 标签/类/id/data 指纹）
 * 行为：首次运行建基线；之后运行对比结构签名，结构漂移 > 阈值则标红（不自动判定像素差异，
 *       像素级差异由人工对比同路径新旧截图，或后续接 pixelmatch）。
 *
 * 覆盖断点：桌面 1280 / 平板 768 / 手机 375
 */
const { chromium } = require('/Users/hush/.workbuddy/binaries/node/workspace/node_modules/playwright')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(__dirname, 'visual')
fs.mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['home', '#home'],
  ['providers', '#providers'],
  ['provider-openai', '#provider/openai'],
  ['family-gpt5x', '#family/openai-gpt5x'],
  ['browse', '#browse'],
  ['matcher', '#matcher'],
  ['model-gpt55', '#model/openai-gpt-5-5'],
  ['glossary', '#glossary'],
]
const WIDTHS = [1280, 768, 375]
const BASELINE = path.join(OUT, '.baseline.json')
const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {}
const report = []

// 结构指纹：只取 标签+class+id+data-*，忽略文本（文本易变，结构才反映布局回归）
function fingerprint(appHtml) {
  const tags = []
  const re = /<([a-z0-9]+)([^>]*)>/gi
  let m
  while ((m = re.exec(appHtml))) {
    const tag = m[1]
    const attrs = m[2]
    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || ''
    const id = (attrs.match(/id="([^"]*)"/) || [])[1] || ''
    const data = (attrs.match(/data-[a-z-]+/gi) || []).join(',')
    tags.push(`${tag}.${cls.split(' ').sort().join('.')}#${id}{${data}}`)
  }
  return crypto.createHash('sha256').update(tags.join('|')).digest('hex').slice(0, 16)
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const [name, hash] of ROUTES) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: Math.round(w * 0.7) })
      await page.goto('http://localhost:8848/' + hash, { waitUntil: 'load' })
      await page.waitForTimeout(500) // 等数据渲染
      const file = path.join(OUT, `${name}_${w}.png`)
      await page.screenshot({ path: file, fullPage: true })
      const fp = await page.evaluate(() => {
        const app = document.querySelector('#app')
        return (app ? app.innerHTML : '')
      }).then(fingerprint)
      const key = `${name}_${w}`
      const prev = baseline[key]
      const status = !prev ? 'NEW' : (prev === fp ? 'OK' : 'DRIFT')
      report.push({ route: name, width: w, file: path.relative(ROOT, file), fingerprint: fp, status, prev })
      baseline[key] = fp
    }
  }
  await browser.close()
  fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2))

  console.log('=== 视觉/结构回归快照 ===\n')
  const drifts = report.filter((r) => r.status === 'DRIFT')
  for (const r of report) {
    console.log(`  [${r.status.padEnd(5)}] ${r.route.padEnd(16)} ${String(r.width).padStart(4)}px  ${r.file}`)
  }
  console.log(`\n截图: ${report.length} 张 → ${path.relative(ROOT, OUT)}/`)
  console.log(`结构基线: ${Object.keys(baseline).length} 条 → ${path.relative(ROOT, BASELINE)}`)
  console.log(drifts.length ? `\n⚠️ 结构漂移 ${drifts.length} 处，建议人工对比对应截图` : '\n✅ 结构与基线一致（首次运行则已建基线）')
}
main().catch((e) => { console.error(e); process.exit(1) })
