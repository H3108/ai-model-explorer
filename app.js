// AI Model Explorer — V3 视图层
// 路由：#home / #providers / #provider/:id / #family/:id / #browse / #matcher / #model/:id / #glossary
// 设计原则：单一视图容器 + 局部刷新，杜绝锚点滚动跳动；能力用三档定性 + 中文依据，不编造分数。

const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s))

// ---------- 常量 ----------
const TIER = {
  low: { label: '弱', lv: 'weak', pct: 18, score: 1 },
  'low-medium': { label: '较弱', lv: 'weak', pct: 34, score: 2 },
  medium: { label: '中等', lv: 'mid', pct: 54, score: 3 },
  'medium-high': { label: '较强', lv: 'mid', pct: 72, score: 4 },
  high: { label: '强', lv: 'high', pct: 88, score: 5 },
  highest: { label: '顶尖', lv: 'top', pct: 100, score: 6 },
}
const SPEED_RANK = { slow: 1, slower: 2, moderate: 3, medium: 3, fast: 4, faster: 5, fastest: 6 }
const SPEED_CN = { slow: '较慢', slower: '偏慢', moderate: '中速', medium: '中速', fast: '快', faster: '很快', fastest: '极快' }
const API_STYLE_CN = { openai: 'OpenAI 兼容', media: '媒体接口', anthropic: 'Anthropic', google: 'Google Gemini' }
const MODALITY = {
  text: { label: '文本', short: '文本', icon: '⌘' },
  image: { label: '图像生成', short: '图像', icon: '◈' },
  video: { label: '视频生成', short: '视频', icon: '▶' },
}
const CAP_DIMS = [
  { key: 'reasoning', cn: '推理', en: 'Reasoning' },
  { key: 'coding', cn: '编码', en: 'Coding' },
  { key: 'agent', cn: '智能体', en: 'Agent' },
  { key: 'knowledge', cn: '知识', en: 'Knowledge' },
  { key: 'multilingual', cn: '多语', en: 'Multilingual' },
]
// 能力匹配器的附加硬性条件
const TRAITS = [
  { key: 'long_context', cn: '长上下文', hint: '≥ 128K tokens', test: (v) => (v.context_window || 0) >= 128000 },
  { key: 'vision', cn: '视觉输入', hint: '能看图', test: (v) => !!v.vision_support },
  { key: 'open_weight', cn: '开放权重', hint: '可本地部署', test: (v) => !!v.open_weight },
  { key: 'low_cost', cn: '低成本', hint: '输入 ≤ $1/M', test: (v) => v.input_price_per_mtok != null && v.input_price_per_mtok <= 1 },
  { key: 'fast', cn: '高速', hint: '速度档 faster 以上', test: (v) => (SPEED_RANK[v.speed_tier] || 2) >= 3 },
]

const state = {
  providers: [], families: [], variants: [], tasks: [], recommendations: [], naming: [],
  // V4 新增数据层
  gateways: [], scenarios: [], apiAccess: [],
  // 厂商列表
  providerFilter: 'all', providerModality: 'all', providerSearch: '',
  // 系列页
  familySort: 'default',
  // 浏览页
  browseModality: 'all', browseCaps: [], browseTraits: [], browseSort: 'match', browsePrice: 'all', browseBill: 'all',
  browseView: 'card', browseSearch: '', browseSearchClean: '', minContext: 0, favOnly: false,
  // 匹配器
  selectedTask: null, budget: 'balanced', speed: 'balanced',
}

// ---------- 数据 ----------
async function loadData() {
  const files = ['providers', 'model_families', 'model_variants', 'tasks', 'recommendations', 'naming_guide']
  const values = await Promise.all(
    files.map((f) =>
      fetch(`./data/${f}.json`).then((r) => {
        if (!r.ok) throw new Error(`${f}.json 加载失败 (${r.status})`)
        return r.json()
      }),
    ),
  )
  ;[state.providers, state.families, state.variants, state.tasks, state.recommendations, state.naming] = values
  // 合并增量模型（新增免费模型 / 网关模型）；加载失败不影响主站
  try {
    const extra = await fetch('./data/model_variants_extra.json').then((r) => (r.ok ? r.json() : []))
    if (Array.isArray(extra) && extra.length) state.variants = state.variants.concat(extra)
  } catch (e) {
    console.warn('增量模型加载失败：', e)
  }
  // V4 数据层（独立实体）
  try {
    const [gw, sc, api] = await Promise.all([
      fetch('./data/gateways.json').then((r) => (r.ok ? r.json() : [])),
      fetch('./data/scenarios.json').then((r) => (r.ok ? r.json() : [])),
      fetch('./data/api_access.json').then((r) => (r.ok ? r.json() : [])),
    ])
    state.gateways = Array.isArray(gw) ? gw : []
    state.scenarios = Array.isArray(sc) ? sc : []
    state.apiAccess = Array.isArray(api) ? api : []
  } catch (e) {
    console.warn('V4 数据加载失败：', e)
  }
  state.selectedTask = state.tasks[0]?.id || null
  restoreBrowseFilters()
  bindGlobalEvents()
  render()
}

// ---------- 查询 ----------
const byId = (arr, key, value) => arr.find((i) => i[key] === value) || null
const providerById = (id) => byId(state.providers, 'id', id) || {}
const familyById = (id) => byId(state.families, 'id', id) || null
const variantById = (id) => byId(state.variants, 'id', id)
const variantsOfProvider = (pid) => state.variants.filter((v) => v.provider_id === pid)
const familiesOfProvider = (pid) => state.families.filter((f) => f.provider_id === pid)
const variantsOfFamily = (fid) => state.variants.filter((v) => v.family_id === fid)
const providerOf = (v) => providerById(v.provider_id)
const familyOf = (v) => familyById(v.family_id)
const famName = (v) => { const f = familyOf(v); return f ? (f.name_cn || f.name || '') : '' }
const modalityOf = (v) => (v.media_type === 'video' ? 'video' : v.media_type === 'image' ? 'image' : 'text')

// ---------- 格式化 ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function cur(c) {
  return c === 'CNY' ? '¥' : '$'
}
function priceLabel(v) {
  if (v.free) return '免费'
  if (v.media_pricing && v.media_pricing.price != null) {
    const m = v.media_pricing
    return `${cur(m.currency)}${m.price} / ${m.unit === 'image' ? '张' : m.unit === 'second' ? '秒' : m.unit || '次'}`
  }
  if (v.input_price_per_mtok == null) return '未公开'
  return `${cur(v.currency)}${v.input_price_per_mtok} / ${cur(v.currency)}${v.output_price_per_mtok}`
}
// 对比表价格列：免费/带说明的型号后加一个可悬停或点击的信息点，展开 free_note
function priceCell(v) {
  const label = priceLabel(v)
  if (!v.free_note) return esc(label)
  const dot = `<i class="free-info" tabindex="0" role="button" aria-label="获取说明">i<span class="free-tip">${esc(v.free_note)}</span></i>`
  return `<span class="price-cell">${esc(label)}${dot}</span>`
}
function priceValue(v) {
  // 媒体计费（图像/视频）以美元计，×40 为 USD→CNY 近似换算，仅用于排序/量级比较
  if (v.media_pricing && v.media_pricing.price != null) return v.media_pricing.price * 40
  if (v.input_price_per_mtok == null) return Number.MAX_SAFE_INTEGER
  return (v.input_price_per_mtok + (v.output_price_per_mtok ?? v.input_price_per_mtok)) / 2
}
// ---------- 本地存储：最近浏览 / 对比集（跨会话持久化） ----------
const LS_RECENT = 'ame_recent_views'
const LS_COMPARE = 'ame_compare_set'
function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
function getRecent() { return lsGet(LS_RECENT, []).filter((id) => variantById(id)) }
function pushRecent(id) {
  const r = getRecent().filter((x) => x !== id)
  r.unshift(id)
  lsSet(LS_RECENT, r.slice(0, 8))
}
function getCompare() { return lsGet(LS_COMPARE, []).filter((id) => variantById(id)) }
function toggleCompare(id) {
  const c = getCompare()
  const i = c.indexOf(id)
  if (i >= 0) c.splice(i, 1); else c.push(id)
  lsSet(LS_COMPARE, c.slice(0, 6))
  return c
}
function inCompare(id) { return getCompare().includes(id) }
function updateCmpBadge() {
  const el = document.getElementById('cmp-count')
  if (!el) return
  const n = getCompare().length
  el.textContent = n
  el.hidden = n === 0
}
// ---------- Phase 2 用户偏好持久化 ----------
// 收藏集
const LS_FAV = 'ame_fav_set'
function getFav() { return lsGet(LS_FAV, []).filter((id) => variantById(id)) }
function isFav(id) { return getFav().includes(id) }
function toggleFav(id) { const f = getFav(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); lsSet(LS_FAV, f); return f }
// 最近搜索（保留最近 5 条，去重）
const LS_RECENT_SEARCH = 'ame_recent_search'
function getRecentSearch() { return lsGet(LS_RECENT_SEARCH, []) }
function pushRecentSearch(q) {
  const s = (q || '').trim()
  if (s.length < 2) return
  const arr = getRecentSearch().filter((x) => x !== s)
  arr.unshift(s)
  lsSet(LS_RECENT_SEARCH, arr.slice(0, 5))
}
function recentSearchHTML() {
  const list = getRecentSearch()
  if (!list.length) return ''
  return `<div class="recent-search"><span class="rs-label">最近搜索：</span>${list
    .map((s) => `<button type="button" class="rs-chip" data-rec-search="${esc(s)}">${esc(s)}</button>`)
    .join('')}</div>`
}
// 浏览筛选记忆（跨会话还原）
const LS_BROWSE_FILTERS = 'ame_browse_filters'
function saveBrowseFilters() {
  lsSet(LS_BROWSE_FILTERS, {
    browseModality: state.browseModality, browseCaps: state.browseCaps, browseTraits: state.browseTraits,
    browseSort: state.browseSort, browsePrice: state.browsePrice, browseBill: state.browseBill,
    browseSearch: state.browseSearch, browseSearchClean: state.browseSearchClean, minContext: state.minContext, favOnly: state.favOnly,
  })
}
function restoreBrowseFilters() {
  const s = lsGet(LS_BROWSE_FILTERS, null)
  if (!s) return
  if (s.browseModality) state.browseModality = s.browseModality
  if (Array.isArray(s.browseCaps)) state.browseCaps = s.browseCaps
  if (Array.isArray(s.browseTraits)) state.browseTraits = s.browseTraits
  if (s.browseSort) state.browseSort = s.browseSort
  if (s.browsePrice) state.browsePrice = s.browsePrice
  if (s.browseBill) state.browseBill = s.browseBill
  if (typeof s.browseSearch === 'string') state.browseSearch = s.browseSearch
  if (typeof s.browseSearchClean === 'string') state.browseSearchClean = s.browseSearchClean
  if (typeof s.minContext === 'number') state.minContext = s.minContext
  if (typeof s.favOnly === 'boolean') state.favOnly = s.favOnly
}
function ctxShort(n) {
  if (n == null) return '—'
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}
function logoHTML(p, size = 'md') {
  const file = p.logo_file || `assets/logos/${p.id}.svg`
  return `<span class="brandmark bm-${size}" style="--brand:${esc(p.brand_color || '#173e35')}"><img src="${esc(file)}" alt="${esc(p.name || '')}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${esc((p.name || '?').slice(0, 1))}'))"></span>`
}
function catBadge(p, extraCls = '') {
  if (!p.category) return ''
  const map = { free: ['免费 API', 'cat-free'], gateway: ['托管网关', 'cat-gateway'] }
  const [label, cls] = map[p.category] || [p.category, '']
  return `<span class="cat-badge ${cls} ${extraCls}" title="${esc(p.category === 'gateway' ? '第三方托管网关：聚合多家模型，一个 API key 调用' : '可 API key 调用的真·免费模型')}">${esc(label)}</span>`
}
const apiAccessOf = (v) => state.apiAccess.find((a) => a.id === v.id) || null
const capCn = (k) => (CAP_DIMS.find((c) => c.key === k) || {}).cn || k
// V4 全文搜索匹配：模型名/中文名/别名/厂商/能力/使用场景
function variantMatches(v, q) {
  if (!q) return true
  const hay = [v.name, v.name_cn, v.model_id, v.one_liner_cn, (v.aliases || []).join(' '), capCn(v.role)]
    .filter(Boolean).join(' ').toLowerCase()
  if (hay.includes(q)) return true
  if ((v.capabilities || {}) && Object.keys(v.capabilities).some((k) => capCn(k).includes(q))) return true
  if (state.scenarios.some((s) => s.name_cn.toLowerCase().includes(q) && (s.task_ids || []).some((tid) => (v.best_for || []).includes(tid)))) return true
  return false
}
function modBadge(v, extraCls = '') {
  const m = MODALITY[modalityOf(v)]
  return `<span class="mod-badge mod-${modalityOf(v)} ${extraCls}"><i>${m.icon}</i>${m.short}</span>`
}
function modalityMix(list) {
  const c = { text: 0, image: 0, video: 0 }
  list.forEach((v) => c[modalityOf(v)]++)
  return Object.entries(c)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `<span class="mod-chip mod-${k}"><i>${MODALITY[k].icon}</i>${MODALITY[k].short} ${n}</span>`)
    .join('')
}
function capTags(v) {
  const p = providerOf(v)
  const caps = v.capabilities || {}
  const strong = (c) => c && ['high', 'highest'].includes(c.tier)
  const tags = []
  if (strong(caps.coding)) tags.push('编码')
  if (strong(caps.reasoning)) tags.push('推理')
  if (strong(caps.agent)) tags.push('智能体')
  if ((v.context_window || 0) >= 128000) tags.push('长上下文')
  if (v.vision_support || v.media_type) tags.push('多模态')
  if (p.country === 'CN') tags.push('中文优化')
  if (v.open_weight) tags.push('开放权重')
  if (v.input_price_per_mtok != null && v.input_price_per_mtok <= 1) tags.push('低成本')
  return tags
}

// ---------- 通用组件 ----------
function pageHead({ eyebrow, title, desc, back }) {
  return `<div class="page-head">
    ${back ? `<button class="back-link" data-back="${esc(back)}">← 返回</button>` : ''}
    <span class="eyebrow">${esc(eyebrow || '')}</span>
    <h1>${title}</h1>
    ${desc ? `<p class="page-desc">${desc}</p>` : ''}
  </div>`
}
function statCard(label, value, note) {
  return `<div class="stat-card"><span class="stat-label">${esc(label)}</span><b class="stat-value">${value}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`
}
function capBar(dim, cap) {
  const t = TIER[cap.tier] || { label: cap.tier, lv: 'mid', pct: 50 }
  return `<div class="cap-row">
    <div class="cap-row-head"><b>${dim.cn}<span>${dim.en}</span></b><span class="tier-pill tier-${t.lv}">${t.label}</span></div>
    <div class="cap-track"><i class="tier-${t.lv}" style="width:${t.pct}%"></i></div>
    <small>${esc(cap.basis || '')}</small>
  </div>`
}
// 模型卡（列表/网格通用）
// 数据质量评级（阈值与 scripts/governance_v1.js 的 grade() 一致：A≥90 / B≥70 / C≥50 / D<50）
const GRADE_CN = { A: '优', B: '良', C: '中', D: '待补' }
const gradeOf = (v) => { const s = v.data_quality_score || 0; return s >= 90 ? 'A' : s >= 70 ? 'B' : s >= 50 ? 'C' : 'D' }
const gradeBadge = (v) => {
  const g = gradeOf(v)
  return `<span class="grade-badge g-${g}" title="数据质量 ${v.data_quality_score || 0} 分（${GRADE_CN[g]}）">${g}</span>`
}
function modelCard(v, extra = '') {
  const p = providerOf(v)
  const f = familyOf(v)
  const free = v.free ? `<span class="free-badge" title="${esc(v.free_note || '免费可用')}">免费</span>` : ''
  const priceTxt =
    modalityOf(v) === 'text'
      ? v.free ? '免费' : `${priceLabel(v)} /M`
      : priceLabel(v)
  const meta =
    modalityOf(v) === 'text'
      ? `<span>${ctxShort(v.context_window)} 上下文</span><span>${priceTxt}</span>`
      : `<span>${esc(v.max_resolution || v.max_duration_sec ? (v.max_resolution || v.max_duration_sec + 's') : '—')}</span><span>${priceTxt}</span>`
  return `<a class="model-card" href="#model/${encodeURIComponent(v.id)}">
    <div class="mc-top">${logoHTML(p, 'sm')}${modBadge(v)}${free}${gradeBadge(v)}${extra}</div>
    <b class="mc-name">${esc(v.name_cn || v.name)}</b>
    <small class="mc-from">${esc(p.name_cn || p.name)}${famName(v) ? ' · ' + esc(famName(v)) : ''}</small>
    <p class="mc-desc">${esc(v.one_liner_cn || '')}</p>
    <div class="mc-meta">${meta}</div>
  </a>`
}
function emptyBox(text) {
  return `<div class="empty-box"><span>✦</span><p>${esc(text)}</p></div>`
}

// ---------- 首页模块：任务输入 / 精选推荐 / 信任层 ----------
// 常搜示例（点击填入输入框并触发结构化提取，作为 Task Templates 输入助手）
const HOME_POPULAR = [
  { label: '编码', sample: '我想写代码，要编码能力强的模型' },
  { label: '推理', sample: '复杂数学和逻辑推理任务' },
  { label: '长文档', sample: '处理超长文档和代码库' },
  { label: '视觉', sample: '能看懂图片做视觉分析' },
  { label: '智能体', sample: '做 Agent 规划和工具调用' },
  { label: '免费', sample: '免费的中文模型' },
  { label: '中文长上下文', sample: '中文长上下文且免费' },
]

// 首页精选推荐：质量优先、热度破平（与治理 §11 一致），取前 n
function recommendedModels(n = 6) {
  const scoreOf = {}
  state.recommendations.forEach((r) => r.model_ids.forEach((m) => (scoreOf[m.id] = (scoreOf[m.id] || 0) + m.score)))
  return Object.entries(scoreOf)
    .map(([id, heat]) => ({ v: variantById(id), heat }))
    .filter((x) => x.v && gradeOf(x.v) !== 'D') // D 级彻底降权，不进首页
    .sort((a, b) => {
      const qa = a.v.data_quality_score || 0, qb = b.v.data_quality_score || 0
      if (qb !== qa) return qb - qa
      return b.heat - a.heat
    })
    .slice(0, n)
    .map((x) => x.v)
}

function viewHome() {
  const recs = recommendedModels(6)
  return `
  <section class="hero wrap hero-single">
    <div class="hero-copy hero-center">
      <span class="eyebrow">AI 模型选型系统</span>
      <h1>找到适合你的<br><em>AI 模型。</em></h1>
      <p class="hero-lead">不需要研究几十个模型名称。描述你的任务，系统自动推荐，并解释为什么。</p>
      <form class="task-form" id="task-form" autocomplete="off">
        <div class="task-input-row">
          <input id="task-input" type="text" placeholder="描述你的需求，如「便宜的中文编码模型、长上下文、视觉…」" aria-label="描述你的需求">
          <button type="submit" class="button primary" data-start-match>开始匹配 <span>↘</span></button>
        </div>
        <div class="home-chips" id="home-chips"></div>
      </form>
      <div class="popular-row">
        <span class="popular-label">大家常搜：</span>
        ${HOME_POPULAR.map((p) => `<button type="button" class="pop-chip" data-pop-task="${esc(p.sample)}">${esc(p.label)}</button>`).join('')}
      </div>
      ${recentSearchHTML()}
      <a class="text-link hero-browse" href="#browse">或按能力浏览全部型号 →</a>
    </div>
  </section>

  <section class="section wrap">
    <div class="heading"><div><span class="eyebrow">精选推荐</span><h2>大家都在看的模型</h2></div><p>按各场景推荐评分聚合，挑出当前最受关注、数据质量最高的型号。</p></div>
    <div class="card-grid">${recs.map((v) => modelCard(v)).join('')}</div>
    <div class="section-foot"><a class="button ghost" href="#browse">查看全部 ${state.variants.length} 个型号 →</a></div>
  </section>

  ${recentModuleHTML()}
  ${trustSectionHTML()}
  `
}

// ---------- 信任层（DESIGN Layer 3）：数据透明、可核验 ----------
function trustSectionHTML() {
  const dates = state.variants.map((v) => v.verified_date).filter(Boolean).sort()
  const latest = dates.length ? dates[dates.length - 1] : '—'
  return `<section class="section wrap trust-section">
    <div class="heading"><div><span class="eyebrow">信任与数据</span><h2>数据怎么来的？</h2></div><p>透明、可核验，是我们做选型建议的底气。</p></div>
    <div class="trust-grid">
      <div class="trust-card"><h4>模型覆盖</h4><p><b>${state.variants.length}</b> 个型号 · <b>${state.providers.length}</b> 家厂商 · <b>${state.families.length}</b> 个系列</p></div>
      <div class="trust-card"><h4>价格口径</h4><p>输入 / 输出分别计价，单位美元 / 百万 Token，取自各厂商官方 API 定价页。</p></div>
      <div class="trust-card"><h4>最近核验</h4><p>自 <b>${esc(latest)}</b> 起持续更新，每个型号标注核验日期。</p></div>
      <div class="trust-card"><h4>推荐方法</h4><p>基于 任务匹配 + 能力质量 + 成本效率 + 速度 四要素；当前展示「推荐理由」而非综合分数，评分体系后续引入。</p></div>
      <div class="trust-card"><h4>数据纠错</h4><p>规格与价格来自公开官方文档。发现错误？欢迎在仓库提交 issue 反馈。</p></div>
    </div>
  </section>`
}

// ---------- 首页任务输入：结构化提取（Phase 1 V1，不做 AI 推理，仅关键词映射） ----------
let homeConditions = []
// 将自然语言需求解析为可编辑的结构化条件
// raw：命中的原文片段，用于从搜索词中剔除结构化部分，仅保留纯文本做子串匹配
function extractConditions(text) {
  const t = (text || '').toLowerCase()
  const out = []
  const push = (key, value, label, raw) => {
    if (!out.some((c) => c.key === key && c.value === value)) out.push({ key, value, label, raw: raw || '' })
  }
  const firstMatch = (re) => (t.match(re) || [''])[0]
  // 任务：取第一个命中的映射
  const taskMap = [
    [/编码|写代码|代码|coding|program/, 'coding'],
    [/推理|reasoning|数学|逻辑/, 'reasoning'],
    [/agent|智能体|工具调用|规划/, 'agent'],
    [/文档|写作|文章|长文|总结|writing/, 'writing'],
    [/长上下文|长文档|代码库|超长/, 'long_context'],
    [/视觉|看图|图像理解|vision|ocr/, 'image_understanding'],
    [/图片生成|文生图|画图/, 'image'],
    [/视频|video/, 'video'],
    [/本地|私有化|开放权重|开源/, 'local'],
    [/知识库|rag|企业/, 'knowledge'],
    [/学习|入门|答疑/, 'learning'],
    [/企业应用/, 'enterprise'],
    [/聊天|对话|问答|翻译/, 'chat'],
  ]
  for (const [re, id] of taskMap) {
    if (re.test(t)) {
      const tk = byId(state.tasks, 'id', id)
      if (tk) { push('task', id, '任务：' + tk.name_cn, firstMatch(re)); break }
    }
  }
  // 模态（结构化搜索字段，Phase 2）
  const modMap = [
    [/视频|文生视频|video/, 'video'],
    [/图像|图片|文生图|画图|image/, 'image'],
  ]
  for (const [re, id] of modMap) {
    if (re.test(t)) { push('modality', id, '模态：' + (id === 'video' ? '视频' : '图像'), firstMatch(re)); break }
  }
  // 上下文长度（结构化搜索字段，Phase 2）
  const ctxMap = [['1m', 1000000], ['100万', 1000000], ['256k', 256000], ['200k', 200000], ['128k', 128000], ['64k', 64000]]
  let ctxPushed = false
  for (const [kw, num] of ctxMap) { if (t.includes(kw)) { push('context', num, '上下文：≥' + kw.toUpperCase(), kw); ctxPushed = true; break } }
  if (!ctxPushed && /长上下文|超长|代码库|长文档/.test(t)) push('context', 128000, '上下文：≥128K', firstMatch(/长上下文|超长|代码库|长文档/))
  // 预算
  if (/免费|free|0 ?元|不花钱/.test(t)) push('budget', 'low', '预算：免费', firstMatch(/免费|free|0 ?元|不花钱/))
  else if (/便宜|廉价|低成本|高性价比|省钱|cheap|low ?cost|省/.test(t)) push('budget', 'low', '预算：尽量省钱', firstMatch(/便宜|廉价|低成本|高性价比|省钱|cheap|low ?cost|省/))
  else if (/旗舰|最好|顶级|高质量|质量优先|premium|best|quality|最强/.test(t)) push('budget', 'high', '预算：质量优先', firstMatch(/旗舰|最好|顶级|高质量|质量优先|premium|best|quality|最强/))
  // 偏好（速度 / 质量）
  if (/快|速度|实时|rapid|fast/.test(t)) push('speed', 'fast', '偏好：速度')
  else if (/质量优先|最好|最强/.test(t)) push('speed', 'quality', '偏好：质量')
  // 语言
  if (/中文|国语|汉语|chinese|中文优化/.test(t)) push('language', 'zh', '语言：中文', firstMatch(/中文|国语|汉语|chinese|中文优化/))
  // 硬性条件（映射为 browseTraits）
  if (/长上下文|长文档|超长|代码库/.test(t)) push('trait', 'long_context', '条件：长上下文')
  if (/视觉|看图|图像理解|vision/.test(t)) push('trait', 'vision', '条件：视觉输入')
  if (/本地|私有化|开放权重|开源/.test(t)) push('trait', 'open_weight', '条件：开放权重')
  return out
}
// 从原始搜索词中剔除已识别的结构化片段，仅保留纯文本做子串匹配
function cleanQuery(text, conds) {
  let q = text || ''
  conds.forEach((c) => { if (c.raw) q = q.split(c.raw).join(' ').split(c.raw.toLowerCase()).join(' ') })
  q = q.replace(/\s+/g, ' ').trim().toLowerCase()
  return q.length >= 2 ? q : ''
}
// 浏览搜索框：把自然语言解析为结构化筛选条件并应用到 state
// 每次输入完整重算（文本为空时派生筛选全部复位），保证「清空搜索」能恢复全量
function applySearchQuery(text) {
  const conds = extractConditions(text)
  const mod = conds.find((c) => c.key === 'modality')
  state.browseModality = mod ? mod.value : 'all'
  const ctx = conds.find((c) => c.key === 'context')
  state.minContext = ctx ? ctx.value : 0
  const bud = conds.find((c) => c.key === 'budget')
  state.browsePrice = bud ? (bud.label.includes('免费') ? 'free' : 'low') : 'all'
  state.browseSearchClean = cleanQuery(text, conds)
}
// 同步筛选面板分段控件高亮（state 变更后，避免面板与结果区不一致）
function syncSeg(group, val) {
  const seg = document.querySelector('[data-seg="' + group + '"]')
  if (seg) seg.querySelectorAll('button').forEach((b) => b.classList.toggle('selected', b.dataset.value === val))
}
// 渲染可编辑条件 chip
function renderHomeChips() {
  const box = document.getElementById('home-chips')
  if (!box) return
  box.innerHTML = homeConditions
    .map((c, i) => `<button type="button" class="chip-n" data-rm-chip="${i}" title="点击移除该条件">${esc(c.label)}<span class="x">×</span></button>`)
    .join('')
}
// 开始匹配：把解析出的条件写入 matcher 状态并跳转
function startMatchFromHome() {
  const input = document.getElementById('task-input')
  homeConditions = extractConditions(input ? input.value : '')
  const task = homeConditions.find((c) => c.key === 'task')
  if (task) state.selectedTask = task.value
  const budget = homeConditions.find((c) => c.key === 'budget')
  if (budget) state.budget = budget.value
  const speed = homeConditions.find((c) => c.key === 'speed')
  if (speed) state.speed = speed.value
  const traits = homeConditions.filter((c) => c.key === 'trait').map((c) => c.value)
  if (traits.length) state.browseTraits = Array.from(new Set([...state.browseTraits, ...traits]))
  const mod = homeConditions.find((c) => c.key === 'modality')
  if (mod) state.browseModality = mod.value
  const ctx = homeConditions.find((c) => c.key === 'context')
  if (ctx) state.minContext = ctx.value
  pushRecentSearch(input ? input.value : '')
  location.hash = 'matcher'
}

// ---------- 视图：厂商地图 ----------
function providerCard(p) {
  const vs = variantsOfProvider(p.id)
  const fs = familiesOfProvider(p.id)
  const region = { US: '美国', CN: '中国', FR: '法国', DE: '德国', GB: '英国' }[p.country] || p.country || '其他'
  return `<a class="provider-card" href="#provider/${encodeURIComponent(p.id)}" style="--brand:${esc(p.brand_color || '#173e35')}">
    <div class="pc-top">${logoHTML(p, 'md')}<div class="pc-tags"><span class="tag">${esc(region)}</span>${catBadge(p)}${p.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div></div>
    <h3>${esc(p.name_cn || p.name)}</h3>
    <p>${esc(p.description_cn || '')}</p>
    <div class="pc-mix">${modalityMix(vs)}</div>
    <div class="pc-series">${fs.slice(0, 4).map((f) => `<span class="series-chip">${esc(f.name_cn || f.name)}</span>`).join('')}${fs.length > 4 ? `<span class="series-chip more">+${fs.length - 4}</span>` : ''}</div>
    <div class="pc-foot"><span>${fs.length} 系列 · ${vs.length} 型号</span><i>查看 →</i></div>
  </a>`
}
function filteredProviders() {
  const q = state.providerSearch.trim().toLowerCase()
  return state.providers.filter((p) => {
    if (p.category === 'gateway') return false
    const f = state.providerFilter
    if (f === 'US' && p.country !== 'US') return false
    if (f === 'CN' && p.country !== 'CN') return false
    if (f === 'open' && p.open_weight !== true) return false
    const vs = variantsOfProvider(p.id)
    if (state.providerModality !== 'all' && !vs.some((v) => modalityOf(v) === state.providerModality)) return false
    if (!q) return true
    if ((p.name_cn || p.name).toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)) return true
    return vs.some((v) => variantMatches(v, q))
  })
}
function providerGridHTML() {
  const list = filteredProviders()
  return list.length ? list.map(providerCard).join('') : emptyBox('没有匹配的厂商或模型，换个关键词试试。')
}
function viewProviders() {
  const seg = (key, cur, groupAttr, items) =>
    `<div class="segmented" data-seg="${groupAttr}">${items.map((i) => `<button class="${cur === i[0] ? 'selected' : ''}" data-value="${i[0]}">${i[1]}</button>`).join('')}</div>`
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '01 / 厂商地图', title: '先认识厂商，<em>再理解模型。</em>', desc: '从公司定位开始浏览，顺着「厂商 → 系列 → 型号」找到适合你的选择。' })}
    <div class="toolbar">
      <input id="provider-search" type="search" placeholder="搜索厂商或模型…" autocomplete="off" value="${esc(state.providerSearch)}">
      <div class="toolbar-segs">
        ${seg('providerFilter', state.providerFilter, 'providerFilter', [['all', '全部'], ['US', '美国'], ['CN', '中国'], ['open', '开源生态']])}
        ${seg('providerModality', state.providerModality, 'providerModality', [['all', '全部模态'], ['text', '文本'], ['image', '图像'], ['video', '视频']])}
      </div>
    </div>
    <p class="notice">数据于 2026-08-05 联网核实，价格与能力以厂商官方为准。</p>
    <div class="provider-grid" id="provider-grid">${providerGridHTML()}</div>
  </div>`
}

// ---------- 视图：厂商详情 ----------
function viewProvider(id) {
  const p = byId(state.providers, 'id', id)
  if (!p) return notFound('厂商', id, '#providers')
  const fs = familiesOfProvider(id)
  const vs = variantsOfProvider(id)
  const famCard = (f) => {
    const list = variantsOfFamily(f.id)
    return `<a class="family-card" href="#family/${encodeURIComponent(f.id)}" style="--brand:${esc(p.brand_color)}">
      <div class="fc-top"><b>${esc(f.name_cn || f.name)}</b><span class="count">${list.length} 型号</span></div>
      <p>${esc(f.description_cn || '')}</p>
      <div class="fc-mix">${modalityMix(list)}</div>
      <div class="fc-models">${list.slice(0, 5).map((v) => `<span class="mini-chip">${esc(v.name_cn || v.name)}</span>`).join('')}${list.length > 5 ? `<span class="mini-chip more">+${list.length - 5}</span>` : ''}</div>
      <i class="fc-go">进入系列 →</i>
    </a>`
  }
  const region = { US: '美国', CN: '中国', FR: '法国', DE: '德国', GB: '英国' }[p.country] || p.country || '其他'
  return `<div class="wrap page">
    <button class="back-link" data-back="#providers">← 返回厂商地图</button>
    <header class="entity-head" style="--brand:${esc(p.brand_color)}">
      ${logoHTML(p, 'lg')}
      <div class="eh-main">
        <span class="eyebrow">${esc(region)} · PROVIDER</span>
        <h1>${esc(p.name_cn || p.name)}</h1>
        <p>${esc(p.description_cn || '')}</p>
        <div class="eh-tags">${modalityMix(vs)}${catBadge(p)}${p.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div>
        <div class="eh-links">
          ${p.website ? `<a class="text-link" href="${esc(p.website)}" target="_blank" rel="noopener">官网 ↗</a>` : ''}
          ${p.api_docs ? `<a class="text-link" href="${esc(p.api_docs)}" target="_blank" rel="noopener">API 文档 ↗</a>` : ''}
        </div>
      </div>
    </header>
    <div class="stat-strip">
      ${statCard('模型系列', fs.length)}
      ${statCard('收录型号', vs.length)}
      ${statCard('API Base URL', p.api_base_url ? `<code>${esc(p.api_base_url)}</code>` : '自托管 / 无公开 API')}
      ${statCard('接口风格', esc(API_STYLE_CN[p.api_style] || p.api_style || '—'))}
    </div>
    ${fs.length ? `
    <h2 class="sec-title">模型系列</h2>
    <p class="sec-sub">系列是理解一家厂商的最短路径：同一系列共享定位与训练思路，差别只在档位。</p>
    <div class="family-grid">${fs.map(famCard).join('')}</div>` : ''}
    ${vs.length ? `
    <h2 class="sec-title">全部型号</h2>
    <p class="sec-sub">该厂商收录的所有可调用型号，点卡片查看详情、价格与能力。</p>
    <div class="card-grid">${vs.map((v) => modelCard(v)).join('')}</div>` : emptyBox('该厂商暂无收录型号。')}
  </div>`
}

// ---------- 视图：模型系列（独立页）----------
function sortVariants(arr, mode) {
  const a = [...arr]
  if (mode === 'price-asc') a.sort((x, y) => priceValue(x) - priceValue(y))
  else if (mode === 'price-desc') a.sort((x, y) => priceValue(y) - priceValue(x))
  else if (mode === 'context') a.sort((x, y) => (y.context_window || 0) - (x.context_window || 0))
  else if (mode === 'speed') a.sort((x, y) => (SPEED_RANK[y.speed_tier] || 2) - (SPEED_RANK[x.speed_tier] || 2))
  return a
}
function capSum(v) {
  return CAP_DIMS.reduce((s, d) => s + (TIER[(v.capabilities || {})[d.key]?.tier]?.score || 0), 0)
}
// ---------- Phase 2 加权推荐评分（透明、可复现）----------
// 方法论（IMPLEMENTATION_PLAN §2.3）：任务匹配 40% + 能力质量 30% + 成本效率 20% + 响应速度 10%
// 无任务上下文时，任务匹配 40% 权重按比例分摊给其余三项（能力 50 / 成本 33 / 速度 17），保证仍为 0-100
function fitScore(v, taskId) {
  const capNorm = capSum(v) / (CAP_DIMS.length * 6) // 0..1
  const capQ = capNorm * 30
  let cost = 4
  if (v.free) cost = 20
  else {
    const pv = priceValue(v)
    if (pv < Number.MAX_SAFE_INTEGER) cost = Math.max(0, 20 * (1 - pv / 30))
  }
  const sp = ((SPEED_RANK[v.speed_tier] || 2) / 6) * 10
  if (taskId) {
    const rec = state.recommendations.find((r) => r.task_id === taskId)
    const m = rec && rec.model_ids.find((x) => x.id === v.id)
    const taskMatch = m && typeof m.score === 'number' ? (m.score / 5) * 40 : capNorm * 40
    return Math.max(0, Math.min(100, Math.round(taskMatch + capQ + cost + sp)))
  }
  // 无任务：三项按 50/33/17 归一化到 100
  return Math.max(0, Math.min(100, Math.round(capNorm * 50 + (cost / 20) * 33 + (sp / 10) * 17)))
}
function scoreBreakdownHTML(v, taskId) {
  const capNorm = capSum(v) / (CAP_DIMS.length * 6)
  let cost = 4
  if (v.free) cost = 20
  else {
    const pv = priceValue(v)
    if (pv < Number.MAX_SAFE_INTEGER) cost = Math.max(0, 20 * (1 - pv / 30))
  }
  const sp = ((SPEED_RANK[v.speed_tier] || 2) / 6) * 10
  const rows = []
  if (taskId) {
    const rec = state.recommendations.find((r) => r.task_id === taskId)
    const m = rec && rec.model_ids.find((x) => x.id === v.id)
    const tmRaw = m && typeof m.score === 'number' ? m.score / 5 : capNorm
    rows.push(['任务匹配', tmRaw * 100, '40%'])
  }
  rows.push(['能力质量', capNorm * 100, '30%'])
  rows.push(['成本效率', (cost / 20) * 100, '20%'])
  rows.push(['响应速度', (sp / 10) * 100, '10%'])
  const head = `<div class="sb-head"><span>综合评分<small>${taskId ? '基于所选任务' : '按整体实力'}</small></span><b>${fitScore(v, taskId)}<small>/100</small></b></div>`
  const body = rows
    .map(([label, pct, wt]) => `<div class="sb-row"><span class="sb-label">${label}<i>权重${wt}</i></span><span class="sb-track"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span><span class="sb-val">${Math.round(pct)}</span></div>`)
    .join('')
  return `<div class="score-break">${head}${body}</div>`
}
function familyTableHTML(f) {
  const list = sortVariants(variantsOfFamily(f.id), state.familySort)
  if (!list.length) return emptyBox('该系列暂无收录型号。')
  const isMedia = list.every((v) => v.media_type)
  const head = isMedia
    ? ['型号', '模态', '分辨率 / 时长', '价格', '速度', '定位', '']
    : ['型号', '模态', '上下文', '输入 / 输出 (每 M tokens)', '速度', '推理', '编码', '']
  const row = (v) => {
    const cells = isMedia
      ? [
          `<b>${esc(v.name_cn || v.name)}</b><small>${esc(v.model_id || v.id)}</small>`,
          modBadge(v),
          esc([v.max_resolution, v.max_duration_sec ? v.max_duration_sec + 's' : null].filter(Boolean).join(' · ') || '—'),
          priceCell(v),
          esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—'),
          `<span class="cell-desc">${esc(v.one_liner_cn || '')}</span>`,
        ]
      : [
          `<b>${esc(v.name_cn || v.name)}</b><small>${esc(v.model_id || v.id)}</small>`,
          modBadge(v),
          ctxShort(v.context_window),
          priceCell(v),
          esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—'),
          tierPill(v, 'reasoning'),
          tierPill(v, 'coding'),
        ]
    return `<tr data-goto="#model/${encodeURIComponent(v.id)}">${cells.map((c) => `<td>${c}</td>`).join('')}<td class="td-go">→</td></tr>`
  }
  return `<div class="table-wrap"><table class="cmp-table">
    <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${list.map(row).join('')}</tbody>
  </table></div>`
}
function tierPill(v, key) {
  const c = (v.capabilities || {})[key]
  if (!c) return '—'
  const t = TIER[c.tier] || { label: c.tier, lv: 'mid' }
  return `<span class="tier-pill tier-${t.lv}">${t.label}</span>`
}
function viewFamily(id) {
  const f = byId(state.families, 'id', id)
  if (!f) return notFound('系列', id, '#providers')
  const p = providerById(f.provider_id)
  const list = variantsOfFamily(f.id)
  // 「怎么选」自动结论
  const picks = []
  if (list.length > 1) {
    const strongest = [...list].sort((a, b) => capSum(b) - capSum(a))[0]
    const cheapest = [...list].sort((a, b) => priceValue(a) - priceValue(b))[0]
    const fastest = [...list].sort((a, b) => (SPEED_RANK[b.speed_tier] || 2) - (SPEED_RANK[a.speed_tier] || 2))[0]
    const longest = [...list].filter((v) => v.context_window).sort((a, b) => b.context_window - a.context_window)[0]
    const add = (label, v, note) => {
      if (v && !picks.some((x) => x.v.id === v.id && x.label === label)) picks.push({ label, v, note })
    }
    add('能力最强', strongest, '综合五维能力档位最高')
    if (priceValue(cheapest) !== Number.MAX_SAFE_INTEGER) add('最省钱', cheapest, '同系列单价最低')
    add('响应最快', fastest, `速度档 ${SPEED_CN[fastest?.speed_tier] || fastest?.speed_tier || '—'}`)
    if (longest) add('上下文最长', longest, `${ctxShort(longest.context_window)} tokens`)
  }
  const sortOpts = [['default', '默认顺序'], ['price-asc', '价格从低到高'], ['price-desc', '价格从高到低'], ['context', '上下文最长'], ['speed', '速度最快']]
  return `<div class="wrap page">
    <button class="back-link" data-back="#provider/${encodeURIComponent(p.id)}">← 返回 ${esc(p.name_cn || p.name)}</button>
    <header class="entity-head" style="--brand:${esc(p.brand_color)}">
      ${logoHTML(p, 'lg')}
      <div class="eh-main">
        <span class="eyebrow"><a class="crumb" href="#provider/${encodeURIComponent(p.id)}">${esc(p.name_cn || p.name)}</a> · MODEL FAMILY</span>
        <h1>${esc(f.name_cn || f.name)}</h1>
        <p>${esc(f.description_cn || '')}</p>
        <div class="eh-tags">${modalityMix(list)}<span class="tag">${list.length} 个型号</span>${catBadge(p)}</div>
      </div>
    </header>
    ${picks.length ? `<h2 class="sec-title">系列内怎么选</h2>
    <div class="pick-grid">${picks.map((x) => `<a class="pick-card" href="#model/${encodeURIComponent(x.v.id)}"><span class="pick-label">${esc(x.label)}</span><b>${esc(x.v.name_cn || x.v.name)}</b><small>${esc(x.note)}</small></a>`).join('')}</div>` : ''}
    <div class="sec-bar">
      <h2 class="sec-title">全部型号对比</h2>
      <label class="sort-label">排序<select data-sort="familySort">${sortOpts.map((o) => `<option value="${o[0]}"${state.familySort === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
    </div>
    <div id="family-table">${familyTableHTML(f)}</div>
  </div>`
}

// ---------- 视图：能力 / 场景浏览 ----------
function matchModels() {
  let list = state.variants.filter((v) => state.browseModality === 'all' || modalityOf(v) === state.browseModality)
  // 子串匹配用「清洗后的纯文本」：结构化片段（模态/上下文/预算等）已转为筛选条件，不再参与文本匹配
  if (state.browseSearchClean) list = list.filter((v) => variantMatches(v, state.browseSearchClean))
  if (state.minContext > 0) list = list.filter((v) => (v.context_window || 0) >= state.minContext)
  if (state.favOnly) { const fav = getFav(); list = list.filter((v) => fav.includes(v.id)) }
  if (state.browsePrice === 'free') list = list.filter((v) => v.free)
  else if (state.browsePrice === 'low') list = list.filter((v) => v.free !== true && v.input_price_per_mtok != null && v.input_price_per_mtok <= 1)
  else if (state.browsePrice === 'standard') list = list.filter((v) => v.free !== true && v.input_price_per_mtok != null && v.input_price_per_mtok > 1)
  if (state.browseBill !== 'all') list = list.filter((v) => v.price_model === state.browseBill)
  state.browseTraits.forEach((k) => {
    const t = TRAITS.find((x) => x.key === k)
    if (t) list = list.filter(t.test)
  })
  // 能力维度改为硬筛选：必须同时具备所选每一项能力（缺任一即排除）
  if (state.browseCaps.length) {
    list = list.filter((v) => {
      const caps = v.capabilities || {}
      return state.browseCaps.every((k) => caps[k] && caps[k].tier)
    })
  }
  const scored = list.map((v) => {
    const caps = v.capabilities || {}
    let score = 0
    if (state.browseCaps.length) {
      const sum = state.browseCaps.reduce((s, k) => s + (TIER[caps[k]?.tier]?.score || 0), 0)
      score = (sum / (state.browseCaps.length * 6)) * 100
    } else {
      score = (capSum(v) / (CAP_DIMS.length * 6)) * 100
    }
    return { v, score: Math.round(score) }
  })
  if (state.browseSort === 'price') scored.sort((a, b) => priceValue(a.v) - priceValue(b.v))
  else if (state.browseSort === 'context') scored.sort((a, b) => (b.v.context_window || 0) - (a.v.context_window || 0))
  else scored.sort((a, b) => b.score - a.score || priceValue(a.v) - priceValue(b.v))
  return scored
}
function browseResultsHTML() {
  const scored = matchModels()
  if (!scored.length) return emptyBox('没有同时满足这些条件的模型，试着减少几个筛选项。')
  const top = scored.slice(0, 24)
  const hitLabel = (v) => {
    const hits = state.browseCaps
      .map((k) => {
        const d = CAP_DIMS.find((x) => x.key === k)
        const c = (v.capabilities || {})[k]
        if (!c) return null
        const t = TIER[c.tier]
        return `<span class="hit-pill tier-${t.lv}">${d.cn} ${t.label}</span>`
      })
      .filter(Boolean)
      .join('')
    return hits
  }
  return `<p class="result-count">匹配到 <b>${scored.length}</b> 个模型${scored.length > 24 ? '，展示前 24 个' : ''}</p>
  <div class="card-grid">${top
    .map(({ v, score }) => {
      const badge = state.browseCaps.length || state.browseTraits.length ? `<span class="match-flag">匹配 ${score}%</span>` : `<span class="score-flag">综合 ${fitScore(v)}</span>`
      const card = modelCard(v, badge)
      const hits = hitLabel(v)
      return hits ? card.replace('</a>', `<div class="mc-hits">${hits}</div></a>`) : card
    })
    .join('')}</div>`
}
// 浏览页表格视图（复用 data-table--browse Token；与对比表仅共享排版/间距/边框，不共享业务组件）
function browseTableViewHTML() {
  const scored = matchModels()
  if (!scored.length) return emptyBox('没有同时满足这些条件的模型，试着减少几个筛选项。')
  const rows = scored.slice(0, 60).map(({ v }) => {
    const p = providerOf(v)
    const caps = capTags(v).map((c) => `<span class="cap-mini">${esc(c)}</span>`).join('')
    const inp = v.free ? '免费' : (v.input_price_per_mtok != null ? `<span class="mono">$${v.input_price_per_mtok}</span>` : '—')
    const out = v.free ? '免费' : (v.output_price_per_mtok != null ? `<span class="mono">$${v.output_price_per_mtok}</span>` : '—')
    const sp = SPEED_CN[v.speed_tier] || '—'
    return `<tr>
      <td class="dt-name"><a href="#model/${encodeURIComponent(v.id)}">${logoHTML(p, 'sm')}<span class="dt-name-txt"><b>${esc(v.name_cn || v.name)}</b><small>${esc(p.name_cn || p.name)}</small></span></a></td>
      <td>${esc(p.name_cn || p.name)}</td>
      <td class="mono">${ctxShort(v.context_window)}</td>
      <td class="mono">${inp}</td>
      <td class="mono">${out}</td>
      <td class="dt-caps">${caps}</td>
      <td>${esc(sp)}</td>
      <td class="mono score-td">${fitScore(v)}</td>
      <td><button class="cmp-toggle sm" data-cmp="${v.id}">${inCompare(v.id) ? '✓' : '＋'}</button></td>
    </tr>`
  }).join('')
  return `<p class="result-count">匹配到 <b>${scored.length}</b> 个模型${scored.length > 60 ? '，表格展示前 60 个' : ''}</p>
  <table class="data-table data-table--browse">
    <thead><tr><th>模型</th><th>厂商</th><th>上下文</th><th>输入 $/M</th><th>输出 $/M</th><th>能力</th><th>速度</th><th>评分</th><th>对比</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}
function viewBrowse() {
  const capChip = (d) =>
    `<button class="chip ${state.browseCaps.includes(d.key) ? 'on' : ''}" aria-pressed="${state.browseCaps.includes(d.key) ? 'true' : 'false'}" data-cap="${d.key}">${d.cn}<span>${d.en}</span></button>`
  const traitChip = (t) =>
    `<button class="chip ${state.browseTraits.includes(t.key) ? 'on' : ''}" aria-pressed="${state.browseTraits.includes(t.key) ? 'true' : 'false'}" data-trait="${t.key}">${t.cn}<span>${t.hint}</span></button>`
  const modBtn = (k, label) =>
    `<button class="${state.browseModality === k ? 'selected' : ''}" aria-pressed="${state.browseModality === k ? 'true' : 'false'}" data-value="${k}">${label}</button>`
  const priceBtn = (k, label) =>
    `<button class="${state.browsePrice === k ? 'selected' : ''}" aria-pressed="${state.browsePrice === k ? 'true' : 'false'}" data-value="${k}">${label}</button>`
  const billBtn = (k, label) =>
    `<button class="${state.browseBill === k ? 'selected' : ''}" aria-pressed="${state.browseBill === k ? 'true' : 'false'}" data-value="${k}">${label}</button>`
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '02 / 能力筛选', title: '按<em>能力</em>找模型', desc: '左边勾选你需要的能力与硬性条件，右边即时过滤并排序，找到最合适的型号。' })}
    <div class="browse-toolbar">
      <div class="bt-search"><span class="bt-ico">⌕</span><input id="browse-search" type="search" placeholder="搜索模型或厂商…" value="${esc(state.browseSearch)}" aria-label="搜索模型或厂商"></div>
      <div class="view-switch" role="group" aria-label="视图切换">
        <button class="${state.browseView === 'card' ? 'selected' : ''}" data-view="card" aria-pressed="${state.browseView === 'card'}">卡片</button>
        <button class="${state.browseView === 'table' ? 'selected' : ''}" data-view="table" aria-pressed="${state.browseView === 'table'}">表格</button>
      </div>
    </div>
    <div class="browse-layout">
      <aside class="filter-panel">
        <div class="fp-block"><h4>模态</h4><div class="segmented" data-seg="browseModality">${modBtn('all', '全部')}${modBtn('text', '文本')}${modBtn('image', '图像')}${modBtn('video', '视频')}</div></div>
        <div class="fp-block"><h4>价格<small>按付费方式筛选</small></h4><div class="segmented" data-seg="browsePrice">${priceBtn('all', '全部')}${priceBtn('free', '免费')}${priceBtn('low', '低成本')}${priceBtn('standard', '标准价')}</div></div>
        <div class="fp-block"><h4>计费方式<small>按计价单位筛选</small></h4><div class="segmented" data-seg="browseBill">${billBtn('all', '全部')}${billBtn('per_token', '按 Token')}${billBtn('per_image', '按张')}${billBtn('per_second', '按秒')}</div></div>
        <div class="fp-block"><h4>能力维度<small>多选，逐条过滤</small></h4><div class="chip-wrap">${CAP_DIMS.map(capChip).join('')}</div></div>
        <div class="fp-block"><h4>硬性条件<small>多选，逐条过滤</small></h4><div class="chip-wrap">${TRAITS.map(traitChip).join('')}</div></div>
        <div class="fp-block"><h4>排序</h4><div class="segmented" data-seg="browseSort"><button class="${state.browseSort === 'match' ? 'selected' : ''}" data-value="match">匹配度</button><button class="${state.browseSort === 'price' ? 'selected' : ''}" data-value="price">价格</button><button class="${state.browseSort === 'context' ? 'selected' : ''}" data-value="context">上下文</button></div></div>
        <div class="fp-block"><h4>我的收藏<small>本地保存</small></h4><button class="chip ${state.favOnly ? 'on' : ''}" aria-pressed="${state.favOnly}" data-fav-only>只看收藏 ${getFav().length ? '(' + getFav().length + ')' : ''}</button></div>
        <button class="button ghost small" data-reset-filters>清空筛选</button>
      </aside>
      <div class="browse-results" id="browse-results">${state.browseView === 'table' ? browseTableViewHTML() : browseResultsHTML()}</div>
    </div>
  </div>`
}

// ---------- 视图：任务选择器 ----------
function rankCandidates(ids) {
  const arr = ids.map((r) => ({ r, v: variantById(r.id) })).filter((x) => x.v)
  const speedOf = (v) => SPEED_RANK[v.speed_tier] ?? 2
  if (state.budget === 'low') arr.sort((a, b) => priceValue(a.v) - priceValue(b.v))
  else if (state.budget === 'high' || state.speed === 'quality') arr.sort((a, b) => fitScore(b.v, state.selectedTask) - fitScore(a.v, state.selectedTask))
  else if (state.speed === 'fast') arr.sort((a, b) => speedOf(b.v) - speedOf(a.v))
  else arr.sort((a, b) => fitScore(b.v, state.selectedTask) - fitScore(a.v, state.selectedTask))
  return arr
}
function recommendationHTML(taskId = state.selectedTask) {
  const task = byId(state.tasks, 'id', taskId)
  const rec = state.recommendations.find((r) => r.task_id === taskId)
  if (!task || !rec) return `<div class="empty-box"><span>✦</span><p>该任务暂无推荐数据。</p></div>`
  // 在所选任务基础上，按首页/搜索传入的模态与上下文软过滤（非空才生效，避免清空推荐）
  let modelIds = rec.model_ids
  if (state.browseModality !== 'all') {
    const f = modelIds.filter((m) => { const v = variantById(m.id); return v && modalityOf(v) === state.browseModality })
    if (f.length) modelIds = f
  }
  if (state.minContext > 0) {
    const f = modelIds.filter((m) => { const v = variantById(m.id); return v && (v.context_window || 0) >= state.minContext })
    if (f.length) modelIds = f
  }
  const ranked = rankCandidates(modelIds)
  const hint =
    state.budget === 'low'
      ? '已按「尽量省钱」排序（价格优先）'
      : state.speed === 'fast'
        ? '已按「速度优先」排序'
        : state.budget === 'high' || state.speed === 'quality'
          ? '已按「质量优先」排序（推荐评分）'
          : '按推荐评分排序'
  return `<div class="tr-head"><div><span class="eyebrow">推荐</span><h3>${esc(rec.label)}</h3></div><span class="match-badge">前 ${ranked.length}</span></div>
  ${ranked
    .map(
      ({ r, v }, i) => `<a class="result-row" href="#model/${encodeURIComponent(v.id)}">
    <span class="rank">0${i + 1}</span>
    ${logoHTML(providerOf(v), 'sm')}
    <span class="result-main"><b>${esc(v.name_cn || v.name)}</b><small>${esc(providerOf(v).name_cn || '')}${famName(v) ? ' · ' + esc(famName(v)) : ''}</small></span>
    ${modBadge(v)}${v.free ? ' <span class="free-badge sm">免费</span>' : ''}
    <span class="result-reason">${esc(r.reason)}</span>
    <span class="score-pill" title="综合评分：任务匹配40% + 能力30% + 成本20% + 速度10%">${fitScore(v, taskId)}<small>/100</small></span>
    <span class="arrow">→</span>
  </a>`,
    )
    .join('')}
  <p class="disclaimer">${hint}${rec.note ? ' · ' + esc(rec.note) : ''}</p>`
}
function viewMatcher() {
  const taskBtn = (t) =>
    `<button class="task-option ${state.selectedTask === t.id ? 'selected' : ''}" aria-pressed="${state.selectedTask === t.id ? 'true' : 'false'}" data-task="${t.id}"><span class="to-ico">${t.icon || '◎'}</span><span class="to-text"><b>${esc(t.name_cn)}</b><small>${esc(t.description_cn)}</small></span></button>`
  const segBtn = (group, cur, val, label) =>
    `<button class="${cur === val ? 'selected' : ''}" aria-pressed="${cur === val ? 'true' : 'false'}" data-value="${val}">${label}</button>`
  return `<div class="matcher-page">
    <div class="wrap page">
      ${pageHead({ eyebrow: '03 / 任务匹配', title: '告诉我，<em>你想做什么？</em>', desc: '选择任务、预算和偏好，得到带理由的推荐列表。' })}
      <div class="matcher-layout">
        <div class="matcher-form">
          <label>我想要</label>
          <div class="task-options">${state.tasks.map(taskBtn).join('')}</div>
          <label>预算倾向</label>
          <div class="segmented" data-seg="budget">${segBtn('budget', state.budget, 'low', '尽量省钱')}${segBtn('budget', state.budget, 'balanced', '平衡')}${segBtn('budget', state.budget, 'high', '质量优先')}</div>
          <label>我更在意</label>
          <div class="segmented" data-seg="speed">${segBtn('speed', state.speed, 'balanced', '平衡')}${segBtn('speed', state.speed, 'fast', '速度')}${segBtn('speed', state.speed, 'quality', '质量')}</div>
        </div>
        <div class="recommendation" id="recommendation">${recommendationHTML()}</div>
      </div>
    </div>
  </div>`
}

// ---------- 视图：型号详情 ----------
function codeExamples(v) {
  const p = providerOf(v)
  const base = p.api_base_url || 'http://localhost:8000/v1'
  const isLocal = !p.api_base_url
  const model = v.model_id || v.id
  const style = p.api_style
  const prompt = '你好，介绍一下你自己'
  if (v.media_type === 'image' && style === 'openai') {
    return {
      py: `from openai import OpenAI\n\nclient = OpenAI(api_key="YOUR_API_KEY")\n\nimage = client.images.generate(\n    model="${model}",\n    prompt="一只赛博朋克风格的猫",\n    size="1024x1024",\n    n=1,\n)\nprint(image.data[0].url or image.data[0].b64_json)`,
      js: `const res = await fetch("${base}/images/generations", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", Authorization: "Bearer YOUR_API_KEY" },\n  body: JSON.stringify({ model: "${model}", prompt: "一只赛博朋克风格的猫", size: "1024x1024", n: 1 }),\n});\nconst data = await res.json();\nconsole.log(data.data[0].url || data.data[0].b64_json);`,
      curl: `curl ${base}/images/generations \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{ "model": "${model}", "prompt": "一只赛博朋克风格的猫", "size": "1024x1024", "n": 1 }'`,
    }
  }
  if (v.media_type === 'video' && style === 'google') {
    return {
      py: `import google.generativeai as genai\n\ngenai.configure(api_key="YOUR_API_KEY")\nmodel = genai.GenerativeModel("${model}")\noperation = model.generate_content("一只猫在月球上奔跑")  # Veo\nvideo = operation.result()  # 轮询获取视频结果`,
      js: `const res = await fetch("${base}/models/${model}:generateContent?key=YOUR_API_KEY", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "一只猫在月球上奔跑" }] }] }),\n});\nconst data = await res.json();\nconsole.log(data.candidates?.[0]?.content?.parts?.[0]);`,
      curl: `curl "${base}/models/${model}:generateContent?key=YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "contents": [{"role":"user","parts":[{"text":"一只猫在月球上奔跑"}]}] }'`,
    }
  }
  if (v.media_type) {
    const docs = p.api_docs ? `<a class="text-link" href="${esc(p.api_docs)}" target="_blank" rel="noopener">官方文档 ↗</a>` : '无公开文档'
    const baseUrlPart = (p.api_base_url && !p.no_endpoint) ? ' · Base URL：<code>' + esc(p.api_base_url) + '</code>' : ''
    return { note: `该模型通过官方平台 / API 调用，无统一 SDK 示例。请参考：${docs}${baseUrlPart}。` }
  }
  if (style === 'anthropic') {
    return {
      py: `import anthropic\n\nclient = anthropic.Anthropic(api_key="YOUR_API_KEY")\nmessage = client.messages.create(\n    model="${model}",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "${prompt}"}],\n)\nprint(message.content[0].text)`,
      js: `const res = await fetch("${base}/v1/messages", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", "x-api-key": "YOUR_API_KEY", "anthropic-version": "2023-06-01" },\n  body: JSON.stringify({ model: "${model}", max_tokens: 1024, messages: [{ role: "user", content: "${prompt}" }] }),\n});\nconst data = await res.json();\nconsole.log(data.content[0].text);`,
      curl: `curl ${base}/v1/messages \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -d '{ "model": "${model}", "max_tokens": 1024, "messages": [{"role":"user","content":"${prompt}"}] }'`,
    }
  }
  if (style === 'google') {
    return {
      py: `import google.generativeai as genai\n\ngenai.configure(api_key="YOUR_API_KEY")\nmodel = genai.GenerativeModel("${model}")\nresponse = model.generate_content("${prompt}")\nprint(response.text)`,
      js: `const res = await fetch("${base}/models/${model}:generateContent?key=YOUR_API_KEY", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "${prompt}" }] }] }),\n});\nconst data = await res.json();\nconsole.log(data.candidates[0].content.parts[0].text);`,
      curl: `curl "${base}/models/${model}:generateContent?key=YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "contents": [{"role":"user","parts":[{"text":"${prompt}"}]}] }'`,
    }
  }
  return {
    py: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${base}",\n    api_key="YOUR_API_KEY",\n)\n\nresponse = client.chat.completions.create(\n    model="${model}",\n    messages=[{"role": "user", "content": "${prompt}"}],\n)\nprint(response.choices[0].message.content)`,
    js: `const res = await fetch("${base}/chat/completions", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", Authorization: "Bearer YOUR_API_KEY" },\n  body: JSON.stringify({ model: "${model}", messages: [{ role: "user", content: "${prompt}" }] }),\n});\nconst data = await res.json();\nconsole.log(data.choices[0].message.content);`,
    curl: `curl ${base}/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{ "model": "${model}", "messages": [{"role":"user","content":"${prompt}"}] }'`,
    isLocal,
  }
}
function priceBlock(v) {
  if (!v.price_model) return ''
  const LBL = { per_token: '按 Token 计费', per_image: '按张计费（图像生成）', per_second: '按秒计费（视频生成）' }
  let detail = ''
  if (v.price_model === 'per_token') {
    if (v.free) detail = '免费模型（无 token 价）'
    else if (v.input_price_per_mtok != null) detail = `输入 ${cur(v.currency)}${v.input_price_per_mtok}/百万 tokens · 输出 ${cur(v.currency)}${v.output_price_per_mtok}/百万 tokens`
    else detail = '价格未公开'
  } else {
    detail = v.price_note || ''
  }
  return `<div class="api-price"><b>${LBL[v.price_model] || v.price_model}</b>${detail ? `<span>${esc(detail)}</span>` : ''}</div>`
}
function apiBlockHTML(v) {
  const p = providerOf(v)
  const base = p.api_base_url || 'http://localhost:8000/v1'
  const ex = codeExamples(v)
  const aa = apiAccessOf(v)
  const acc = aa ? aa.accesses[0] : null
  const noEndpoint = !!((acc && acc.no_endpoint) || p.no_endpoint)
  const accessFact = noEndpoint
    ? `<div class="api-fact"><b>官方访问</b><span>${p.website ? `<a class="text-link" href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website)}</a>` : '暂无公开 API 端点'}</span></div>`
    : `<div class="api-fact"><b>接入地址</b><code>${esc(acc ? acc.base_url : (p.api_base_url || '（自托管）'))}</code></div>`
  const feats = (acc && acc.features) || []
  const hasTool = feats.includes('tool_calling') || !!(v.capabilities && v.capabilities.agent && v.capabilities.agent.tier)
  const hasStream = feats.includes('streaming')
  const facts = `<div class="api-facts">
    ${accessFact}
    <div class="api-fact"><b>模型 ID</b><code>${esc(v.model_id || v.id)}</code></div>
    <div class="api-fact"><b>接口协议</b><code>${esc(API_STYLE_CN[acc ? acc.protocol : p.api_style] || (acc ? acc.protocol : p.api_style) || '—')}</code></div>
    <div class="api-fact"><b>认证方式</b><code>${esc((acc && acc.auth_type) || 'api_key')}</code></div>
    <div class="api-fact api-feat"><b>能力支持</b><span>${hasTool ? '<i class="feat on">Tool Calling</i>' : ''}${hasStream ? '<i class="feat on">Streaming</i>' : ''}<i class="feat dim">Structured Output（见官方文档）</i></span></div>
  </div>`
  const price = priceBlock(v)
  const apiNote = (acc && acc.api_note) ? `<p class="api-note">⚠ ${esc(acc.api_note)}</p>` : ''
  if (ex.note) return `<div class="api-block">${facts}${price}${apiNote}<p class="muted">${ex.note}</p></div>`
  const note = ex.isLocal
    ? '<p class="muted">开放权重模型：将 Base URL 换成你自托管的推理服务（vLLM / Ollama 默认监听 <code>http://localhost:8000/v1</code>）。</p>'
    : ''
  const tab = (label, key) => `<button class="code-tab${key === 'py' ? ' selected' : ''}" data-code-tab="${key}">${label}</button>`
  const pre = (key, code) => `<pre class="code-block${key === 'py' ? '' : ' hidden'}" data-code="${key}"><code>${esc(code)}</code></pre>`
  return `<div class="api-block">${facts}${price}${apiNote}${note}
    <div class="code-tabs">${tab('Python', 'py')}${tab('JavaScript', 'js')}${tab('curl', 'curl')}<button class="copy-btn" data-copy>复制</button></div>
    ${pre('py', ex.py)}${pre('js', ex.js)}${pre('curl', ex.curl)}</div>`
}
function specCards(v) {
  if (v.media_type) {
    const m = v.media_pricing || {}
    return [
      statCard('模态', MODALITY[modalityOf(v)].label),
      statCard('最高分辨率', esc(v.max_resolution || '—')),
      statCard('最长时长', v.max_duration_sec ? v.max_duration_sec + ' 秒' : '—'),
      statCard('原生音频', v.has_audio == null ? '—' : v.has_audio ? '支持' : '不支持'),
      statCard('单价', v.free ? '免费' : (m.price != null ? priceLabel(v) : '未公开'), v.free ? '' : (m.note || '')),
      statCard('速度档', esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—')),
      statCard('开放权重', v.open_weight ? '是' : '否'),
      statCard('发布', esc(v.release_date || '—')),
    ].join('')
  }
  return [
    statCard('上下文窗口', ctxShort(v.context_window), v.context_window ? v.context_window.toLocaleString() + ' token' : ''),
    statCard('最大输出', v.max_output_tokens ? ctxShort(v.max_output_tokens) : '—', v.max_output_tokens ? v.max_output_tokens.toLocaleString() + ' token' : ''),
    statCard('输入价格', v.free ? '免费' : (v.input_price_per_mtok == null ? '未公开' : `${cur(v.currency)}${v.input_price_per_mtok}`), '每百万 token'),
    statCard('输出价格', v.free ? '免费' : (v.output_price_per_mtok == null ? '未公开' : `${cur(v.currency)}${v.output_price_per_mtok}`), '每百万 token'),
    statCard('速度档', esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—')),
    statCard('视觉输入', v.vision_support ? '支持' : '不支持'),
    statCard('参数规模', esc(v.params || '未公开')),
    statCard('开放权重', v.open_weight ? '是' : '否'),
  ].join('')
}
// 参数速读：把 122B / 256K 这类数字翻译成通俗含义（Option B 解读区块）
function paramInsight(v) {
  const items = []
  // 参数规模
  const pr = (v.params || '').trim()
  if (pr && pr !== '未公开') {
    const m = pr.match(/(\d+(?:\.\d+)?)\s*([BT])/i)
    if (m) {
      const num = parseFloat(m[1])
      const unit = m[2].toUpperCase()
      const billions = unit === 'T' ? num * 1000 : num
      let band, desc
      if (billions < 8) { band = '轻量级'; desc = '参数少、体积小，适合端侧部署、高频低延迟调用，但复杂推理能力有限。' }
      else if (billions < 30) { band = '中小规模'; desc = '在速度与质量间取得平衡，多数日常任务够用，显存占用可控。' }
      else if (billions < 70) { band = '中大型'; desc = '进入高质量区间，长文理解与复杂推理更稳，需要较好算力。' }
      else if (billions <= 150) { band = '大型稠密'; desc = '旗舰级稠密模型，推理质量高，但更吃显存与算力、速度偏慢。' }
      else { band = '超大规模'; desc = '参数规模位于顶端（多为 MoE 混合专家架构），能力最强，但对算力与上下文规划要求最高。' }
      items.push({ k: '参数规模', v: pr, band, desc })
    }
  }
  // 上下文窗口
  const cw = v.context_window
  if (cw) {
    const k = cw / 1000
    const km = k >= 1000 ? (k / 1000).toFixed(k % 1000 === 0 ? 0 : 1) + 'M' : (Number.isInteger(k) ? k : Math.round(k)) + 'K'
    const chars = Math.round(cw * 0.7)
    let band, desc
    if (cw < 32000) { band = '标准窗口'; desc = '适合单轮问答与中短文档，长文档需分段处理。' }
    else if (cw < 128000) { band = '长窗口'; desc = '可一次喂入数万字长文，胜任多数文档摘要与多轮对话。' }
    else if (cw < 256000) { band = '超长窗口'; desc = '能处理整篇论文或报告，长程依赖保持更好。' }
    else { band = '极长窗口'; desc = '可整本小说或数百页资料一次放入，适合超长文档问答、代码库级检索。' }
    items.push({ k: '上下文窗口', v: km + '（' + cw.toLocaleString() + ' token）', band, desc, tip: '约 ' + chars.toLocaleString() + ' 中文字' })
  }
  // 计费单位
  if (!v.free && (v.input_price_per_mtok != null || v.output_price_per_mtok != null)) {
    items.push({ k: '计费单位', v: '每百万 token', band: '计价基准', desc: '1M token ≈ 约 75 万中文字 ≈ 一本中等长度的书。输入/输出分别计费，输出通常更贵。' })
  }
  if (!items.length) return ''
  return `<section class="detail-sec"><h3>参数速读<small>这些数字到底意味着什么</small></h3><div class="insight-grid">${items
    .map((it) => `<article class="insight-card"><div class="insight-top"><span class="insight-k">${esc(it.k)}</span><span class="insight-band">${esc(it.band)}</span></div><b class="insight-val">${esc(it.v)}</b><p>${esc(it.desc)}</p>${it.tip ? `<small class="insight-tip">${esc(it.tip)}</small>` : ''}</article>`)
    .join('')}</div></section>`
}
// 治理 v2.0「模型生态与基准」区块：开放权重仓库 + 实时基准看板（不写死分数，避免编造）
function ecoBlock(v) {
  const g = gradeOf(v)
  const benchLinks = [
    { n: 'Artificial Analysis', u: 'https://artificialanalysis.ai/models' },
    { n: 'LMArena', u: 'https://lmarena.ai/leaderboard' },
  ]
  const repo = v.repo_url
  const benchRow = (v.benchmarks && v.benchmarks.length)
    ? `<div class="eco-row"><b>本站基准记录</b><span><ul class="bench-list">${v.benchmarks.map((b) => `<li><b>${esc(b.name)}</b><span>${esc(b.score)}${b.source ? ` · <a href="${esc(b.source)}" target="_blank" rel="noopener">来源↗</a>` : ''}</span></li>`).join('')}</ul></span></div>`
    : ''
  const links = benchLinks.map((l) => `<a class="eco-link" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.n)} ↗</a>`).join('')
  const repoEl = repo ? `<a class="eco-link" href="${esc(repo)}" target="_blank" rel="noopener">官方仓库 / 模型页 ↗</a>` : '<span class="muted">闭源模型，无公开仓库</span>'
  const qNote = ['C', 'D'].includes(g) ? ' · <span class="muted">完整度偏低，建议以官方文档为准</span>' : ''
  return `<section class="detail-sec"><h3>模型生态与基准<small>开放权重与第三方基准看板</small></h3>
    <div class="eco-box">
      <div class="eco-row"><b>数据质量</b><span>${gradeBadge(v)} ${v.data_quality_score || 0} 分${qNote}</span></div>
      <div class="eco-row"><b>官方仓库</b><span>${repoEl}</span></div>
      <div class="eco-row"><b>实时基准</b><span class="eco-links">${links}<p class="muted" style="margin:.4em 0 0">本站不写死基准分数（避免过时/编造），请用上方看板核对实时表现。</p></span></div>
      ${benchRow}
    </div></section>`
}
function namingBlock(v) {
  const hay = `${v.name || ''} ${v.name_cn || ''} ${v.model_id || ''}`.toLowerCase()
  const hits = state.naming.filter((n) => hay.includes(n.term.toLowerCase()))
  if (!hits.length) return ''
  return `<section class="detail-sec"><h3>型号命名解读</h3><div class="naming-grid">${hits
    .map((n) => `<article class="naming-card"><span class="naming-term">${esc(n.term)}</span><b>${esc(n.name_cn)}</b><p>${esc(n.description_cn)}</p><small>例：${esc(n.example)}</small></article>`)
    .join('')}</div></section>`
}
function relatedBlock(v) {
  const sib = variantsOfFamily(v.family_id).filter((x) => x.id !== v.id).slice(0, 4)
  const other = variantsOfProvider(v.provider_id).filter((x) => x.id !== v.id && x.family_id !== v.family_id).slice(0, 4)
  if (!sib.length && !other.length) return ''
  const grp = (title, list) =>
    list.length ? `<div class="rel-group"><h4>${title}</h4><div class="card-grid compact">${list.map((x) => modelCard(x)).join('')}</div></div>` : ''
  return `<section class="detail-sec"><h3>相关模型</h3>${grp('同系列其他型号', sib)}${grp('同厂商其他系列', other)}</section>`
}
// 型号详情：推荐理由（基于公开规格派生，不编造综合分数）
function whyRecommendedHTML(v, taskId) {
  const caps = v.capabilities || {}
  const tierOf = (k) => (caps[k] && caps[k].tier) ? TIER[caps[k].tier] : null
  const strong = (t) => t && ['high', 'highest'].includes(t.lv)
  const reasons = []
  const coding = tierOf('coding'); if (strong(coding)) reasons.push(`编码能力强（${coding.label}）`)
  const reasoning = tierOf('reasoning'); if (strong(reasoning)) reasons.push(`推理能力强（${reasoning.label}）`)
  const agent = tierOf('agent'); if (strong(agent)) reasons.push('擅长智能体 / 工具调用')
  const knowledge = tierOf('knowledge'); if (strong(knowledge)) reasons.push('知识面广，适合问答与检索')
  const multilingual = tierOf('multilingual'); if (strong(multilingual)) reasons.push('多语言（含中文）支持好')
  if (v.vision_support) reasons.push('支持视觉输入')
  if ((v.context_window || 0) >= 128000) reasons.push(`长上下文（${ctxShort(v.context_window)}）`)
  if (v.free) reasons.push('免费可用，免信用卡')
  else if (v.input_price_per_mtok != null && v.input_price_per_mtok <= 1) reasons.push(`成本低（约 $${v.input_price_per_mtok} / M 输入）`)
  const sp = SPEED_RANK[v.speed_tier] || 2
  if (sp >= 4) reasons.push(`响应快（${SPEED_CN[v.speed_tier] || '快'}）`)
  if (v.open_weight) reasons.push('开放权重，可本地部署')
  if (!reasons.length) reasons.push('综合指标均衡，适合通用场景')
  return `<section class="detail-sec why-box"><h3>推荐理由<small>基于公开规格与加权评分：任务40% + 能力30% + 成本20% + 速度10%</small></h3>
    ${scoreBreakdownHTML(v, taskId)}
    <ul class="why-list">${reasons.map((r) => `<li><span class="ck">✓</span>${esc(r)}</li>`).join('')}</ul>
  </section>`
}

function viewModel(id) {
  const v = variantById(id)
  if (!v) return notFound('型号', id, '#providers')
  pushRecent(id)
  const p = providerOf(v)
  const f = familyOf(v)
  const caps = v.capabilities || {}
  const bars = CAP_DIMS.filter((d) => caps[d.key]).map((d) => capBar(d, caps[d.key])).join('')
  const taskName = (t) => (byId(state.tasks, 'id', t) || {}).name_cn || t
  const best = (v.best_for || []).map((t) => `<li class="ok">${esc(taskName(t))}</li>`).join('')
  const avoid = (v.avoid_for || []).map((t) => `<li class="no">${esc(taskName(t))}</li>`).join('')
  const tags = capTags(v)
  return `<div class="wrap page detail-page">
    <button class="back-link" data-back="${f ? '#family/' + encodeURIComponent(f.id) : '#provider/' + encodeURIComponent(p.id)}">← 返回</button>
    <header class="entity-head model-head" style="--brand:${esc(p.brand_color)}">
      ${logoHTML(p, 'lg')}
      <div class="eh-main">
        <span class="eyebrow"><a class="crumb" href="#provider/${encodeURIComponent(p.id)}">${esc(p.name_cn || p.name)}</a>${f ? ` · <a class="crumb" href="#family/${encodeURIComponent(f.id)}">${esc(f.name_cn || f.name || '')}</a>` : ''}</span>
        <h1>${esc(v.name_cn || v.name)}</h1>
        <div class="eh-tags">${modBadge(v)}${gradeBadge(v)}<span class="tag mono">${esc(v.model_id || v.id)}</span>${v.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div>
        <p class="lead">${esc(v.one_liner_cn || '')}</p>
        ${tags.length ? `<div class="cap-tags">${tags.map((t) => `<span class="cap-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </header>

    <div class="detail-actions">
      <button class="cmp-toggle" data-cmp="${v.id}">${inCompare(v.id) ? '✓ 已加入对比' : '＋ 加入对比'}</button>
      <button class="cmp-toggle fav-toggle" data-fav="${v.id}">${isFav(v.id) ? '★ 已收藏' : '☆ 收藏'}</button>
    </div>

    ${whyRecommendedHTML(v, state.selectedTask)}

    <section class="detail-sec">
      <h3>关键参数</h3>
      <div class="stat-strip four">${specCards(v)}</div>
    </section>

    ${paramInsight(v)}

    ${bars ? `<section class="detail-sec"><h3>能力评估<small>三档定性 · 每项标注依据，不编造分数</small></h3><div class="cap-bars">${bars}</div></section>` : ''}

    <section class="detail-sec split">
      <div class="fit-box ok-box"><h4>适合</h4><ul class="fit-list">${best || '<li class="muted">—</li>'}</ul></div>
      <div class="fit-box no-box"><h4>不适合</h4><ul class="fit-list">${avoid || '<li class="muted">—</li>'}</ul></div>
    </section>

    <section class="detail-sec"><h3>API 调用</h3>${apiBlockHTML(v)}</section>
    ${v.playground_url ? `<section class="detail-sec"><h3>在线试用</h3><div class="try-box"><a class="button primary" href="${esc(v.playground_url)}" target="_blank" rel="noopener">在官方 Playground 试用 ↗</a><p class="muted-note">仅当厂商提供公开试用入口时才显示。</p></div></section>` : ''}

    ${ecoBlock(v)}

    ${namingBlock(v)}
    ${relatedBlock(v)}

    <p class="source-line">
      ${v.source_url ? `<a class="text-link" href="${esc(v.source_url)}" target="_blank" rel="noopener">官方来源 ↗</a> · ` : ''}
      核验日期：${esc(v.verified_date || '未知')}${v.price_note ? ' · ' + esc(v.price_note) : ''}
    </p>
  </div>`
}

// ---------- 视图：最近浏览（首页区块） ----------
function recentModuleHTML() {
  const ids = getRecent()
  if (!ids.length) return ''
  const cards = ids.map(variantById).filter(Boolean).map((v) => modelCard(v, '')).join('')
  return `<section class="section wrap">
    <div class="heading"><div><span class="eyebrow">最近浏览</span><h2>你刚才看过的</h2></div><p>本地记录，刷新不丢。</p></div>
    <div class="card-grid">${cards}</div>
  </section>`
}

// ---------- 视图：对比集 ----------
function viewCompare() {
  const ids = getCompare()
  if (!ids.length) return `<div class="wrap page"><button class="back-link" data-back="#home">← 返回首页</button><div class="empty-box big"><span>✦</span><h2>对比集还是空的</h2><p>去模型详情页点「加入对比」，这里会列出你选的型号。</p></div></div>`
  const list = ids.map(variantById).filter(Boolean)
  const isMedia = list.every((v) => v.media_type)
  const head = isMedia
    ? ['型号', '模态', '分辨率 / 时长', '价格', '速度', '定位', '']
    : ['型号', '模态', '上下文', '输入 / 输出 (每 M tokens)', '速度', '推理', '编码', '']
  const row = (v) => {
    const cells = isMedia
      ? [
          `<b>${esc(v.name_cn || v.name)}</b><small>${esc(v.model_id || v.id)}</small>`,
          modBadge(v),
          esc([v.max_resolution, v.max_duration_sec ? v.max_duration_sec + 's' : null].filter(Boolean).join(' · ') || '—'),
          priceCell(v),
          esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—'),
          `<span class="cell-desc">${esc(v.one_liner_cn || '')}</span>`,
        ]
      : [
          `<b>${esc(v.name_cn || v.name)}</b><small>${esc(v.model_id || v.id)}</small>`,
          modBadge(v),
          ctxShort(v.context_window),
          priceCell(v),
          esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—'),
          tierPill(v, 'reasoning'),
          tierPill(v, 'coding'),
        ]
    return `<tr data-goto="#model/${encodeURIComponent(v.id)}">${cells.map((c) => `<td>${c}</td>`).join('')}<td class="td-go"><button class="cmp-remove" data-cmp-remove="${v.id}" aria-label="移除对比">✕</button></td></tr>`
  }
  return `<div class="wrap page">
    <button class="back-link" data-back="#home">← 返回首页</button>
    <header class="entity-head"><div class="eh-main"><span class="eyebrow">对比集</span><h1>模型对比（${list.length}）</h1><p>本地保存，刷新不丢。点行看详情，✕ 移除。</p></div></header>
    <div class="table-wrap"><table class="cmp-table">
      <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${list.map(row).join('')}</tbody>
    </table></div>
  </div>`
}

// ---------- 视图：命名解释 ----------
// ---------- 视图：托管网关 ----------
function viewGateways() {
  const gw = state.providers.filter((p) => p.category === 'gateway')
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '04 / 托管网关', title: '第三方<em>托管网关</em>', desc: '把多家厂商的模型聚合到一个 API key 下调用——统一接口、即开即用。点卡片进入对应网关的系列与型号。' })}
    <div class="gw-intro">
      <div class="gw-pros"><h4>适合你，如果…</h4><ul>
        <li>想用多家模型，但不想逐家注册、管理密钥</li>
        <li>需要 OpenAI 兼容的统一接口，切换模型只改 model 名</li>
        <li>想零成本试水（本页三家均有免费层）</li>
      </ul></div>
      <div class="gw-cons"><h4>要注意</h4><ul>
        <li>请求经第三方转发，敏感数据需评估合规</li>
        <li>免费层有限速 / 限并发，生产需升级付费</li>
        <li>模型版本与官方同步可能有延迟</li>
      </ul></div>
    </div>
    <p class="notice">本页仅收录「真·免费 API」的托管网关（可程序化调用）。各厂商自带免费模型见对应厂商页与浏览页「价格 = 免费」。</p>
    <div class="provider-grid">${gw.map(providerCard).join('')}</div>
  </div>`
}

function viewGlossary() {
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '05 / 命名词典', title: '模型名称，<em>其实有规律。</em>', desc: '不再被 Mini、Pro、Flash 搞混。快速理解型号后缀代表什么。' })}
    <div class="glossary-grid">${state.naming
      .map((i) => `<article class="glossary-card"><span class="naming-term">${esc(i.term)}</span><b>${esc(i.name_cn)}</b><p>${esc(i.description_cn)}</p><small>例：${esc(i.example)}</small></article>`)
      .join('')}</div>
  </div>`
}

function notFound(kind, id, back) {
  return `<div class="wrap page"><button class="back-link" data-back="${esc(back)}">← 返回</button>
    <div class="empty-box big"><span>✦</span><h2>未找到${esc(kind)}：${esc(id)}</h2><p>可能已下线或尚未收录。</p></div></div>`
}

// ---------- 路由 ----------
const scrollMem = new Map()
let currentKey = null
let navCount = 0

function parseHash() {
  const raw = (location.hash || '#home').replace(/^#\/?/, '')
  const slash = raw.indexOf('/')
  const name = slash === -1 ? raw : raw.slice(0, slash)
  const param = slash === -1 ? null : decodeURIComponent(raw.slice(slash + 1))
  return { name: name || 'home', param, key: raw || 'home' }
}

function render() {
  const r = parseHash()
  let html = ''
  if (r.name === 'providers') html = viewProviders()
  else if (r.name === 'provider') html = viewProvider(r.param)
  else if (r.name === 'family') html = viewFamily(r.param)
  else if (r.name === 'browse') html = viewBrowse()
  else if (r.name === 'matcher') html = viewMatcher()
  else if (r.name === 'gateways') html = viewGateways()
  else if (r.name === 'model') html = viewModel(r.param)
  else if (r.name === 'compare') html = viewCompare()
  else if (r.name === 'glossary') html = viewGlossary()
  else if (r.name === 'home') html = viewHome()
  else html = notFound('页面', r.name, '#home')

  const app = $('#app')
  app.innerHTML = html
  app.dataset.route = r.name
  currentKey = r.key
  updateCmpBadge()
  // 导航高亮
  $$('#main-nav a').forEach((a) => {
    const active = a.dataset.nav === r.name || (r.name === 'provider' && a.dataset.nav === 'providers') || (r.name === 'family' && a.dataset.nav === 'providers')
    a.classList.toggle('on', active)
    if (active) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  })
  // 滚动：恢复该路由上次位置，没有则回到顶部（瞬时，不做平滑动画）
  const y = scrollMem.get(r.key) || 0
  window.scrollTo(0, y)
}

let scrollTick = false
window.addEventListener(
  'scroll',
  () => {
    if (scrollTick) return
    scrollTick = true
    requestAnimationFrame(() => {
      if (currentKey) scrollMem.set(currentKey, window.scrollY)
      scrollTick = false
    })
  },
  { passive: true },
)
window.addEventListener('hashchange', () => {
  navCount++
  render()
})

// ---------- 局部刷新 ----------
function refresh(sel, html) {
  const el = $(sel)
  if (el) el.innerHTML = html
}
function refreshProviderGrid() {
  refresh('#provider-grid', providerGridHTML())
}
function refreshBrowse() {
  const el = document.getElementById('browse-results')
  if (el) el.innerHTML = state.browseView === 'table' ? browseTableViewHTML() : browseResultsHTML()
}

// ---------- 事件 ----------
function bindGlobalEvents() {
  document.addEventListener('input', (e) => {
    const t = e.target
    if (t.id === 'provider-search') { state.providerSearch = t.value; refreshProviderGrid() }
    else if (t.id === 'task-input') { homeConditions = extractConditions(t.value); renderHomeChips() }
    else if (t.id === 'browse-search') {
      state.browseSearch = t.value
      applySearchQuery(t.value)
      pushRecentSearch(t.value)
      saveBrowseFilters()
      // 同步筛选面板分段按钮高亮（结构化搜索改了 state，但筛选面板未整体重渲染）
      syncSeg('browseModality', state.browseModality)
      syncSeg('browsePrice', state.browsePrice)
      syncSeg('browseBill', state.browseBill)
      refreshBrowse()
    }
  })
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'task-form') { e.preventDefault(); startMatchFromHome() }
  })
  document.addEventListener('change', (e) => {
    const sortSel = e.target.closest('[data-sort]')
    if (sortSel) {
      state[sortSel.dataset.sort] = sortSel.value
      const r = parseHash()
      if (r.name === 'family') refresh('#family-table', familyTableHTML(familyById(r.param)))
    }
  })
  document.addEventListener('click', (e) => {
    // 对比表「免费信息点」：点击展开/收起说明，且不触发整行跳转
    const freeInfo = e.target.closest('.free-info')
    if (freeInfo) {
      e.preventDefault()
      freeInfo.classList.toggle('active')
      return
    }
    // 加入 / 移出对比集（须位于 [data-goto] 行跳转之前，避免对比表内移除按钮触发整行跳转）
    const cmpBtn = e.target.closest('[data-cmp]')
    if (cmpBtn) {
      const id = cmpBtn.dataset.cmp
      const on = toggleCompare(id).includes(id)
      cmpBtn.classList.toggle('on', on)
      cmpBtn.textContent = on ? '✓ 已加入对比' : '＋ 加入对比'
      updateCmpBadge()
      return
    }
    const cmpRemove = e.target.closest('[data-cmp-remove]')
    if (cmpRemove) {
      e.preventDefault()
      toggleCompare(cmpRemove.dataset.cmpRemove)
      render()
      updateCmpBadge()
      return
    }
    // 首页任务输入：常搜 chip 填充 + 条件 chip 移除
    const popTask = e.target.closest('[data-pop-task]')
    if (popTask) {
      const input = document.getElementById('task-input')
      if (input) { input.value = popTask.dataset.popTask; homeConditions = extractConditions(input.value); renderHomeChips(); input.focus() }
      return
    }
    const rmChip = e.target.closest('[data-rm-chip]')
    if (rmChip) {
      const i = Number(rmChip.dataset.rmChip)
      homeConditions = homeConditions.filter((_, idx) => idx !== i)
      renderHomeChips()
      return
    }
    // V4 首页场景芯片 → 预选任务进入任务选择器（与 matcher 的 data-task 区分，避免冲突死分支）
    const sceneChip = e.target.closest('[data-scene-task]')
    if (sceneChip) {
      state.selectedTask = sceneChip.dataset.task
      if (parseHash().name === 'matcher') render()
      else location.hash = 'matcher'
      return
    }
    // V4 首页成本入口 → 预置价格筛选进入浏览页
    const costChip = e.target.closest('[data-cost]')
    if (costChip) {
      state.browsePrice = costChip.dataset.cost
      if (parseHash().name === 'browse') { refreshBrowse(); document.querySelectorAll('[data-seg="browsePrice"] button').forEach((b) => b.classList.toggle('selected', b.dataset.value === costChip.dataset.cost)) }
      else location.hash = 'browse'
      return
    }
    // Phase 2：收藏切换
    const favBtn = e.target.closest('[data-fav]')
    if (favBtn) {
      const id = favBtn.dataset.fav
      const fav = toggleFav(id)
      const on = fav.includes(id)
      favBtn.textContent = on ? '★ 已收藏' : '☆ 收藏'
      favBtn.classList.toggle('on', on)
      if (parseHash().name === 'browse' && state.favOnly) refreshBrowse()
      return
    }
    // Phase 2：只看收藏开关
    const favOnlyBtn = e.target.closest('[data-fav-only]')
    if (favOnlyBtn) {
      state.favOnly = !state.favOnly
      favOnlyBtn.classList.toggle('on', state.favOnly)
      favOnlyBtn.setAttribute('aria-pressed', String(state.favOnly))
      saveBrowseFilters()
      refreshBrowse()
      return
    }
    // Phase 2：最近搜索点击回填输入框
    const rs = e.target.closest('[data-rec-search]')
    if (rs) {
      const input = document.getElementById('task-input')
      if (input) { input.value = rs.dataset.recSearch; homeConditions = extractConditions(input.value); renderHomeChips() }
      return
    }
    // 返回
    const back = e.target.closest('[data-back]')
    if (back) {
      if (navCount > 0) history.back()
      else location.hash = back.dataset.back
      return
    }
    // 表格行跳转
    const rowGo = e.target.closest('[data-goto]')
    if (rowGo) {
      location.hash = rowGo.dataset.goto
      return
    }
    // 分段控件（模态 / 国家 / 预算 / 速度 / 排序）
    const segBtn = e.target.closest('.segmented [data-value]')
    if (segBtn) {
      const group = segBtn.closest('[data-seg]')?.dataset.seg
      if (group) {
        state[group] = segBtn.dataset.value
        segBtn.parentElement.querySelectorAll('button').forEach((b) => b.classList.remove('selected'))
        segBtn.classList.add('selected')
        if (group === 'providerFilter' || group === 'providerModality') refreshProviderGrid()
        else if (group.startsWith('browse')) { refreshBrowse(); saveBrowseFilters() }
        else if (group === 'budget' || group === 'speed') refresh('#recommendation', recommendationHTML())
      }
      return
    }
    // 能力 / 硬性条件 chip
    const capChip = e.target.closest('[data-cap]')
    if (capChip) {
      const k = capChip.dataset.cap
      state.browseCaps = state.browseCaps.includes(k) ? state.browseCaps.filter((x) => x !== k) : [...state.browseCaps, k]
      capChip.classList.toggle('on')
      refreshBrowse(); saveBrowseFilters()
      return
    }
    const traitChip = e.target.closest('[data-trait]')
    if (traitChip) {
      const k = traitChip.dataset.trait
      state.browseTraits = state.browseTraits.includes(k) ? state.browseTraits.filter((x) => x !== k) : [...state.browseTraits, k]
      traitChip.classList.toggle('on')
      refreshBrowse(); saveBrowseFilters()
      return
    }
    if (e.target.closest('[data-reset-filters]')) {
      state.browseCaps = []
      state.browseTraits = []
      state.browseModality = 'all'
      state.browseSort = 'match'
      state.browsePrice = 'all'
      state.browseBill = 'all'
      state.minContext = 0
      state.browseSearch = ''
      state.browseSearchClean = ''
      state.favOnly = false
      saveBrowseFilters()
      render()
      return
    }
    // 浏览页视图切换（卡片 / 表格）
    const viewBtn = e.target.closest('[data-view]')
    if (viewBtn) {
      state.browseView = viewBtn.dataset.view
      viewBtn.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('selected', b.dataset.view === state.browseView))
      refreshBrowse(); saveBrowseFilters()
      return
    }
    // 匹配器任务
    const task = e.target.closest('[data-task]')
    if (task) {
      state.selectedTask = task.dataset.task
      $$('[data-task]').forEach((b) => b.classList.remove('selected'))
      task.classList.add('selected')
      refresh('#recommendation', recommendationHTML())
      return
    }
    // 代码 tab
    const codeTab = e.target.closest('[data-code-tab]')
    if (codeTab) {
      const block = codeTab.closest('.api-block')
      block.querySelectorAll('[data-code-tab]').forEach((b) => b.classList.remove('selected'))
      codeTab.classList.add('selected')
      block.querySelectorAll('.code-block').forEach((pre) => pre.classList.toggle('hidden', pre.dataset.code !== codeTab.dataset.codeTab))
      return
    }
    // 复制
    const copyBtn = e.target.closest('[data-copy]')
    if (copyBtn) {
      const block = copyBtn.closest('.api-block')
      const visible = block.querySelector('.code-block:not(.hidden)')
      if (visible && navigator.clipboard) {
        navigator.clipboard.writeText(visible.textContent).then(
          () => {
            copyBtn.textContent = '已复制'
            setTimeout(() => (copyBtn.textContent = '复制'), 1500)
          },
          () => (copyBtn.textContent = '复制失败'),
        )
      }
    }
  })
}

loadData().catch((err) => {
  console.error(err)
  $('#app').innerHTML = `<div class="wrap page"><div class="empty-box big"><span>✦</span><h2>数据加载失败</h2><p>请通过本地静态服务器启动，例如 <code>python3 -m http.server 8848</code>。</p></div></div>`
})
