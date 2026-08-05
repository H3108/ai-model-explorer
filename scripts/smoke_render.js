// 轻量 DOM 桩：在 Node 中真实执行 app.js 的渲染逻辑，捕获运行时错误与字段引用问题。
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')

// ---- 极简 Element 桩 ----
function makeEl() {
  const el = {
    _html: '',
    classList: new Set(),
    dataset: {},
    textContent: '',
    style: {},
    children: [],
    addEventListener() {},
    removeEventListener() {},
    scrollIntoView() {},
    insertAdjacentElement() {},
    insertAdjacentHTML() {},
    closest() {
      return null
    },
    querySelector() {
      return makeEl()
    },
    querySelectorAll() {
      return []
    },
    get nextElementSibling() {
      return makeEl()
    },
    parentElement: { id: 'main-view' },
    set innerHTML(v) {
      this._html = String(v)
    },
    get innerHTML() {
      return this._html
    },
  }
  el.classList.add = Set.prototype.add.bind(el.classList)
  el.classList.remove = Set.prototype.delete.bind(el.classList)
  el.classList.contains = Set.prototype.has.bind(el.classList)
  el.classList.has = Set.prototype.has.bind(el.classList)
  return el
}

const cache = new Map()
function q(sel) {
  if (!cache.has(sel)) cache.set(sel, makeEl())
  return cache.get(sel)
}

const documentStub = {
  querySelector: (sel) => q(sel),
  querySelectorAll: () => [],
  getElementById: () => {
    const el = makeEl()
    el.parentElement = { id: 'main-view' }
    return el
  },
  createElement: () => makeEl(),
  addEventListener: () => {},
  body: makeEl(),
}

// fetch 读本地文件
const fetchStub = (url) => {
  const rel = url.replace(/^\.\//, '')
  const file = path.join(ROOT, rel)
  const data = fs.readFileSync(file, 'utf8')
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => JSON.parse(data),
  })
}

const ctx = {
  document: documentStub,
  fetch: fetchStub,
  console,
  setTimeout,
  Promise,
  Array,
  Object,
  JSON,
  scrollTo: () => {},
  addEventListener: () => {},
  location: { hash: '' },
}
ctx.window = ctx
vm.createContext(ctx)

const code = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')
vm.runInContext(code, ctx, { filename: 'app.js' })

const data = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f + '.json'), 'utf8'))

// 等待 loadData().then(init()) 完成
setTimeout(() => {
  const checks = []
  const grid = q('#provider-grid')
  const taskOpts = q('#task-options')
  const rec = q('#recommendation')
  const glossary = q('#glossary-grid')
  checks.push(['#provider-count', q('#provider-count').textContent])
  checks.push(['#series-count', q('#series-count').textContent])
  checks.push(['#variant-count', q('#variant-count').textContent])
  checks.push(['provider-grid 有内容', grid._html.length > 50])
  checks.push(['task-options 有内容', taskOpts._html.includes('task-option')])
  checks.push(['recommendation 有内容', rec._html.includes('result-row')])
  checks.push(['glossary 有内容', glossary._html.includes('glossary-card')])
  console.log('=== 渲染冒烟测试（Phase 2/3）===')
  for (const [k, v] of checks) console.log(`  ${k}: ${v}`)

  let ok = true
  const fail = (m) => {
    ok = false
    console.log('  ❌ ' + m)
  }

  // Phase 3：独立详情页 + 路由
  try {
    const textId = 'openai-gpt-5-5'
    const mediaId = 'openai-gpt-image-2'
    const variants = data('model_variants')
    const core = ctx.modelCoreHTML(variants.find((v) => v.id === textId))
    console.log(
      '  modelCoreHTML(文本) 含 cap-grid:',
      core.includes('cap-grid'),
      '| 含 适合:',
      core.includes('适合'),
    )
    if (!core.includes('cap-grid')) fail('modelCoreHTML 缺少能力网格')

    ctx.renderModelDetail(textId)
    const page = q('#model-detail')._html
    console.log(
      '  renderModelDetail 含 detail-title:',
      page.includes('detail-title'),
      '| 含 命名解读:',
      page.includes('型号命名解读'),
      '| 含 相关模型:',
      page.includes('related-models'),
    )
    if (!page.includes('detail-title') || !page.includes('related-models')) fail('renderModelDetail 内容不完整')

    ctx.renderModelDetail(mediaId)
    console.log('  renderModelDetail(媒体模型) 含 媒体计费:', q('#model-detail')._html.includes('媒体计费'))

    // 路由：深链 #model/<id>
    ctx.location.hash = '#model/' + textId
    ctx.applyRoute()
    console.log(
      '  applyRoute(#model/...) 后 model-detail 可见(无 hidden):',
      !q('#model-detail').classList.has('hidden'),
    )
    if (q('#model-detail').classList.has('hidden')) fail('深链详情页应可见')

    // 路由：返回主页
    ctx.location.hash = '#providers'
    ctx.applyRoute()
    console.log(
      '  applyRoute(#providers) 后 main-view 可见:',
      !q('#main-view').classList.has('hidden'),
      '| model-detail 隐藏:',
      q('#model-detail').classList.has('hidden'),
    )
    if (q('#main-view').classList.has('hidden')) fail('返回主页后 main-view 应可见')

    // 未找到型号
    ctx.renderModelDetail('not-exist-id')
    console.log('  renderModelDetail(不存在) 含 未找到:', q('#model-detail')._html.includes('未找到'))
  } catch (e) {
    fail('详情页/路由异常: ' + e.message)
  }

  // 推荐外键校验（独立于 app.js）
  const variants = data('model_variants')
  const tasks = data('tasks')
  const recs = data('recommendations')
  const vids = new Set(variants.map((v) => v.id))
  const tids = new Set(tasks.map((t) => t.id))
  let fkBad = 0
  recs.forEach((r) => {
    if (!tids.has(r.task_id)) {
      fkBad++
      console.log('  ❌ 推荐', r.id, '的 task_id', r.task_id, '不存在')
    }
    r.model_ids.forEach((m) => {
      if (!vids.has(m.id)) {
        fkBad++
        console.log('  ❌ 推荐', r.id, '的 model_id', m.id, '不存在')
      }
    })
  })
  console.log('  推荐外键错误数:', fkBad)

  // ===== Phase 5：API 示例 / 能力标签 / 热门模型 / 参数规模 =====
  try {
    const V = (id) => variants.find((v) => v.id === id)
    ctx.renderHotModels()
    const hot = q('#hot-grid')._html
    console.log('  renderHotModels 含 hot-card:', hot.includes('hot-card'), '| 命中卡片数:', (hot.match(/hot-card/g) || []).length)
    if (!hot.includes('hot-card')) fail('renderHotModels 未渲染热门模型')

    const core = ctx.modelCoreHTML(V('openai-gpt-5-5'))
    console.log(
      '  modelCoreHTML 含 API调用信息:',
      core.includes('API 调用信息'),
      '| 含 code-block:',
      core.includes('code-block'),
      '| 含 cap-tag:',
      core.includes('cap-tag'),
      '| 含 参数规模:',
      core.includes('参数规模'),
    )
    if (!core.includes('API 调用信息') || !core.includes('code-block')) fail('详情页缺少 API 调用信息/代码块')
    if (!core.includes('cap-tag')) fail('详情页缺少能力标签 cap-tag')

    const exText = ctx.codeExamples(V('openai-gpt-5-5'))
    console.log('  codeExamples(OpenAI文本) 三语言:', !!(exText.py && exText.js && exText.curl), '| js 含 /chat/completions:', exText.js.includes('/chat/completions'))
    if (exText.note) fail('OpenAI 文本模型不应走 note 分支')

    const exAnth = ctx.codeExamples(V('anthropic-sonnet-5'))
    console.log('  codeExamples(Anthropic) js 含 /v1/messages:', exAnth.js.includes('/v1/messages'))
    if (!exAnth.py.includes('anthropic.Anthropic')) fail('Anthropic 示例未用官方 SDK')

    const exGoogle = ctx.codeExamples(V('google-gemini-3-1-pro'))
    console.log('  codeExamples(Google) 含 generateContent:', exGoogle.py.includes('generate_content'))
    if (!exGoogle.py.includes('google.generativeai')) fail('Google 示例未用官方 SDK')

    const exImg = ctx.codeExamples(V('openai-gpt-image-2'))
    console.log('  codeExamples(图像生成) js 含 /images/generations:', exImg.js.includes('/images/generations'))

    const exVeo = ctx.codeExamples(V('google-veo-3-1'))
    console.log('  codeExamples(视频生成 Veo) 含 generateContent:', exVeo.py.includes('generate_content'))

    const exKling = ctx.codeExamples(V('kuaishou-kling-3-0'))
    console.log('  codeExamples(媒体无SDK) 走 note:', !!exKling.note)
    if (!exKling.note) fail('Kling 应走文档提示分支')

    const exLocal = ctx.codeExamples(V('meta-llama-4-scout'))
    console.log('  codeExamples(本地部署) 含 localhost 提示:', exLocal.isLocal === true)
    if (!exLocal.isLocal) fail('Meta 开放权重应走 localhost 提示')

    const tags = ctx.capTagsHTML(V('openai-gpt-5-5'))
    console.log('  capTagsHTML(文本) 标签示例:', (tags.match(/cap-tag[^>]*>([^<]+)</g) || []).join(','))
    if (!tags.includes('Coding') && !tags.includes('Reasoning')) fail('能力标签未包含 Coding/Reasoning')

    const tagsCn = ctx.capTagsHTML(V('deepseek-v3'))
    console.log('  capTagsHTML(DeepSeek) 含 Chinese/Low Cost:', tagsCn.includes('Chinese'), tagsCn.includes('Low Cost'))
    if (!tagsCn.includes('Chinese')) fail('国产模型应含 Chinese 标签')
  } catch (e) {
    fail('Phase 5 渲染异常: ' + e.message)
  }

  console.log(
    ok && fkBad === 0
      ? '✅ Phase 2/3/5 全流程（列表/详情页/路由/命名/相关/API示例/能力标签/热门模型/推荐外键）验证通过。'
      : '⚠️ 存在需要修复的问题。',
  )
}, 300)
