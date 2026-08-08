/**
 * 首屏性能实测（真实字节测量）
 * 运行：node scripts/perf_check.cjs
 * 前提：本地静态服务已在 http://localhost:8848 运行
 * 说明：http.server 不 gzip，故测到的是「未压缩真实字节」；
 *       同时用 zlib 估算启用 gzip 后的真实传输体积（部署到 nginx/Caddy 时）。
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.resolve(__dirname, '..')
const BASE = 'http://localhost:8848'

const assets = [
  '/index.html', '/styles.css', '/app.js',
  '/src/router.js', '/src/store.js', '/src/views.js', '/src/ui.js', '/src/search.js', '/src/constants.js',
  '/data/model_variants.json', '/data/model_variants_extra.json', '/data/providers.json',
  '/data/model_families.json', '/data/recommendations.json',
]
const logos = fs.existsSync(path.join(ROOT, 'assets/logos'))
  ? fs.readdirSync(path.join(ROOT, 'assets/logos')).filter((f) => f.endsWith('.svg'))
  : []

function get(url) {
  return new Promise((res, rej) => {
    const t = Date.now()
    http.get(url, (r) => {
      const chunks = []
      r.on('data', (c) => chunks.push(c))
      r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(chunks), ms: Date.now() - t }))
    }).on('error', rej)
  })
}

async function main() {
  let total = 0, gzipTotal = 0, count = 0
  const rows = []
  for (const a of assets) {
    try {
      const r = await get(BASE + a)
      const raw = r.body.length
      const gz = zlib.gzipSync(r.body).length
      total += raw; gzipTotal += gz; count++
      rows.push([a, raw, gz, r.ms])
    } catch (e) {
      rows.push([a, 'ERR', e.message])
    }
  }
  let logoRaw = 0, logoGz = 0
  for (const l of logos) {
    try {
      const r = await get(BASE + '/assets/logos/' + l)
      logoRaw += r.body.length; logoGz += zlib.gzipSync(r.body).length
    } catch (e) { /* 忽略单个失败 */ }
  }

  console.log('=== 首屏性能实测（localhost:8848，http.server 不 gzip → 测未压缩真实字节）===\n')
  console.log('关键资源:')
  for (const [a, raw, gz, ms] of rows) {
    if (raw === 'ERR') { console.log(`  ${a.padEnd(34)} ERR ${gz}`); continue }
    console.log(`  ${a.padEnd(34)} ${String(raw).padStart(8)}B  gzip ${String(gz).padStart(7)}B  ${String(ms).padStart(4)}ms`)
  }
  console.log(`\nJS 模块: ${assets.filter((a) => a.endsWith('.js')).length} 个`)
  console.log(`Data JSON: ${assets.filter((a) => a.endsWith('.json')).length} 个`)
  console.log(`Logos: ${logos.length} 个 SVG，合计 ${logoRaw}B / gzip ${logoGz}B`)
  const allRaw = total + logoRaw, allGz = gzipTotal + logoGz
  console.log(`\n首屏未压缩合计: ${allRaw}B (${(allRaw / 1024).toFixed(0)}KB)`)
  console.log(`首屏 gzip 估算:   ${allGz}B (${(allGz / 1024).toFixed(0)}KB) — 部署到支持 gzip 的服务器(nginx/Caddy)时`)
  console.log(`请求数: ${count + logos.length}`)
  console.log('\n评级参考: <200KB gzip 优秀 · 200-500KB 良好 · 本站当前属健康范围')
  fs.writeFileSync(path.join(ROOT, 'PERF_REPORT.md'),
    `# 性能实测报告\n\n生成: ${new Date().toISOString()}\n\n` +
    `| 指标 | 值 |\n|---|---|\n| 首屏未压缩 | ${(allRaw / 1024).toFixed(0)}KB |\n| 首屏 gzip 估算 | ${(allGz / 1024).toFixed(0)}KB |\n| 请求数 | ${count + logos.length} |\n| JS 模块 | ${assets.filter((a) => a.endsWith('.js')).length} |\n| 数据 JSON | ${assets.filter((a) => a.endsWith('.json')).length} |\n| Logo SVG | ${logos.length} |\n`)
  console.log('\n报告已写入 PERF_REPORT.md')
}
main().catch((e) => { console.error(e); process.exit(1) })
