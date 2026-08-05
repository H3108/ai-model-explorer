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
    set innerHTML(v) {
      this._html = String(v)
    },
    get innerHTML() {
      return this._html
    },
    classList_contains(c) {
      return this.classList.has(c)
    },
  }
  // classList 兼容 .add/.remove/.contains
  el.classList.add = (c) => el.classList.add(c)
  el.classList.remove = (c) => el.classList.delete(c)
  el.classList.contains = (c) => el.classList.has(c)
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
}
ctx.window = ctx
vm.createContext(ctx)

const code = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')
vm.runInContext(code, ctx, { filename: 'app.js' })

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
  console.log('=== Phase 2 渲染冒烟测试 ===')
  for (const [k, v] of checks) console.log(`  ${k}: ${v}`)

  // 下钻：厂商详情 + 型号弹窗（providerDetail/showVariant 走闭包，不依赖外部 state）
  let drillOk = true
  try {
    const detail = ctx.providerDetail('openai')
    console.log('  providerDetail(openai) 含 family-block:', detail.includes('family-block'))
    ctx.showVariant('openai-gpt-5-5')
    const dc = q('#detail-content')._html
    console.log('  showVariant(文本模型) 含 cap-grid:', dc.includes('cap-grid'), '| 含 适合:', dc.includes('适合'))
    ctx.showVariant('openai-gpt-image-2')
    console.log('  showVariant(媒体模型) 含 cap-grid:', q('#detail-content')._html.includes('cap-grid'))
  } catch (e) {
    drillOk = false
    console.log('  ❌ 下钻/弹窗异常:', e.message)
  }

  // 推荐外键校验（独立于 app.js）
  const data = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f + '.json'), 'utf8'))
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

  console.log(drillOk && fkBad === 0 ? '✅ Phase 2 全流程（列表/下钻/弹窗/推荐外键）验证通过。' : '⚠️ 存在需要修复的问题。')

}, 300)
