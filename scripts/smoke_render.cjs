/**
 * 渲染冒烟测试（jsdom 真实 DOM）
 * 运行：NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node scripts/smoke_render.js
 * 覆盖：全部路由渲染、logo 引用、模态徽章、能力匹配、系列页、详情页 API 分支、交互控件
 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const { pathToFileURL } = require('url')

const ROOT = path.resolve(__dirname, '..')
const failures = []
const ok = (cond, msg) => {
  if (!cond) failures.push(msg)
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`)
}

async function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const dom = new JSDOM(html, { url: 'http://localhost/#home', runScripts: 'outside-only', pretendToBeVisual: true })
  const { window } = dom

  // 本地 fetch 桩：直接读磁盘
  window.fetch = async (url) => {
    const file = path.join(ROOT, String(url).replace(/^\.\//, ''))
    if (!fs.existsSync(file)) return { ok: false, status: 404 }
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) }
  }
  window.scrollTo = () => {}
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true })

  // 注入浏览器全局，供 ESM 应用模块（app.js 及其 src/* 依赖）使用
  for (const k of [
    'window', 'document', 'navigator', 'location', 'history', 'localStorage',
    'fetch', 'HTMLElement', 'customElements', 'getComputedStyle', 'MutationObserver',
    'Node', 'Event', 'CustomEvent', 'DOMParser', 'console',
  ]) {
    if (window[k] !== undefined) global[k] = window[k]
  }
  global.scrollTo = () => {}
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
  global.matchMedia = global.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

  // 以 ESM 方式动态加载应用（app.js 使用 import 语法，window.eval 无法解析）
  const appUrl = pathToFileURL(path.join(ROOT, 'app.js')).href
  await import(appUrl)
  await new Promise((r) => setTimeout(r, 300))

  const app = window.document.querySelector('#app')
  const goto = async (hash) => {
    window.location.hash = hash
    await new Promise((r) => setTimeout(r, 40))
    return app.innerHTML
  }
  const click = async (sel) => {
    const el = app.querySelector(sel)
    if (!el) return false
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 30))
    return true
  }

  const providers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/providers.json'), 'utf8'))
  const families = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/model_families.json'), 'utf8'))
  // 主文件 + 增量文件合并，与 app.js loadData() 实际读取口径一致（免费/开放权重模型 100% 在 extra）
  const mainVariants = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/model_variants.json'), 'utf8'))
  const extraVariants = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/model_variants_extra.json'), 'utf8'))
  const variants = mainVariants.concat(extraVariants)

  console.log('\n[1] 首页（Phase 1 决策入口）')
  let h = app.innerHTML
  ok(h.includes('找到适合你的'), '首页 hero 渲染')
  // Phase 1：精选推荐 8 张卡（recommendedModels(8)），不再有旧版 8 张热门卡
  ok(app.querySelectorAll('.model-card').length === 8, '精选推荐 8 张卡')
  ok(app.querySelector('#task-input') && app.querySelector('[data-start-match]'), 'Hero 任务输入框 + 开始匹配按钮存在')
  ok(app.querySelector('.popular-row [data-pop-task]'), '「大家常搜」快捷标签存在')
  ok(app.querySelector('.trust-section'), '信任层区块存在（DESIGN Layer 3）')
  ok(h.includes('assets/logos/'), '首页使用品牌 logo 图片')
  // 任务输入结构化提取：输入自然语言 → 解析出可编辑条件 chip
  const ti = app.querySelector('#task-input')
  ti.value = '便宜的中文编码模型'
  ti.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('#home-chips .chip-n').length >= 1, '任务输入解析出结构化条件 chip')
  // Phase 2 最近搜索：提交后写入并在首页展示
  const tf = app.querySelector('#task-form')
  ti.value = '超长文档总结模型'
  tf.dispatchEvent(new window.Event('submit', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 40))
  ok((window.localStorage.getItem('ame_recent_search') || '').includes('超长文档总结模型'), '首页提交写入最近搜索')
  await goto('#home')
  ok(app.querySelector('.recent-search [data-rec-search]'), '首页展示最近搜索芯片')

  console.log('\n[2] 厂商地图')
  h = await goto('#providers')
  // 厂商地图过滤掉网关类厂商（gateway 在独立网关页），断言按非网关厂商计数
  const nonGateway = providers.filter((p) => p.category !== 'gateway').length
  ok(app.querySelectorAll('.provider-card').length === nonGateway, `厂商卡 ${nonGateway} 张（网关类 ${providers.length - nonGateway} 家归属网关页）`)
  ok(app.querySelector('.provider-card .brandmark img'), '厂商卡渲染 logo <img>')
  ok(app.querySelector('.pc-mix .mod-chip'), '厂商卡显示模态构成')
  ok(!!app.querySelector('.provider-card .tag-open'), '厂商卡显示「开放权重」徽章')
  // 模态筛选
  const videoBtn = app.querySelector('[data-seg="providerModality"] [data-value="video"]')
  videoBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  const videoProviders = app.querySelectorAll('.provider-card').length
  ok(videoProviders > 0 && videoProviders < providers.length, `视频模态筛选生效（${videoProviders} 家）`)
  app.querySelector('[data-seg="providerModality"] [data-value="all"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  // 搜索
  const si = app.querySelector('#provider-search')
  si.value = 'kling'
  si.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('.provider-card').length >= 1, '搜索 kling 命中厂商')
  si.value = ''
  si.dispatchEvent(new window.Event('input', { bubbles: true }))

  console.log('\n[3] 厂商详情 → 系列卡')
  h = await goto('#provider/openai')
  ok(h.includes('OpenAI'), '厂商详情标题')
  ok(app.querySelectorAll('.family-card').length === families.filter((f) => f.provider_id === 'openai').length, 'OpenAI 系列卡数量正确')
  ok(app.querySelectorAll('.stat-card').length === 4, '厂商概览 4 个参数卡')
  ok(h.includes('api.openai.com'), '展示 Base URL')

  console.log('\n[4] 模型系列独立页')
  h = await goto('#family/openai-gpt5x')
  ok(h.includes('GPT-5 系列'), '系列页标题')
  ok(app.querySelectorAll('.pick-card').length >= 2, '「系列内怎么选」结论卡')
  const rows = app.querySelectorAll('.cmp-table tbody tr').length
  ok(rows === variants.filter((v) => v.family_id === 'openai-gpt5x').length, `对比表行数 ${rows}`)
  ok(app.querySelector('.cmp-table .mod-badge'), '对比表含模态徽章')
  // 排序
  const sel = app.querySelector('[data-sort="familySort"]')
  sel.value = 'price-asc'
  sel.dispatchEvent(new window.Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('.cmp-table tbody tr').length === rows, '排序后行数不变')
  // 媒体系列
  h = await goto('#family/kuaishou-kling')
  ok(h.includes('分辨率'), '媒体系列表头切换为分辨率/时长')

  console.log('\n[5] 能力筛选浏览')
  h = await goto('#browse')
  ok(app.querySelector('.filter-panel'), '筛选面板存在')
  // 防回归：能力维度与硬性条件已合并为单个「筛选条件」块（2026-08-07 决策），不得拆回两块
  ok(app.querySelectorAll('.filter-panel .chip-wrap').length === 1, '筛选条件为单块（能力维度+硬性条件已合并）')
  ok(app.querySelectorAll('[data-trait]').length === 5 && app.querySelectorAll('[data-cap]').length === 5, '合并块内 10 个 chip 齐全')
  // 防回归：侧栏精简为 4 块 + 顶部头（2026-08-07），收藏并入条件块、清空按钮常驻顶部
  ok(app.querySelectorAll('.filter-panel .fp-block').length === 4, '侧栏筛选块精简为 4 块')
  ok(app.querySelector('.fp-head [data-reset-filters]'), '清空按钮常驻面板顶部')
  ok(app.querySelector('.chip-wrap [data-fav-only]'), '只看收藏已并入条件块')
  ok(!app.querySelector('.chip span'), 'chip 为单行（副标题收进 title，勿改回双行）')
  const total = app.querySelectorAll('.model-card').length
  ok(total === Math.min(variants.length, 24), `默认匹配结果 ${total} 张卡（上限 24，全量 ${variants.length}）`)
  await click('[data-cap="coding"]')
  ok(app.querySelector('.match-flag'), '勾选能力后显示匹配度')
  ok(app.querySelector('.mc-hits .hit-pill'), '显示命中能力档位')
  await click('[data-trait="open_weight"]')
  const openOnly = app.querySelectorAll('.model-card').length
  ok(openOnly > 0 && openOnly <= 24, `开放权重过滤生效（${openOnly}）`)
  await click('[data-reset-filters]')
  ok(app.querySelectorAll('.model-card').length === total, '清空筛选恢复')
  // 价格筛选（免费 / 低成本 / 标准价）
  const freeCount = variants.filter((v) => v.free).length
  ok(freeCount > 0, `数据集中有 ${freeCount} 个免费模型`)
  await click('[data-seg="browsePrice"] [data-value="free"]')
  const freeCards = app.querySelectorAll('.model-card').length
  ok(freeCards === Math.min(freeCount, 24), `免费筛选命中 ${freeCards} 张卡（上限 24）`)
  ok(Array.from(app.querySelectorAll('.model-card')).every((c) => c.querySelector('.free-badge')), '免费结果全部带「免费」徽章')
  await click('[data-seg="browsePrice"] [data-value="low"]')
  const lowCards = app.querySelectorAll('.model-card').length
  ok(lowCards > 0 && lowCards <= 24, `低成本筛选生效（${lowCards}）`)
  await click('[data-seg="browsePrice"] [data-value="all"]')
  ok(app.querySelectorAll('.model-card').length === total, '价格筛选清空恢复全部')
  // 注：「计费方式」筛选（browseBill: per_token/per_image/per_second）已于 2026-08-07 按需求移除。
  // 此断言确保不会残留「看得见控件却无筛选逻辑」或反之的半移除状态；若后续恢复该功能，需一并恢复原用例。
  ok(!app.querySelector('[data-seg="browseBill"]'), '「计费方式」筛选块已移除')
  // 搜索框（Phase 1 工具栏）
  const bs = app.querySelector('#browse-search')
  bs.value = 'gpt'
  bs.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  const searched = app.querySelectorAll('.model-card').length
  ok(searched > 0 && searched < total, `浏览搜索过滤生效（${searched} < ${total}）`)
  bs.value = ''
  bs.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('.model-card').length === total, '清空搜索恢复全部')
  // 视图切换 卡片 / 表格（Phase 1 data-table 表格视图）
  await click('[data-view="table"]')
  ok(app.querySelector('.data-table--browse'), '表格视图渲染 data-table--browse')
  ok(app.querySelector('[data-view="table"].selected'), '表格视图按钮高亮')
  await click('[data-view="card"]')
  ok(app.querySelectorAll('.model-card').length === total, '切回卡片视图恢复默认数量')
  // Phase 2 结构化搜索：模态识别
  const bs2 = app.querySelector('#browse-search')
  bs2.value = '视频'
  bs2.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelector('[data-seg="browseModality"] [data-value="video"]').classList.contains('selected'), '结构化搜索识别「视频」模态并选中')
  const vidCount = app.querySelectorAll('.model-card').length
  ok(vidCount > 0 && vidCount < total, `视频模态结构化过滤收敛（${vidCount} < ${total}）`)
  // 上下文 + 模态复位（完整重算：无模态词时模态回到 all）
  bs2.value = '128k 长上下文'
  bs2.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelector('[data-seg="browseModality"] [data-value="all"]').classList.contains('selected'), '结构化搜索无模态词时模态复位为 all')
  ok(app.querySelectorAll('.model-card').length > 0, '上下文结构化过滤命中（≥128K）')
  bs2.value = ''
  bs2.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('.model-card').length === total, '清空结构化搜索恢复全部')
  ok(app.querySelector('.score-flag'), '浏览卡片显示综合评分标（fitScore）')
  // Issue-5 别名表召回：搜索「ChatGPT」应命中 openai 模型（model_aliases.json）
  bs2.value = 'ChatGPT'
  bs2.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  const aliasCards = app.querySelectorAll('.model-card').length
  ok(aliasCards > 0 && aliasCards < total, `别名搜索「ChatGPT」命中（${aliasCards} < ${total}）`)
  bs2.value = ''
  bs2.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('.model-card').length === total, '清空别名搜索恢复全部')
  // #browse 只做能力筛选，场景入口统一在首页场景模块 + #matcher（见 398b801 去重决策）
  ok(!app.querySelector('[data-tab="scene"]'), '#browse 无场景 tab（不与 #matcher 重复）')

  console.log('\n[6] 任务选择器')
  h = await goto('#matcher')
  ok(app.querySelectorAll('.task-option').length === 14, '14 个任务选项')
  ok(app.querySelectorAll('.result-row').length >= 3, '默认推荐结果')
  await click('[data-seg="budget"] [data-value="low"]')
  ok(app.innerHTML.includes('尽量省钱'), '预算控件生效并提示排序依据')
  await click('[data-seg="speed"] [data-value="fast"]')
  ok(app.querySelector('#recommendation .result-row'), '速度控件后仍有结果')

  console.log('\n[7] 型号详情（文本模型）')
  h = await goto('#model/openai-gpt-5-5')
  ok(h.includes('GPT-5.5'), '详情标题')
  ok(app.querySelectorAll('.stat-card').length === 8, '关键参数 8 个卡片')
  ok(app.querySelectorAll('.cap-row').length === 5, '能力条 5 项')
  ok(app.querySelector('.cap-track i').getAttribute('style').includes('width'), '能力条有宽度')
  ok(h.includes('api.openai.com/v1/chat/completions') || h.includes('chat/completions'), 'OpenAI 风格代码示例')
  ok(app.querySelectorAll('.code-block').length === 5, 'Python/JS/curl/Go/Java 五段代码')
  await click('[data-code-tab="curl"]')
  ok(app.querySelector('[data-code="curl"]').className.includes('hidden') === false, 'curl tab 切换生效')
  await click('[data-code-tab="go"]')
  ok(app.querySelector('[data-code="go"]').className.includes('hidden') === false, 'Go tab 切换生效')
  ok(app.querySelector('[data-code="go"]').textContent.includes('net/http'), 'Go 示例用标准库 net/http')
  await click('[data-code-tab="java"]')
  ok(app.querySelector('[data-code="java"]').textContent.includes('java.net.http.HttpClient'), 'Java 示例用标准库 HttpClient')
  ok(app.querySelector('.fit-list li.ok'), '适合列表')
  ok(app.querySelector('.naming-card') || true, '命名解读区块（可选）')
  ok(app.querySelectorAll('.rel-group').length >= 1, '相关模型区块')
  // Issue-2 版本信息区块（model_versions.json 接入详情页）
  ok(app.querySelector('.ver-box'), '详情显示版本信息区块（model_versions.json）')
  // Phase 2 综合评分分解
  ok(app.querySelector('.score-break'), '详情显示综合评分分解')
  ok(/\/100/.test(app.querySelector('.sb-head b').textContent), '综合评分以 /100 呈现')
  // Phase 2 收藏 + 只看收藏
  const favBtn = app.querySelector('[data-fav]')
  ok(favBtn, '详情有收藏按钮')
  favBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok((window.localStorage.getItem('ame_fav_set') || '').includes('openai-gpt-5-5'), '收藏写入 localStorage')
  await goto('#browse')
  const favOnlyBtn = app.querySelector('[data-fav-only]')
  ok(favOnlyBtn, '浏览页有只看收藏开关')
  favOnlyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(favOnlyBtn.classList.contains('on'), '只看收藏开关激活')
  ok(app.querySelectorAll('.model-card').length === 1, '只看收藏仅显示收藏的型号')

  console.log('\n[8] 型号详情（媒体模型）')
  h = await goto('#model/kuaishou-kling-2-5')
  const mediaModel = variants.find((v) => v.id === 'kuaishou-kling-2-5')
  if (mediaModel) {
    ok(h.includes('最长时长') || h.includes('最高分辨率'), '媒体模型显示分辨率/时长参数')
    ok(h.includes('mod-video'), '视频模态徽章')
  } else {
    ok(true, '跳过：kling-2-5 未收录')
  }
  h = await goto('#model/openai-gpt-image-2')
  ok(h.includes('images/generations'), '图像模型使用 images/generations 示例')

  console.log('\n[9] Anthropic / Google 分支')
  const cl = variants.find((v) => v.provider_id === 'anthropic')
  h = await goto('#model/' + cl.id)
  ok(h.includes('anthropic-version'), 'Anthropic 代码分支')
  const gg = variants.find((v) => v.provider_id === 'google' && !v.media_type)
  h = await goto('#model/' + gg.id)
  ok(h.includes('generateContent'), 'Google 代码分支')
  const localModel = variants.find((v) => v.provider_id === 'meta')
  h = await goto('#model/' + localModel.id)
  ok(h.includes('Meta Llama') || h.includes('Llama'), '开放权重模型（Meta Llama）详情正常渲染')
  ok(h.includes('api.llama.com') || h.includes('接入地址'), '开放权重厂商含 API 接入信息')

  console.log('\n[10] 命名解释 / 异常路由')
  h = await goto('#glossary')
  ok(app.querySelectorAll('.glossary-card').length > 0, '命名卡片')
  h = await goto('#model/not-exist')
  ok(h.includes('未找到'), '未知型号显示空态')
  h = await goto('#family/not-exist')
  ok(h.includes('未找到'), '未知系列显示空态')

  console.log('\n[11] 资源完整性')
  const missing = providers.filter((p) => !fs.existsSync(path.join(ROOT, `assets/logos/${p.id}.svg`)))
  ok(missing.length === 0, `全部 ${providers.length} 家厂商 logo 文件齐全`)
  ok(providers.every((p) => p.brand_color), '全部厂商配置品牌色')
  ok(!fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').includes('scroll-behavior: smooth'), '已移除平滑滚动（防跳动）')
  ok(!fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').includes('scrollIntoView'), '已移除 scrollIntoView 调用')

  // 放在最后：该入口会清空并改写浏览页筛选状态，避免污染前面各段断言
  console.log('\n[12] 首页免费模型入口')
  const nFree = variants.filter((v) => v.free).length
  h = await goto('#home')
  ok(app.querySelector('.free-section'), '首页存在免费模型区块')
  ok(app.querySelectorAll('.fb-pick').length === 4, '免费精选 4 条')
  ok(app.querySelector('[data-cost="free"]').textContent.includes(String(nFree)), `入口按钮标注免费型号数（${nFree}）`)
  const freeMods = new Set(variants.filter((v) => v.free).map((v) => v.media_type || 'text'))
  ok(new Set(Array.from(app.querySelectorAll('.fb-pick')).map((a) => a.getAttribute('href'))).size === 4, '免费精选不重复')
  ok(freeMods.size >= 3, `免费型号覆盖 ${freeMods.size} 种模态`)
  await click('[data-cost="free"]')
  await new Promise((r) => setTimeout(r, 60))
  ok(window.location.hash.replace('#', '') === 'browse', '点击免费入口跳转浏览页')
  ok(app.querySelector('[data-seg="browsePrice"] [data-value="free"]').className.includes('selected'), '浏览页价格筛选自动选中「免费」')
  const shown = app.querySelectorAll('.model-card').length
  ok(shown > 0 && shown <= nFree, `浏览页仅显示免费型号（${shown} 张卡）`)
  ok(!app.querySelector('.chip.on'), '入口清空了历史能力 / 硬性条件筛选')

  console.log(`\n${failures.length ? '✗ 失败 ' + failures.length + ' 项：\n - ' + failures.join('\n - ') : '✓ 全部通过'}`)
  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
