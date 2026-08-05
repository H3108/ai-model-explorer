// AI Model Explorer — Phase 2/3 渲染层
// 数据源：data/ 下规范化 JSON（providers / model_families / model_variants / tasks / recommendations / naming_guide）
// 设计原则：复用 styles.css 现有组件类，保持既有 UI 风格；能力用三档定性 + 中文依据，不编造分数。
// Phase 3：型号详情升级为独立页，支持 #model/<id> 深链路由（厂商下钻/Matcher 结果均可直达）。

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => Array.from(document.querySelectorAll(selector))

// 能力三档 → 中文标签 + 视觉档位
const TIER = {
  low: { label: '弱', level: 'weak' },
  'low-medium': { label: '较弱', level: 'weak' },
  medium: { label: '中等', level: 'mid' },
  'medium-high': { label: '较强', level: 'mid' },
  high: { label: '强', level: 'high' },
  highest: { label: '顶尖', level: 'top' },
}
// 速度档位排序（越大越快）
const SPEED_RANK = { slow: 1, fast: 2, faster: 3, fastest: 4 }

const state = {
  providers: [],
  families: [],
  variants: [],
  tasks: [],
  recommendations: [],
  naming: [],
  selectedProvider: null,
  selectedTask: null,
  budget: 'balanced',
  speed: 'balanced',
  referrer: { hash: '#home', provider: null },
  currentModelId: null,
}

async function loadData() {
  const files = ['providers', 'model_families', 'model_variants', 'tasks', 'recommendations', 'naming_guide']
  const values = await Promise.all(
    files.map((file) =>
      fetch(`./data/${file}.json`).then((response) => {
        if (!response.ok) throw new Error(`${file}.json 加载失败 (${response.status})`)
        return response.json()
      }),
    ),
  )
  ;[state.providers, state.families, state.variants, state.tasks, state.recommendations, state.naming] = values
  init()
}

// ---------- 查询辅助 ----------
const byId = (arr, key, value) => arr.find((item) => item[key] === value) || null
const variantsOfProvider = (pid) => state.variants.filter((v) => v.provider_id === pid)
const familiesOfProvider = (pid) => state.families.filter((f) => f.provider_id === pid)
const variantsOfFamily = (fid) => state.variants.filter((v) => v.family_id === fid)
const providerOf = (v) => byId(state.providers, 'id', v.provider_id) || {}
const familyOf = (v) => byId(state.families, 'id', v.family_id) || {}

// 价格展示
function priceLabel(v) {
  if (v.media_pricing && v.media_pricing.price != null) {
    const m = v.media_pricing
    const cur = m.currency === 'CNY' ? '¥' : '$'
    return `${cur}${m.price} / ${m.unit || '次'}`
  }
  if (v.input_price_per_mtok == null) return '价格未公开'
  const cur = v.currency === 'CNY' ? '¥' : '$'
  return `${cur}${v.input_price_per_mtok} / ${cur}${v.output_price_per_mtok} 每百万 tokens`
}
// 上下文 / 媒体类型
function contextLabel(v) {
  if (v.context_window == null) return v.media_type === 'video' ? '视频生成' : '图像生成'
  if (v.context_window >= 1e6) return `${v.context_window / 1e6}M`
  if (v.context_window >= 1e3) return `${Math.round(v.context_window / 1e3)}K`
  return `${v.context_window}`
}
// 能力项卡片
function capItem(dim, zh, cap) {
  const t = TIER[cap.tier] || { label: cap.tier, level: 'mid' }
  return `<div class="cap-item"><span class="cap-name">${zh} ${dim}</span><span class="cap-tier tier-${t.level}">${t.label}</span><small class="cap-basis">${cap.basis || ''}</small></div>`
}

// ---------- 统计 ----------
function renderStats() {
  $('#provider-count').textContent = state.providers.length
  $('#series-count').textContent = state.families.length
  $('#variant-count').textContent = state.variants.length
}

// ---------- 厂商列表 ----------
function providerCard(p) {
  const variants = variantsOfProvider(p.id)
  const families = familiesOfProvider(p.id)
  const regionText = p.country === 'US' ? '美国' : p.country === 'CN' ? '中国' : p.country || '其他'
  return `<article class="provider-card" data-open-provider="${p.id}">
    <div class="provider-card-head">
      <span class="provider-logo ${p.country === 'US' ? 'blue' : 'red'}">${p.logo || p.name.slice(0, 1)}</span>
      <span class="region">${regionText}</span>
      ${p.open_weight ? '<span class="open-source">开放权重</span>' : ''}
      <span class="open-source">${variants.length} 个型号</span>
    </div>
    <h3>${p.name_cn || p.name}</h3>
    <p>${p.description_cn || ''}</p>
    <div class="series-list"><strong>模型系列</strong>${families.map((f) => `<span class="series-chip">${f.name_cn || f.name}</span>`).join('')}</div>
    <button class="button small" data-open-provider="${p.id}">查看全部模型 →</button>
  </article>`
}

function renderProviders(filter = 'all') {
  const grid = $('#provider-grid')
  if (state.selectedProvider) {
    grid.classList.add('is-detail')
    grid.innerHTML = providerDetail(state.selectedProvider)
    return
  }
  grid.classList.remove('is-detail')
  const list = state.providers.filter((p) => {
    if (filter === 'all') return true
    if (filter === 'US') return p.country === 'US'
    if (filter === 'CN') return p.country === 'CN'
    if (filter === 'open') return p.open_weight === true
    return true
  })
  grid.innerHTML = list.map(providerCard).join('')
}

// ---------- 厂商详情（系列 → 型号）----------
function variantRow(v) {
  const f = familyOf(v)
  const tag = v.media_type ? `${v.media_type === 'video' ? '视频' : '图像'}` : v.speed_tier || ''
  return `<button class="series-row" data-variant="${v.id}">
    <span><b>${v.name_cn || v.name}</b><small>${f.name_cn || f.name} · ${tag} · ${contextLabel(v)}</small></span>
    <i>${priceLabel(v)} ↗</i>
  </button>`
}
function providerDetail(pid) {
  const p = byId(state.providers, 'id', pid)
  if (!p) return ''
  const families = familiesOfProvider(pid)
  const head = `<div class="provider-detail-head">
    <button class="provider-back" data-back>← 返回厂商列表</button>
    <div class="provider-card-head">
      <span class="provider-logo ${p.country === 'US' ? 'blue' : 'red'}">${p.logo || p.name.slice(0, 1)}</span>
      <h3>${p.name_cn || p.name}</h3>
      ${p.open_weight ? '<span class="open-source">开放权重</span>' : ''}
    </div>
    <p class="provider-desc">${p.description_cn || ''}</p>
    ${p.website ? `<a class="text-link" href="${p.website}" target="_blank" rel="noopener">官网 ↗</a>` : ''}
  </div>`
  const body = families
    .map((f) => {
      const vs = variantsOfFamily(f.id)
      return `<div class="family-block">
        <div class="family-head"><h4>${f.name_cn || f.name}</h4><small>${f.description_cn || ''}</small></div>
        ${vs.length ? vs.map(variantRow).join('') : '<p class="muted">该系列暂无收录型号。</p>'}
      </div>`
    })
    .join('')
  return head + body
}

// ---------- 型号详情（核心内容，弹窗与独立页共用）----------
function modelCoreHTML(v) {
  const p = providerOf(v)
  const f = familyOf(v)
  const caps = v.capabilities || {}
  const capGrid = [
    caps.reasoning && capItem('Reasoning', '推理', caps.reasoning),
    caps.coding && capItem('Coding', '编码', caps.coding),
    caps.agent && capItem('Agent', '智能体', caps.agent),
    caps.knowledge && capItem('Knowledge', '知识', caps.knowledge),
    caps.multilingual && capItem('Multilingual', '多语', caps.multilingual),
  ]
    .filter(Boolean)
    .join('')
  const bestFor = (v.best_for || [])
    .map((t) => {
      const task = byId(state.tasks, 'id', t)
      return `<li class="ok">✓ ${task ? task.name_cn : t}</li>`
    })
    .join('')
  const avoidFor = (v.avoid_for || [])
    .map((t) => {
      const task = byId(state.tasks, 'id', t)
      return `<li class="no">✕ ${task ? task.name_cn : t}</li>`
    })
    .join('')
  const logoCls = p.country === 'US' ? 'blue' : 'red'
  const priceHtml = v.media_pricing
    ? `媒体计费：${priceLabel(v)}（${v.media_pricing.note || ''}）`
    : `输入：${v.input_price_per_mtok == null ? '未公开' : priceLabel(v)}`
  return `<div class="detail-title">
      <span class="provider-logo ${logoCls}">${p.logo || p.name.slice(0, 1)}</span>
      <div>
        <span class="eyebrow">${p.name_cn || p.name} · ${f.name_cn || f.name}</span>
        <h2>${v.name_cn || v.name}</h2>
        <p>Model ID: ${v.model_id || v.id} · ${(v.model_type || []).join(' / ')}</p>
      </div>
    </div>
    <div class="positioning">${v.one_liner_cn || ''}</div>
    <div class="cap-section"><h4>能力评估（三档定性 · 含依据）</h4><div class="cap-grid">${capGrid}</div></div>
    <div class="detail-grid">
      <div>
        <h4>适合</h4>
        <ul class="detail-list fit-list">${bestFor || '<li class="muted">—</li>'}</ul>
        <h4>不适合</h4>
        <ul class="detail-list avoid-list">${avoidFor || '<li class="muted">—</li>'}</ul>
      </div>
      <div class="compare-box">
        <h4>规格</h4>
        <div class="api-fact"><b>上下文</b><code>${v.context_window == null ? '—（媒体模型）' : contextLabel(v) + ' tokens'}</code></div>
        <div class="api-fact"><b>最大输出</b><code>${v.max_output_tokens == null ? '—' : v.max_output_tokens + ' tokens'}</code></div>
        <div class="api-fact"><b>视觉</b><code>${v.vision_support ? '支持' : '不支持'}</code></div>
        <div class="api-fact"><b>开放权重</b><code>${v.open_weight ? '是' : '否'}</code></div>
        <div class="api-fact"><b>速度档</b><code>${v.speed_tier || '—'}</code></div>
        <h4>价格</h4>
        <p class="muted">${priceHtml}</p>
        <h4>来源</h4>
        <p class="muted">${v.source_url ? `<a class="text-link" href="${v.source_url}" target="_blank" rel="noopener">官方来源 ↗</a>` : '—'}<br>核验日期：${v.verified_date || 'unknown'}</p>
      </div>
    </div>`
}

function buildNamingBlock(v) {
  const hay = `${(v.name || '')} ${(v.name_cn || '')} ${(v.model_id || '')}`.toLowerCase()
  const hits = state.naming.filter((n) => hay.includes(n.term.toLowerCase()))
  if (!hits.length) return ''
  const cards = hits
    .map(
      (n) =>
        `<article class="naming-card"><span class="naming-term">${n.term}</span><b>${n.name_cn}</b><p>${n.description_cn}</p><small class="naming-example">例：${n.example}</small></article>`,
    )
    .join('')
  return `<div class="naming-block"><h4>型号命名解读</h4><div class="naming-grid">${cards}</div></div>`
}

function buildRelatedBlock(v) {
  const siblings = variantsOfFamily(v.family_id).filter((x) => x.id !== v.id).slice(0, 6)
  const others = variantsOfProvider(v.provider_id)
    .filter((x) => x.id !== v.id && x.family_id !== v.family_id)
    .slice(0, 4)
  const chip = (x) => `<button class="model-chip-link" data-variant="${x.id}" data-related="1">${x.name_cn || x.name}</button>`
  let html = ''
  if (siblings.length)
    html += `<div class="related-group"><h4>同系列其他型号</h4><div class="related-chips">${siblings.map(chip).join('')}</div></div>`
  if (others.length)
    html += `<div class="related-group"><h4>同厂商其他模型</h4><div class="related-chips">${others.map(chip).join('')}</div></div>`
  return html ? `<div class="related-models"><h4>相关模型</h4>${html}</div>` : ''
}

// ---------- 独立详情页（#model/<id> 路由）----------
function renderModelDetail(id) {
  state.currentModelId = id
  const page = $('#model-detail')
  const v = byId(state.variants, 'id', id)
  if (!v) {
    page.innerHTML = `<button class="detail-back" data-detail-back>← 返回</button><div class="detail-empty"><h2>未找到型号：${id}</h2><p>该型号可能已下线或未收录。</p></div>`
    $('#main-view').classList.add('hidden')
    page.classList.remove('hidden')
    window.scrollTo({ top: 0 })
    return
  }
  const back = `<button class="detail-back" data-detail-back>← 返回</button>`
  page.innerHTML = back + modelCoreHTML(v) + buildNamingBlock(v) + buildRelatedBlock(v)
  page.classList.remove('hidden')
  $('#main-view').classList.add('hidden')
  window.scrollTo({ top: 0 })
}

function applyRoute() {
  const hash = location.hash || ''
  const m = hash.match(/^#model\/(.+)$/)
  if (m) {
    renderModelDetail(decodeURIComponent(m[1]))
    return
  }
  $('#model-detail').classList.add('hidden')
  $('#main-view').classList.remove('hidden')
  const id = hash.replace(/^#/, '')
  const el = id ? document.getElementById(id) : null
  if (el && el.parentElement && el.parentElement.id === 'main-view') el.scrollIntoView({ behavior: 'smooth' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---------- Matcher（任务选择器）----------
function renderMatcher() {
  $('#task-options').innerHTML = state.tasks
    .map(
      (task, index) =>
        `<button class="task-option ${index === 0 ? 'selected' : ''}" data-task="${task.id}"><span>${task.icon || '◎'}</span><b>${task.name_cn}</b><small>${task.description_cn}</small></button>`,
    )
    .join('')
  state.selectedTask = state.tasks[0]?.id || ''
  renderRecommendation()
}

// 按预算/速度对候选做二次排序（修复原“死控件”）
function rankCandidates(ids) {
  const arr = ids
    .map((r) => ({ r, v: byId(state.variants, 'id', r.id) }))
    .filter((x) => x.v)
  const priceOf = (v) =>
    v.media_pricing && v.media_pricing.price != null
      ? v.media_pricing.price
      : ((v.input_price_per_mtok ?? 1e9) + (v.output_price_per_mtok ?? 1e9)) / 2
  const speedOf = (v) => SPEED_RANK[v.speed_tier] ?? 2
  if (state.budget === 'low') arr.sort((a, b) => priceOf(a.v) - priceOf(b.v))
  else if (state.budget === 'high' || state.speed === 'quality') arr.sort((a, b) => b.r.score - a.r.score)
  else if (state.speed === 'fast') arr.sort((a, b) => speedOf(b.v) - speedOf(a.v))
  else arr.sort((a, b) => b.r.score - a.r.score)
  return arr
}

function renderRecommendation() {
  const task = byId(state.tasks, 'id', state.selectedTask)
  const rec = state.recommendations.find((r) => r.task_id === state.selectedTask)
  const box = $('#recommendation')
  if (!task || !rec) {
    box.innerHTML = `<div class="recommendation-empty"><span>✦</span><h3>暂无该任务推荐</h3><p>数据收集中。</p></div>`
    return
  }
  const ranked = rankCandidates(rec.model_ids)
  const rows = ranked
    .map(
      (item, index) =>
        `<button class="result-row" data-variant="${item.v.id}"><span class="rank">0${index + 1}</span><span class="result-main"><b>${item.v.name_cn || item.v.name}</b><small>${providerOf(item.v).name_cn || ''} · ${familyOf(item.v).name_cn || ''}</small></span><span class="result-reason">${item.r.reason}</span><span class="arrow">→</span></button>`,
    )
    .join('')
  const hint =
    state.budget === 'low'
      ? '已按「尽量省钱」排序（价格优先）。'
      : state.speed === 'fast'
        ? '已按「速度优先」排序。'
        : state.budget === 'high' || state.speed === 'quality'
          ? '已按「质量优先」排序（官方评分）。'
          : '按官方推荐评分排序。'
  box.innerHTML = `<div class="result-head"><div><span class="eyebrow">RECOMMENDATION</span><h3>${rec.label}</h3></div><span class="match-badge">TOP ${ranked.length}</span></div>${rows}<p class="disclaimer">${hint}${rec.note ? ' · ' + rec.note : ''}</p>`
}

// ---------- Glossary ----------
function renderGlossary() {
  $('#glossary-grid').innerHTML = state.naming
    .map(
      (item) =>
        `<article class="glossary-card"><span>✦</span><div><h3>${item.term}</h3><b>${item.name_cn}</b><p>${item.description_cn}</p><small class="glossary-example">例：${item.example}</small></div></article>`,
    )
    .join('')
}

function renderRegistryNotice() {
  const node = document.createElement('p')
  node.className = 'registry-notice'
  node.textContent =
    '数据均为联网核实（2026-08-05），价格/能力以厂商官方为准；未知字段不编造。点厂商卡片可下钻查看系列与型号。'
  const sec = document.querySelector('#providers .heading')
  if (sec && !sec.nextElementSibling?.classList?.contains('registry-notice'))
    sec.insertAdjacentElement('afterend', node)
}

function init() {
  renderStats()
  renderProviders()
  renderMatcher()
  renderGlossary()
  renderRegistryNotice()
  applyRoute()
}

// ---------- 事件 ----------
document.addEventListener('click', (event) => {
  const filter = event.target.closest('[data-provider-filter]')
  if (filter) {
    $$('[data-provider-filter]').forEach((b) => b.classList.remove('active'))
    filter.classList.add('active')
    state.selectedProvider = null
    const value = { 美国: 'US', 中国: 'CN', 开源: 'open' }[filter.dataset.providerFilter] || 'all'
    renderProviders(value)
  }
  const openProvider = event.target.closest('[data-open-provider]')
  if (openProvider) {
    state.selectedProvider = openProvider.dataset.openProvider
    renderProviders()
    document.querySelector('#providers').scrollIntoView({ behavior: 'smooth' })
  }
  const back = event.target.closest('[data-back]')
  if (back) {
    state.selectedProvider = null
    renderProviders()
  }
  const task = event.target.closest('[data-task]')
  if (task) {
    $$('[data-task]').forEach((b) => b.classList.remove('selected'))
    task.classList.add('selected')
    state.selectedTask = task.dataset.task
    renderRecommendation()
  }
  const budget = event.target.closest('#budget-options [data-value]')
  if (budget) {
    $$('#budget-options [data-value]').forEach((b) => b.classList.remove('selected'))
    budget.classList.add('selected')
    state.budget = budget.dataset.value
    renderRecommendation()
  }
  const speed = event.target.closest('#speed-options [data-value]')
  if (speed) {
    $$('#speed-options [data-value]').forEach((b) => b.classList.remove('selected'))
    speed.classList.add('selected')
    state.speed = speed.dataset.value
    renderRecommendation()
  }
  const detailBack = event.target.closest('[data-detail-back]')
  if (detailBack) {
    const r = state.referrer || { hash: '#home', provider: null }
    if (r.provider) state.selectedProvider = r.provider
    location.hash = r.hash
    return
  }
  const variant = event.target.closest('[data-variant]')
  if (variant) {
    const related = variant.hasAttribute('data-related')
    state.referrer = related
      ? { hash: '#model/' + state.currentModelId, provider: state.selectedProvider }
      : { hash: state.selectedProvider ? '#providers' : '#matcher', provider: state.selectedProvider }
    location.hash = 'model/' + variant.dataset.variant
  }
})

window.addEventListener('hashchange', applyRoute)

loadData().catch((error) => {
  console.error(error)
  document.body.insertAdjacentHTML(
    'beforeend',
    '<p class="load-error">请通过本地静态服务器启动，以加载数据 JSON（例如：python3 -m http.server）。</p>',
  )
})
