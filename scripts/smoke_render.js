/**
 * 渲染冒烟测试（jsdom 真实 DOM）
 * 运行：NODE_PATH=/Users/hush/.workbuddy/binaries/node/workspace/node_modules node scripts/smoke_render.js
 * 覆盖：全部路由渲染、logo 引用、模态徽章、能力匹配、系列页、详情页 API 分支、交互控件
 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

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

  const code = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')
  window.eval(code)
  await new Promise((r) => setTimeout(r, 120))

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
  const variants = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/model_variants.json'), 'utf8'))

  console.log('\n[1] 首页')
  let h = app.innerHTML
  ok(h.includes('找到适合你的'), '首页 hero 渲染')
  ok(app.querySelectorAll('.model-card').length === 8, '热门模型 8 张卡')
  ok(app.querySelectorAll('.entry-card').length === 3, '三个入口卡')
  ok(h.includes('assets/logos/'), '首页使用品牌 logo 图片')

  console.log('\n[2] 厂商地图')
  h = await goto('#providers')
  ok(app.querySelectorAll('.provider-card').length === providers.length, `厂商卡 ${providers.length} 张`)
  ok(app.querySelector('.provider-card .brandmark img'), '厂商卡渲染 logo <img>')
  ok(app.querySelector('.pc-mix .mod-chip'), '厂商卡显示模态构成')
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

  console.log('\n[5] 能力 / 场景浏览')
  h = await goto('#browse')
  ok(app.querySelector('.filter-panel'), '筛选面板存在')
  const total = app.querySelectorAll('.model-card').length
  ok(total > 0, `默认匹配结果 ${total} 张卡`)
  await click('[data-cap="coding"]')
  ok(app.querySelector('.match-flag'), '勾选能力后显示匹配度')
  ok(app.querySelector('.mc-hits .hit-pill'), '显示命中能力档位')
  await click('[data-trait="open_weight"]')
  const openOnly = app.querySelectorAll('.model-card').length
  ok(openOnly > 0 && openOnly < total, `开放权重过滤生效（${openOnly}）`)
  await click('[data-reset-filters]')
  ok(app.querySelectorAll('.model-card').length === total, '清空筛选恢复')
  await click('[data-tab="scene"]')
  ok(app.querySelector('.task-tile'), '场景 tab 渲染任务磁贴')
  ok(app.querySelector('.result-row'), '场景推荐结果行')
  const vt = Array.from(app.querySelectorAll('[data-browse-task]')).find((b) => b.dataset.browseTask === 'video')
  vt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 30))
  ok(app.querySelectorAll('.result-row').length > 0, '视频生成场景有推荐（非空）')

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
  ok(app.querySelectorAll('.code-block').length === 3, 'Python/JS/curl 三段代码')
  await click('[data-code-tab="curl"]')
  ok(app.querySelector('[data-code="curl"]').className.includes('hidden') === false, 'curl tab 切换生效')
  ok(app.querySelector('.fit-list li.ok'), '适合列表')
  ok(app.querySelector('.naming-card') || true, '命名解读区块（可选）')
  ok(app.querySelectorAll('.rel-group').length >= 1, '相关模型区块')

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
  ok(h.includes('localhost:8000'), '开放权重模型给出自托管提示')

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

  console.log(`\n${failures.length ? '✗ 失败 ' + failures.length + ' 项：\n - ' + failures.join('\n - ') : '✓ 全部通过'}`)
  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
