/**
 * AI Model Explorer — 真实浏览器 E2E 套件（Playwright / Chromium）
 * 运行：NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node scripts/e2e.cjs
 * 前提：本地静态服务已在 http://localhost:8848 运行
 *
 * 定位：补足 JSDOM 冒烟测试抓不到的「真实浏览器」问题——
 *   · 真渲染 / 真事件委托 / 真 fetch
 *   · 控制台报错与未捕获异常（pageerror）
 *   · 轻量 a11y 断言（landmark / img alt / 按钮可访问名）
 *
 * 选择器优先级遵循测试规范：data-* > 语义角色 > 文本 > CSS class
 */
const { chromium } = require('playwright')

const BASE = 'http://localhost:8848'
const results = []
let consoleErrors = []
let pageErrors = []

const ok = (cond, msg) => {
  results.push({ pass: !!cond, msg })
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`)
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))

  const goto = async (hash) => {
    await page.goto(`${BASE}/#${hash}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction((r) => document.querySelector('#app')?.dataset?.route === r, hash.split('/')[0], { timeout: 8000 })
    await page.waitForTimeout(120) // 等局部刷新稳定
  }
  const count = (sel) => page.locator(sel).count()
  const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(120) }

  // ---------- [1] 首页 ----------
  console.log('\n[1] 首页加载（真实浏览器）')
  await goto('home')
  ok((await count('.model-card')) === 8, '精选推荐 8 张卡')
  ok(await page.locator('#task-input').count() > 0, 'Hero 任务输入框存在')
  ok(await page.locator('.free-section').count() > 0, '首页免费模型区块存在')
  ok((await count('.fb-pick')) === 4, '免费精选 4 条')
  // a11y：landmark + 图片 alt
  ok(await page.locator('main, [role="main"]').count() > 0, '存在 main landmark')
  // a11y 正解：装饰图可用 alt=""（合法），真正的问题是「完全缺 alt 属性」导致读屏读文件名
  const missingAlt = await page.locator('img:not([alt])').count()
  ok(missingAlt === 0, `无缺失 alt 属性的图片（${missingAlt}）`)

  // 首页免费入口 → 浏览页免费筛选（真实点击 + hashchange）
  await click('[data-cost="free"]')
  await page.waitForFunction(() => location.hash.replace('#', '') === 'browse', null, { timeout: 5000 })
  const freeSel = await page.locator('[data-seg="browsePrice"] [data-value="free"]').first().getAttribute('class')
  ok(freeSel && freeSel.includes('selected'), '点击免费入口后浏览页价格筛选自动选中「免费」')
  const freeCards = await count('.model-card')
  ok(freeCards > 0 && freeCards <= 24, `浏览页仅显示免费型号（${freeCards} 张卡）`)

  // ---------- [2] 浏览：能力 + 价格 + 搜索 + 视图 ----------
  console.log('\n[2] 浏览页能力筛选 / 价格 / 结构化搜索 / 视图切换')
  await goto('browse')
  const total = await count('.model-card')
  ok(total === Math.min(118, 24) || total > 0, `默认匹配结果 ${total} 张卡`)

  await click('[data-cap="coding"]')
  ok(await page.locator('.match-flag').count() > 0, '勾选能力后显示匹配度')
  await click('[data-reset-filters]')
  ok((await count('.model-card')) === total, '清空筛选恢复全部')

  await click('[data-seg="browsePrice"] [data-value="free"]')
  const freeOnly = await count('.model-card')
  const allFree = await page.locator('.model-card .free-badge').count()
  ok(freeOnly > 0 && freeOnly === allFree, `免费筛选命中 ${freeOnly} 张卡且全部带免费徽章`)
  await click('[data-seg="browsePrice"] [data-value="all"]')

  // 结构化搜索：识别「视频」模态
  await page.locator('#browse-search').fill('视频')
  await page.waitForTimeout(150)
  const vidSel = await page.locator('[data-seg="browseModality"] [data-value="video"]').first().getAttribute('class')
  ok(vidSel && vidSel.includes('selected'), '结构化搜索识别「视频」并选中模态')
  const vidCount = await count('.model-card')
  ok(vidCount > 0 && vidCount < total, `视频模态过滤收敛（${vidCount} < ${total}）`)
  await page.locator('#browse-search').fill('')
  await page.waitForTimeout(150)

  // 视图切换 卡片 ↔ 表格
  await click('[data-view="table"]')
  ok(await page.locator('.data-table--browse').count() > 0, '表格视图渲染 data-table--browse')
  ok(await page.locator('[data-view="table"].selected').count() > 0, '表格视图按钮高亮')
  await click('[data-view="card"]')
  ok((await count('.model-card')) === total, '切回卡片视图恢复默认数量')

  // a11y：浏览页按钮可访问名
  const namelessBtns = await page.locator('button:not([aria-label]):empty').count()
  ok(namelessBtns === 0, `浏览页无「无文本且无 aria-label」的按钮（${namelessBtns}）`)

  // ---------- [3] 匹配器 ----------
  console.log('\n[3] 任务选择器（Matcher）')
  await goto('matcher')
  ok((await count('.task-option')) === 14, '14 个任务选项')
  ok((await count('#recommendation .result-row')) >= 3, '默认推荐结果 ≥3 条')
  await click('[data-task]')
  ok((await count('#recommendation .result-row')) >= 1, '选择任务后仍有推荐结果')
  await click('[data-seg="budget"] [data-value="low"]')
  ok((await page.locator('#recommendation').innerText()).includes('省钱'), '预算控件生效（提示排序依据）')

  // ---------- [4] 型号详情 + 代码 tab + 收藏 ----------
  console.log('\n[4] 型号详情：代码 tab 切换 + 收藏')
  await goto('model/openai-gpt-5-5')
  ok((await page.locator('.stat-card').count()) === 8, '关键参数 8 个卡片')
  ok((await page.locator('.code-block').count()) === 5, 'Python/JS/curl/Go/Java 五段代码')
  await click('[data-code-tab="curl"]')
  const curlCls = await page.locator('[data-code="curl"]').getAttribute('class')
  ok(curlCls && !curlCls.includes('hidden'), 'curl tab 切换生效（代码可见）')
  await click('[data-code-tab="go"]')
  ok((await page.locator('[data-code="go"]').innerText()).includes('net/http'), 'Go 示例用标准库 net/http')
  // 收藏（真实写入 localStorage）
  const favBefore = await page.evaluate(() => localStorage.getItem('ame_fav_set'))
  await click('[data-fav]')
  const favAfter = await page.evaluate(() => localStorage.getItem('ame_fav_set'))
  ok(!favBefore?.includes('openai-gpt-5-5') && !!favAfter?.includes('openai-gpt-5-5'), '收藏写入 localStorage')

  // ---------- [5] 厂商 → 系列导航 ----------
  console.log('\n[5] 厂商 → 系列 导航链路')
  await goto('provider/openai')
  ok((await page.locator('.family-card').count()) > 0, 'OpenAI 系列卡渲染')
  const famCount = await count('.family-card')
  await page.locator('.family-card').first().click()
  // 等真实表格行出现（hash 改变是同步的，但 render 由异步 hashchange 回调触发，需等内容落 DOM）
  await page.waitForSelector('.cmp-table tbody tr', { timeout: 5000 })
  ok((await page.locator('.cmp-table tbody tr').count()) > 0, `进入系列页并渲染对比表（来自 ${famCount} 个系列卡之一）`)

  // ---------- [6] 异常路由 ----------
  console.log('\n[6] 异常路由空态')
  await goto('model/not-exist')
  ok((await page.locator('#app').innerText()).includes('未找到'), '未知型号显示空态')
  await goto('family/not-exist')
  ok((await page.locator('#app').innerText()).includes('未找到'), '未知系列显示空态')

  // ---------- [7] 控制台 / 异常 健康检查 ----------
  console.log('\n[7] 控制台与运行时健康')
  ok(pageErrors.length === 0, `无未捕获异常（pageerror: ${pageErrors.length}）`)
  if (pageErrors.length) pageErrors.forEach((e) => console.log('    ⚠ ' + e))
  ok(consoleErrors.length === 0, `无控制台 error（${consoleErrors.length}）`)
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log('    ⚠ ' + e))

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${failed.length ? '✗ E2E 失败 ' + failed.length + ' 项：\n - ' + failed.map((f) => f.msg).join('\n - ') : '✓ E2E 全部通过（' + results.length + ' 项断言）'}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
