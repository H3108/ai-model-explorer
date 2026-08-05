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
const SPEED_RANK = { slow: 1, fast: 2, faster: 3, fastest: 4 }
const SPEED_CN = { slow: '较慢', fast: '快', faster: '很快', fastest: '极快' }
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
  // 厂商列表
  providerFilter: 'all', providerModality: 'all', providerSearch: '',
  // 系列页
  familySort: 'default',
  // 浏览页
  browseTab: 'capability', browseModality: 'all', browseCaps: [], browseTraits: [], browseSort: 'match', browsePrice: 'all',
  browseTask: null,
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
  state.selectedTask = state.tasks[0]?.id || null
  state.browseTask = state.tasks[0]?.id || null
  bindGlobalEvents()
  render()
}

// ---------- 查询 ----------
const byId = (arr, key, value) => arr.find((i) => i[key] === value) || null
const providerById = (id) => byId(state.providers, 'id', id) || {}
const familyById = (id) => byId(state.families, 'id', id) || {}
const variantById = (id) => byId(state.variants, 'id', id)
const variantsOfProvider = (pid) => state.variants.filter((v) => v.provider_id === pid)
const familiesOfProvider = (pid) => state.families.filter((f) => f.provider_id === pid)
const variantsOfFamily = (fid) => state.variants.filter((v) => v.family_id === fid)
const providerOf = (v) => providerById(v.provider_id)
const familyOf = (v) => familyById(v.family_id)
const modalityOf = (v) => (v.media_type === 'video' ? 'video' : v.media_type === 'image' ? 'image' : 'text')

// ---------- 格式化 ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
function priceValue(v) {
  if (v.media_pricing && v.media_pricing.price != null) return v.media_pricing.price * 40
  if (v.input_price_per_mtok == null) return Number.MAX_SAFE_INTEGER
  return (v.input_price_per_mtok + (v.output_price_per_mtok ?? v.input_price_per_mtok)) / 2
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
  if (strong(caps.coding)) tags.push('Coding')
  if (strong(caps.reasoning)) tags.push('Reasoning')
  if (strong(caps.agent)) tags.push('Agent')
  if ((v.context_window || 0) >= 128000) tags.push('Long Context')
  if (v.vision_support || v.media_type) tags.push('Multimodal')
  if (p.country === 'CN') tags.push('中文优化')
  if (v.open_weight) tags.push('Open Weight')
  if (v.input_price_per_mtok != null && v.input_price_per_mtok <= 1) tags.push('Low Cost')
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
    <div class="mc-top">${logoHTML(p, 'sm')}${modBadge(v)}${free}${extra}</div>
    <b class="mc-name">${esc(v.name_cn || v.name)}</b>
    <small class="mc-from">${esc(p.name_cn || p.name)} · ${esc(f.name_cn || f.name || '')}</small>
    <p class="mc-desc">${esc(v.one_liner_cn || '')}</p>
    <div class="mc-meta">${meta}</div>
  </a>`
}
function emptyBox(text) {
  return `<div class="empty-box"><span>✦</span><p>${esc(text)}</p></div>`
}

// ---------- 视图：首页 ----------
function viewHome() {
  const scoreOf = {}
  state.recommendations.forEach((r) => r.model_ids.forEach((m) => (scoreOf[m.id] = (scoreOf[m.id] || 0) + m.score)))
  const hot = Object.entries(scoreOf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => variantById(id))
    .filter(Boolean)
  const mix = modalityMix(state.variants)
  return `
  <section class="hero wrap">
    <div class="hero-copy">
      <span class="eyebrow">AI MODEL SELECTION SYSTEM</span>
      <h1>找到适合你的<br><em>AI 模型。</em></h1>
      <p>不需要研究几十个模型名称。告诉我你的任务，系统自动推荐，并解释为什么。</p>
      <div class="hero-actions">
        <a class="button primary" href="#matcher">我要选择模型 <span>↘</span></a>
        <a class="button ghost" href="#browse">按能力浏览 →</a>
      </div>
      <div class="home-search"><input id="home-search" type="search" placeholder="搜索模型或厂商，如 GPT-5、DeepSeek、视频生成…" autocomplete="off" value="${esc(state.providerSearch)}"></div>
      <div class="mod-legend">${mix}</div>
    </div>
    <div class="hero-visual">
      <div class="orbit orbit-a"></div><div class="orbit orbit-b"></div>
      <div class="visual-core"><b>30</b><small>SECONDS<br>TO CHOOSE</small></div>
      <div class="float-card f-one"><i class="dot green"></i><b>任务</b><small>写代码 Agent</small></div>
      <div class="float-card f-two"><i class="dot orange"></i><b>推荐 TOP 3</b><small>理由清晰可见</small></div>
      <div class="float-card f-three"><i class="dot purple"></i><b>模型族</b><small>系列 → 型号</small></div>
    </div>
  </section>

  <section class="proof wrap">
    <div><strong>${state.providers.length}</strong><span>主要厂商</span></div>
    <div><strong>${state.families.length}</strong><span>模型系列</span></div>
    <div><strong>${state.variants.length}</strong><span>具体型号</span></div>
    <div><strong>30s</strong><span>找到答案</span></div>
  </section>

  <section class="section wrap">
    <div class="heading"><div><span class="eyebrow">三条路径</span><h2>你想怎么开始？</h2></div><p>三种入口对应三种心态：认厂商、挑能力、说需求。</p></div>
    <div class="entry-grid">
      <a class="entry-card" href="#providers"><span class="entry-ico">◎</span><b>按厂商浏览</b><p>厂商 → 系列 → 型号，理解每家在做什么。</p><i>${state.providers.length} 家厂商 →</i></a>
      <a class="entry-card" href="#browse"><span class="entry-ico">◈</span><b>按能力 / 场景</b><p>勾选你要的能力（推理、编码、长上下文…），实时匹配。</p><i>${CAP_DIMS.length + TRAITS.length} 个维度 →</i></a>
      <a class="entry-card" href="#matcher"><span class="entry-ico">✦</span><b>任务选择器</b><p>说出任务 + 预算 + 速度偏好，直接给 TOP 推荐。</p><i>${state.tasks.length} 类任务 →</i></a>
    </div>
  </section>

  <section class="section wrap">
    <div class="heading"><div><span class="eyebrow">热门模型</span><h2>大家都在看的模型</h2></div><p>按各场景推荐评分聚合，挑出当前最受关注的型号。</p></div>
    <div class="card-grid">${hot.map((v) => modelCard(v, `<span class="hot-flag">热度 ${scoreOf[v.id]}</span>`)).join('')}</div>
  </section>`
}

// ---------- 视图：厂商地图 ----------
function providerCard(p) {
  const vs = variantsOfProvider(p.id)
  const fs = familiesOfProvider(p.id)
  const region = { US: '美国', CN: '中国', FR: '法国', DE: '德国', GB: '英国' }[p.country] || p.country || '其他'
  return `<a class="provider-card" href="#provider/${encodeURIComponent(p.id)}" style="--brand:${esc(p.brand_color || '#173e35')}">
    <div class="pc-top">${logoHTML(p, 'md')}<div class="pc-tags"><span class="tag">${esc(region)}</span>${p.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div></div>
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
    const f = state.providerFilter
    if (f === 'US' && p.country !== 'US') return false
    if (f === 'CN' && p.country !== 'CN') return false
    if (f === 'open' && p.open_weight !== true) return false
    const vs = variantsOfProvider(p.id)
    if (state.providerModality !== 'all' && !vs.some((v) => modalityOf(v) === state.providerModality)) return false
    if (!q) return true
    if ((p.name_cn || p.name).toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)) return true
    return vs.some((v) => `${v.name} ${v.name_cn} ${v.one_liner_cn || ''}`.toLowerCase().includes(q))
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
    ${pageHead({ eyebrow: '01 / PROVIDER MAP', title: '先认识厂商，<em>再理解模型。</em>', desc: '从公司定位开始浏览，顺着「厂商 → 系列 → 型号」找到适合你的选择。' })}
    <div class="toolbar">
      <input id="provider-search" type="search" placeholder="搜索厂商或模型…" autocomplete="off" value="${esc(state.providerSearch)}">
      <div class="toolbar-segs">
        ${seg('providerFilter', state.providerFilter, 'providerFilter', [['all', '全部'], ['US', '美国'], ['CN', '中国'], ['open', '开源生态']])}
        ${seg('providerModality', state.providerModality, 'providerModality', [['all', '全部模态'], ['text', '文本'], ['image', '图像'], ['video', '视频']])}
      </div>
    </div>
    <p class="notice">数据于 2026-08-05 联网核实，价格与能力以厂商官方为准；未公开项保持空缺，不做估算。</p>
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
        <div class="eh-tags">${modalityMix(vs)}${p.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div>
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
      ${statCard('接口风格', esc(p.api_style || '—'))}
    </div>
    <h2 class="sec-title">模型系列</h2>
    <p class="sec-sub">系列是理解一家厂商的最短路径：同一系列共享定位与训练思路，差别只在档位。</p>
    <div class="family-grid">${fs.length ? fs.map(famCard).join('') : emptyBox('该厂商暂无收录系列。')}</div>
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
          priceLabel(v),
          esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—'),
          `<span class="cell-desc">${esc(v.one_liner_cn || '')}</span>`,
        ]
      : [
          `<b>${esc(v.name_cn || v.name)}</b><small>${esc(v.model_id || v.id)}</small>`,
          modBadge(v),
          ctxShort(v.context_window),
          priceLabel(v),
          esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—'),
          tierPill(v, 'reasoning'),
          tierPill(v, 'coding'),
        ]
    return `<tr data-goto="#model/${encodeURIComponent(v.id)}">${cells.map((c) => `<td>${c}</td>`).join('')}<td class="td-go">→</td></tr>`
  }
  return `<div class="table-wrap"><table class="cmp-table">
    <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
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
        <div class="eh-tags">${modalityMix(list)}<span class="tag">${list.length} 个型号</span></div>
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
  if (state.browsePrice === 'free') list = list.filter((v) => v.free)
  else if (state.browsePrice === 'low') list = list.filter((v) => v.free !== true && v.input_price_per_mtok != null && v.input_price_per_mtok <= 1)
  else if (state.browsePrice === 'standard') list = list.filter((v) => v.free !== true && v.input_price_per_mtok != null && v.input_price_per_mtok > 1)
  state.browseTraits.forEach((k) => {
    const t = TRAITS.find((x) => x.key === k)
    if (t) list = list.filter(t.test)
  })
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
      const badge = state.browseCaps.length || state.browseTraits.length ? `<span class="match-flag">匹配 ${score}%</span>` : ''
      const card = modelCard(v, badge)
      const hits = hitLabel(v)
      return hits ? card.replace('</a>', `<div class="mc-hits">${hits}</div></a>`) : card
    })
    .join('')}</div>`
}
function browseTaskResultsHTML() {
  const task = byId(state.tasks, 'id', state.browseTask)
  const rec = state.recommendations.find((r) => r.task_id === state.browseTask)
  if (!task) return emptyBox('请选择一个场景。')
  if (!rec) return emptyBox('该场景暂无推荐数据。')
  const rows = rec.model_ids
    .map((m) => ({ m, v: variantById(m.id) }))
    .filter((x) => x.v)
    .sort((a, b) => b.m.score - a.m.score)
  return `<div class="task-result">
    <div class="tr-head"><div><span class="eyebrow">${esc(task.name_cn)}</span><h3>${esc(rec.label)}</h3></div><span class="match-badge">TOP ${rows.length}</span></div>
    ${rows
      .map(
        ({ m, v }, i) => `<a class="result-row" href="#model/${encodeURIComponent(v.id)}">
      <span class="rank">0${i + 1}</span>
      ${logoHTML(providerOf(v), 'sm')}
      <span class="result-main"><b>${esc(v.name_cn || v.name)}</b><small>${esc(providerOf(v).name_cn || '')} · ${esc(familyOf(v).name_cn || '')}</small></span>
      ${modBadge(v)}${v.free ? ' <span class="free-badge sm">免费</span>' : ''}
      <span class="result-reason">${esc(m.reason)}</span>
      <span class="score-pill">${m.score}/5</span>
      <span class="arrow">→</span>
    </a>`,
      )
      .join('')}
    ${rec.note ? `<p class="disclaimer">${esc(rec.note)}</p>` : ''}
  </div>`
}
function viewBrowse() {
  const capChip = (d) =>
    `<button class="chip ${state.browseCaps.includes(d.key) ? 'on' : ''}" data-cap="${d.key}">${d.cn}<span>${d.en}</span></button>`
  const traitChip = (t) =>
    `<button class="chip ${state.browseTraits.includes(t.key) ? 'on' : ''}" data-trait="${t.key}">${t.cn}<span>${t.hint}</span></button>`
  const modBtn = (k, label) =>
    `<button class="${state.browseModality === k ? 'selected' : ''}" data-value="${k}">${label}</button>`
  const priceBtn = (k, label) =>
    `<button class="${state.browsePrice === k ? 'selected' : ''}" data-value="${k}">${label}</button>`
  const taskCard = (t) =>
    `<button class="task-tile ${state.browseTask === t.id ? 'on' : ''}" data-browse-task="${t.id}"><span>${t.icon || '◎'}</span><b>${esc(t.name_cn)}</b><small>${esc(t.description_cn)}</small></button>`
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '02 / BROWSE', title: '按<em>能力</em>或<em>场景</em>找模型', desc: '左边勾选你需要的能力，右边实时给出匹配结果；或者直接切到「按场景」，用大白话选。' })}
    <div class="tabs">
      <button class="${state.browseTab === 'capability' ? 'on' : ''}" data-tab="capability">按能力匹配</button>
      <button class="${state.browseTab === 'scene' ? 'on' : ''}" data-tab="scene">按场景浏览</button>
    </div>
    <div class="gateway-note">
      <span class="gn-title">免费 API 网关</span>
      <p>这些厂商把多家模型聚合成<strong>一个免费 API key</strong>调用（免信用卡）：</p>
      <div class="gn-chips">${state.providers.filter((p) => p.category === 'gateway').map((p) => `<a class="gn-chip" href="#provider/${p.id}">${esc(p.name_cn || p.name)}</a>`).join('')}</div>
      <small>在上方「价格」选 <b>免费</b> 即可看到它们；外加大批厂商自带的免费模型。</small>
    </div>
    <div id="browse-body">${state.browseTab === 'capability'
      ? `<div class="browse-layout">
          <aside class="filter-panel">
            <div class="fp-block"><h4>模态</h4><div class="segmented" data-seg="browseModality">${modBtn('all', '全部')}${modBtn('text', '文本')}${modBtn('image', '图像')}${modBtn('video', '视频')}</div></div>
            <div class="fp-block"><h4>价格<small>按付费方式筛选</small></h4><div class="segmented" data-seg="browsePrice">${priceBtn('all', '全部')}${priceBtn('free', '免费')}${priceBtn('low', '低成本')}${priceBtn('standard', '标准价')}</div></div>
            <div class="fp-block"><h4>能力维度<small>多选，取平均匹配度</small></h4><div class="chip-wrap">${CAP_DIMS.map(capChip).join('')}</div></div>
            <div class="fp-block"><h4>硬性条件<small>多选，逐条过滤</small></h4><div class="chip-wrap">${TRAITS.map(traitChip).join('')}</div></div>
            <div class="fp-block"><h4>排序</h4><div class="segmented" data-seg="browseSort"><button class="${state.browseSort === 'match' ? 'selected' : ''}" data-value="match">匹配度</button><button class="${state.browseSort === 'price' ? 'selected' : ''}" data-value="price">价格</button><button class="${state.browseSort === 'context' ? 'selected' : ''}" data-value="context">上下文</button></div></div>
            <button class="button ghost small" data-reset-filters>清空筛选</button>
          </aside>
          <div class="browse-results" id="browse-results">${browseResultsHTML()}</div>
        </div>`
      : `<div class="scene-layout">
          <div class="task-tiles">${state.tasks.map(taskCard).join('')}</div>
          <div id="scene-results">${browseTaskResultsHTML()}</div>
        </div>`}</div>
  </div>`
}

// ---------- 视图：任务选择器 ----------
function rankCandidates(ids) {
  const arr = ids.map((r) => ({ r, v: variantById(r.id) })).filter((x) => x.v)
  const speedOf = (v) => SPEED_RANK[v.speed_tier] ?? 2
  if (state.budget === 'low') arr.sort((a, b) => priceValue(a.v) - priceValue(b.v))
  else if (state.budget === 'high' || state.speed === 'quality') arr.sort((a, b) => b.r.score - a.r.score)
  else if (state.speed === 'fast') arr.sort((a, b) => speedOf(b.v) - speedOf(a.v))
  else arr.sort((a, b) => b.r.score - a.r.score)
  return arr
}
function recommendationHTML() {
  const task = byId(state.tasks, 'id', state.selectedTask)
  const rec = state.recommendations.find((r) => r.task_id === state.selectedTask)
  if (!task || !rec) return `<div class="empty-box"><span>✦</span><p>该任务暂无推荐数据。</p></div>`
  const ranked = rankCandidates(rec.model_ids)
  const hint =
    state.budget === 'low'
      ? '已按「尽量省钱」排序（价格优先）'
      : state.speed === 'fast'
        ? '已按「速度优先」排序'
        : state.budget === 'high' || state.speed === 'quality'
          ? '已按「质量优先」排序（推荐评分）'
          : '按推荐评分排序'
  return `<div class="tr-head"><div><span class="eyebrow">RECOMMENDATION</span><h3>${esc(rec.label)}</h3></div><span class="match-badge">TOP ${ranked.length}</span></div>
  ${ranked
    .map(
      ({ r, v }, i) => `<a class="result-row" href="#model/${encodeURIComponent(v.id)}">
    <span class="rank">0${i + 1}</span>
    ${logoHTML(providerOf(v), 'sm')}
    <span class="result-main"><b>${esc(v.name_cn || v.name)}</b><small>${esc(providerOf(v).name_cn || '')} · ${esc(familyOf(v).name_cn || '')}</small></span>
    ${modBadge(v)}${v.free ? ' <span class="free-badge sm">免费</span>' : ''}
    <span class="result-reason">${esc(r.reason)}</span>
    <span class="score-pill">${r.score}/5</span>
    <span class="arrow">→</span>
  </a>`,
    )
    .join('')}
  <p class="disclaimer">${hint}${rec.note ? ' · ' + esc(rec.note) : ''}</p>`
}
function viewMatcher() {
  const taskBtn = (t) =>
    `<button class="task-option ${state.selectedTask === t.id ? 'selected' : ''}" data-task="${t.id}"><span>${t.icon || '◎'}</span><b>${esc(t.name_cn)}</b><small>${esc(t.description_cn)}</small></button>`
  const segBtn = (group, cur, val, label) =>
    `<button class="${cur === val ? 'selected' : ''}" data-value="${val}">${label}</button>`
  return `<div class="matcher-page">
    <div class="wrap page">
      ${pageHead({ eyebrow: '03 / TASK MATCHER', title: '告诉我，你想做什么？', desc: '选择任务、预算和偏好，得到带理由的推荐列表。' })}
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
    return { note: `该模型通过官方平台 / API 调用，无统一 SDK 示例。请参考：${docs}${p.api_base_url ? ' · Base URL：<code>' + esc(p.api_base_url) + '</code>' : ''}。` }
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
function apiBlockHTML(v) {
  const p = providerOf(v)
  const base = p.api_base_url || 'http://localhost:8000/v1'
  const ex = codeExamples(v)
  const facts = `<div class="api-facts">
    <div class="api-fact"><b>Base URL</b><code>${esc(p.api_base_url || '（自托管）')}</code></div>
    <div class="api-fact"><b>Model ID</b><code>${esc(v.model_id || v.id)}</code></div>
    <div class="api-fact"><b>接口风格</b><code>${esc(p.api_style || '—')}</code></div>
  </div>`
  if (ex.note) return `<div class="api-block">${facts}<p class="muted">${ex.note}</p></div>`
  const note = ex.isLocal
    ? '<p class="muted">开放权重模型：将 Base URL 换成你自托管的推理服务（vLLM / Ollama 默认监听 <code>http://localhost:8000/v1</code>）。</p>'
    : ''
  const tab = (label, key) => `<button class="code-tab${key === 'py' ? ' selected' : ''}" data-code-tab="${key}">${label}</button>`
  const pre = (key, code) => `<pre class="code-block${key === 'py' ? '' : ' hidden'}" data-code="${key}"><code>${esc(code)}</code></pre>`
  return `<div class="api-block">${facts}${note}
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
      statCard('单价', v.free ? '免费' : (m.price != null ? priceLabel(v) : '未公开'), v.free ? (v.free_note || '') : (m.note || '')),
      statCard('速度档', esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—')),
      statCard('开放权重', v.open_weight ? '是' : '否'),
      statCard('发布', esc(v.release_date || '—')),
      v.free_note ? statCard('获取方式', esc(v.free_note)) : '',
    ].join('')
  }
  return [
    statCard('上下文窗口', ctxShort(v.context_window), v.context_window ? v.context_window.toLocaleString() + ' tokens' : ''),
    statCard('最大输出', v.max_output_tokens ? ctxShort(v.max_output_tokens) : '—', v.max_output_tokens ? v.max_output_tokens.toLocaleString() + ' tokens' : ''),
    statCard('输入价格', v.free ? '免费' : (v.input_price_per_mtok == null ? '未公开' : `${cur(v.currency)}${v.input_price_per_mtok}`), '每百万 tokens'),
    statCard('输出价格', v.free ? '免费' : (v.output_price_per_mtok == null ? '未公开' : `${cur(v.currency)}${v.output_price_per_mtok}`), '每百万 tokens'),
    statCard('速度档', esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—')),
    statCard('视觉输入', v.vision_support ? '支持' : '不支持'),
    statCard('参数规模', esc(v.params || '未公开')),
    statCard('开放权重', v.open_weight ? '是' : '否'),
    v.free ? statCard('免费说明', esc(v.free_note || '免费可用')) : (v.free_note ? statCard('获取方式', esc(v.free_note)) : ''),
  ].join('')
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
function viewModel(id) {
  const v = variantById(id)
  if (!v) return notFound('型号', id, '#providers')
  const p = providerOf(v)
  const f = familyOf(v)
  const caps = v.capabilities || {}
  const bars = CAP_DIMS.filter((d) => caps[d.key]).map((d) => capBar(d, caps[d.key])).join('')
  const taskName = (t) => (byId(state.tasks, 'id', t) || {}).name_cn || t
  const best = (v.best_for || []).map((t) => `<li class="ok">${esc(taskName(t))}</li>`).join('')
  const avoid = (v.avoid_for || []).map((t) => `<li class="no">${esc(taskName(t))}</li>`).join('')
  const tags = capTags(v)
  return `<div class="wrap page detail-page">
    <button class="back-link" data-back="#family/${encodeURIComponent(v.family_id)}">← 返回</button>
    <header class="entity-head model-head" style="--brand:${esc(p.brand_color)}">
      ${logoHTML(p, 'lg')}
      <div class="eh-main">
        <span class="eyebrow"><a class="crumb" href="#provider/${encodeURIComponent(p.id)}">${esc(p.name_cn || p.name)}</a> · <a class="crumb" href="#family/${encodeURIComponent(f.id)}">${esc(f.name_cn || f.name || '')}</a></span>
        <h1>${esc(v.name_cn || v.name)}</h1>
        <div class="eh-tags">${modBadge(v)}<span class="tag mono">${esc(v.model_id || v.id)}</span>${v.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div>
        <p class="lead">${esc(v.one_liner_cn || '')}</p>
        ${tags.length ? `<div class="cap-tags">${tags.map((t) => `<span class="cap-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </header>

    <section class="detail-sec">
      <h3>关键参数</h3>
      <div class="stat-strip four">${specCards(v)}</div>
    </section>

    ${bars ? `<section class="detail-sec"><h3>能力评估<small>三档定性 · 每项标注依据，不编造分数</small></h3><div class="cap-bars">${bars}</div></section>` : ''}

    <section class="detail-sec split">
      <div class="fit-box ok-box"><h4>适合</h4><ul class="fit-list">${best || '<li class="muted">—</li>'}</ul></div>
      <div class="fit-box no-box"><h4>不适合</h4><ul class="fit-list">${avoid || '<li class="muted">—</li>'}</ul></div>
    </section>

    <section class="detail-sec"><h3>API 调用</h3>${apiBlockHTML(v)}</section>

    ${namingBlock(v)}
    ${relatedBlock(v)}

    <p class="source-line">
      ${v.source_url ? `<a class="text-link" href="${esc(v.source_url)}" target="_blank" rel="noopener">官方来源 ↗</a> · ` : ''}
      核验日期：${esc(v.verified_date || '未知')}${v.price_note ? ' · ' + esc(v.price_note) : ''}
    </p>
  </div>`
}

// ---------- 视图：命名解释 ----------
function viewGlossary() {
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '04 / NAME GLOSSARY', title: '模型名称，<em>其实有规律。</em>', desc: '不再被 Mini、Pro、Flash 搞混。快速理解型号后缀代表什么。' })}
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
  else if (r.name === 'model') html = viewModel(r.param)
  else if (r.name === 'glossary') html = viewGlossary()
  else html = viewHome()

  const app = $('#app')
  app.innerHTML = html
  app.dataset.route = r.name
  currentKey = r.key
  // 导航高亮
  $$('#main-nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === r.name || (r.name === 'provider' && a.dataset.nav === 'providers') || (r.name === 'family' && a.dataset.nav === 'providers')))
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
  if (state.browseTab === 'capability') refresh('#browse-results', browseResultsHTML())
  else refresh('#scene-results', browseTaskResultsHTML())
}

// ---------- 事件 ----------
function bindGlobalEvents() {
  document.addEventListener('input', (e) => {
    const t = e.target
    if (t.id === 'provider-search' || t.id === 'home-search') {
      state.providerSearch = t.value
      if (t.id === 'home-search') return
      refreshProviderGrid()
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'home-search') {
      location.hash = 'providers'
    }
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
        else if (group.startsWith('browse')) refreshBrowse()
        else if (group === 'budget' || group === 'speed') refresh('#recommendation', recommendationHTML())
      }
      return
    }
    // 浏览页 tab
    const tab = e.target.closest('[data-tab]')
    if (tab) {
      state.browseTab = tab.dataset.tab
      render()
      return
    }
    // 能力 / 硬性条件 chip
    const capChip = e.target.closest('[data-cap]')
    if (capChip) {
      const k = capChip.dataset.cap
      state.browseCaps = state.browseCaps.includes(k) ? state.browseCaps.filter((x) => x !== k) : [...state.browseCaps, k]
      capChip.classList.toggle('on')
      refreshBrowse()
      return
    }
    const traitChip = e.target.closest('[data-trait]')
    if (traitChip) {
      const k = traitChip.dataset.trait
      state.browseTraits = state.browseTraits.includes(k) ? state.browseTraits.filter((x) => x !== k) : [...state.browseTraits, k]
      traitChip.classList.toggle('on')
      refreshBrowse()
      return
    }
    if (e.target.closest('[data-reset-filters]')) {
      state.browseCaps = []
      state.browseTraits = []
      state.browseModality = 'all'
      state.browseSort = 'match'
      state.browsePrice = 'all'
      render()
      return
    }
    // 场景 tile
    const bt = e.target.closest('[data-browse-task]')
    if (bt) {
      state.browseTask = bt.dataset.browseTask
      $$('[data-browse-task]').forEach((b) => b.classList.remove('on'))
      bt.classList.add('on')
      refresh('#scene-results', browseTaskResultsHTML())
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
