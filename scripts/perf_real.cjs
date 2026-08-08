/**
 * 真实浏览器性能实测（Core Web Vitals）
 * 运行：node scripts/perf_real.cjs
 * 前提：本地静态服务已在 http://localhost:8848 运行；playwright+chromium 已安装
 * 说明：用真实 Chromium 加载页面，采集 TTFB/FCP/LCP/CLS/Load 与传输体积（含 gzip）。
 */
const { chromium } = require('/Users/hush/.workbuddy/binaries/node/workspace/node_modules/playwright')
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))

  // 在页面加载前挂观察器，确保捕获 SPA 的 LCP/CLS（load 之后观测会丢失 entry）
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType === 'largest-contentful-paint') window.__lcp = e.startTime
          if (e.entryType === 'layout-shift' && !e.hadRecentInput) window.__cls += e.value
        }
      }).observe({ entryTypes: ['largest-contentful-paint', 'layout-shift'] })
    } catch (e) { /* 旧浏览器忽略 */ }
  })

  const t0 = Date.now()
  await page.goto('http://localhost:8848/', { waitUntil: 'load' })
  const loadMs = Date.now() - t0
  await page.waitForTimeout(800) // 让 LCP/CLS 稳定

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const paint = performance.getEntriesByType('paint')
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime
    return {
      ttfb: nav.responseStart, domContentLoaded: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd, fcp,
    }
  })
  const cwv = await page.evaluate(() => ({ lcp: window.__lcp || 0, cls: window.__cls || 0 }))
  const sizes = await page.evaluate(() => {
    let total = 0; const byType = {}
    for (const e of performance.getEntriesByType('resource')) {
      total += e.transferSize || 0
      const t = (e.name.split('.').pop() || '?').split('?')[0]
      byType[t] = (byType[t] || 0) + (e.transferSize || 0)
    }
    return { total, byType }
  })

  console.log('=== 真实浏览器性能（Core Web Vitals, 1280×900）===\n')
  console.log(`TTFB : ${metrics.ttfb.toFixed(0)} ms`)
  console.log(`FCP  : ${(metrics.fcp || 0).toFixed(0)} ms`)
  console.log(`LCP  : ${cwv.lcp.toFixed(0)} ms`)
  console.log(`DOMContentLoaded: ${metrics.domContentLoaded.toFixed(0)} ms`)
  console.log(`Load : ${metrics.load.toFixed(0)} ms`)
  console.log(`CLS  : ${cwv.cls.toFixed(3)}`)
  console.log(`传输体积(transferSize, 含 gzip): ${(sizes.total / 1024).toFixed(0)} KB`)
  console.log('资源类型字节:', JSON.stringify(Object.fromEntries(Object.entries(sizes.byType).map(([k, v]) => [k, (v / 1024).toFixed(0) + 'KB'])), null, 0))
  console.log('控制台错误:', errors.length ? errors.join(' | ') : '无')

  const grade = (lcp) => (lcp < 2500 ? '良好' : lcp < 4000 ? '需改进' : '差')
  console.log(`\nLCP 评级: ${grade(cwv.lcp)}（优秀 <2500ms）`)

  const out = `# 真实浏览器性能报告（Core Web Vitals）\n\n生成: ${new Date().toISOString()}\n视口: 1280×900\n\n` +
    `| 指标 | 值 | 评级 |\n|---|---|---|\n| TTFB | ${metrics.ttfb.toFixed(0)} ms | - |\n| FCP | ${(metrics.fcp || 0).toFixed(0)} ms | - |\n| LCP | ${cwv.lcp.toFixed(0)} ms | ${grade(cwv.lcp)} |\n| CLS | ${cwv.cls.toFixed(3)} | ${cwv.cls < 0.1 ? '良好' : '需改进'} |\n| Load | ${metrics.load.toFixed(0)} ms | - |\n| 传输体积 | ${(sizes.total / 1024).toFixed(0)} KB | 含 gzip |\n| 控制台错误 | ${errors.length} | ${errors.length ? errors.join('; ') : '无'} |\n`
  fs.writeFileSync(path.join(ROOT, 'PERF_REAL_REPORT.md'), out)
  console.log('\n报告已写入 PERF_REAL_REPORT.md')
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
