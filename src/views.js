// AI Model Explorer — 视图层：各路由页面与页面内构件（不含路由与全局事件）
import { TIER, CAP_DIMS, TRAITS, SPEED_RANK, SPEED_CN, API_STYLE_CN } from './constants.js'
import {
  state, byId, providerById, variantById, variantsOfProvider, familiesOfProvider, variantsOfFamily,
  providerOf, familyOf, modalityOf, variantMatches,
  getRecent, getCompare, getFav, inCompare, isFav, pushRecent, pushRecentSearch, recentSearchHTML,
} from './store.js'
import {
  esc, ctxShort, priceValue, priceCell, logoHTML, catBadge, modBadge, modalityMix, capTags,
  pageHead, statCard, capBar, gradeBadge, modelCard, emptyBox, recommendedModels,
  versionBlockHTML, namingBlock, relatedBlock, ecoBlock, apiBlockHTML, specCards, paramInsight,
} from './ui.js'
import { extractConditions, capSum, fitScore, whyRecommendedHTML, matchModels, recommendationHTML } from './search.js'

// ---------- 首页模块：任务输入 / 精选推荐 / 信任层 ----------
// 常搜示例（点击填入输入框并触发结构化提取，作为 Task Templates 输入助手）
export const HOME_POPULAR = [
  { label: '编码', sample: '我想写代码，要编码能力强的模型' },
  { label: '推理', sample: '复杂数学和逻辑推理任务' },
  { label: '长文档', sample: '处理超长文档和代码库' },
  { label: '视觉', sample: '能看懂图片做视觉分析' },
  { label: '智能体', sample: '做 Agent 规划和工具调用' },
  { label: '免费', sample: '免费的中文模型' },
  { label: '中文长上下文', sample: '中文长上下文且免费' },
]

export function viewHome() {
  const recs = recommendedModels(8)
  return `
  <section class="hero wrap hero-single">
    <div class="hero-copy hero-center">
      <span class="eyebrow">AI 模型选型系统</span>
      <h1>找到适合你的<br><em>AI 模型。</em></h1>
      <p class="hero-lead">不需要研究众多模型名称。描述你的任务，自动推荐，并解释为什么。</p>
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
    <div class="heading"><div><span class="eyebrow">精选推荐</span><h2>大家都在看的模型</h2></div><p>按各场景推荐评分聚合评选的型号。</p></div>
    <div class="card-grid">${recs.map((v) => modelCard(v)).join('')}</div>
    <div class="section-foot"><a class="button ghost" href="#browse">查看全部 ${state.variants.length} 个型号 →</a></div>
  </section>

  ${recentModuleHTML()}
  ${trustSectionHTML()}
  `
}

// ---------- 信任层（DESIGN Layer 3）：数据透明、可核验 ----------
export function trustSectionHTML() {
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

// 渲染可编辑条件 chip
export function renderHomeChips() {
  const box = document.getElementById('home-chips')
  if (!box) return
  box.innerHTML = state.homeConditions
    .map((c, i) => `<button type="button" class="chip-n" data-rm-chip="${i}" title="点击移除该条件">${esc(c.label)}<span class="x">×</span></button>`)
    .join('')
}
// 开始匹配：把解析出的条件写入 matcher 状态并跳转
export function startMatchFromHome() {
  const input = document.getElementById('task-input')
  state.homeConditions = extractConditions(input ? input.value : '')
  const task = state.homeConditions.find((c) => c.key === 'task')
  if (task) state.selectedTask = task.value
  const budget = state.homeConditions.find((c) => c.key === 'budget')
  if (budget) state.budget = budget.value
  const speed = state.homeConditions.find((c) => c.key === 'speed')
  if (speed) state.speed = speed.value
  const traits = state.homeConditions.filter((c) => c.key === 'trait').map((c) => c.value)
  if (traits.length) state.browseTraits = Array.from(new Set([...state.browseTraits, ...traits]))
  const mod = state.homeConditions.find((c) => c.key === 'modality')
  if (mod) state.browseModality = mod.value
  const ctx = state.homeConditions.find((c) => c.key === 'context')
  if (ctx) state.minContext = ctx.value
  pushRecentSearch(input ? input.value : '')
  location.hash = 'matcher'
}

// ---------- 视图：厂商地图 ----------
export function providerCard(p) {
  const vs = variantsOfProvider(p.id)
  const fs = familiesOfProvider(p.id)
  const region = { US: '美国', CN: '中国', FR: '法国', DE: '德国', GB: '英国' }[p.country] || p.country || '其他'
  return `<a class="provider-card" href="#provider/${encodeURIComponent(p.id)}" style="--brand:${esc(p.brand_color || '#173e35')}">
    <div class="pc-top">${logoHTML(p, 'md')}<div class="pc-tags"><span class="tag">${esc(region)}</span>${catBadge(p)}${p.open_weight ? '<span class="tag tag-open">开放权重</span>' : ''}</div></div>
    <div class="pc-body">
      <h3>${esc(p.name_cn || p.name)}</h3>
      <p>${esc(p.description_cn || '')}</p>
      <div class="pc-mix">${modalityMix(vs)}</div>
      <div class="pc-series">${fs.slice(0, 4).map((f) => `<span class="series-chip">${esc(f.name_cn || f.name)}</span>`).join('')}${fs.length > 4 ? `<span class="series-chip more">+${fs.length - 4}</span>` : ''}</div>
    </div>
    <div class="pc-foot"><span>${fs.length} 系列 · ${vs.length} 型号</span><i>查看 →</i></div>
  </a>`
}
export function filteredProviders() {
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
export function providerGridHTML() {
  const list = filteredProviders()
  return list.length ? list.map(providerCard).join('') : emptyBox('没有匹配的厂商或模型，换个关键词试试。')
}
export function viewProviders() {
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
export function viewProvider(id) {
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
export function sortVariants(arr, mode) {
  const a = [...arr]
  if (mode === 'price-asc') a.sort((x, y) => priceValue(x) - priceValue(y))
  else if (mode === 'price-desc') a.sort((x, y) => priceValue(y) - priceValue(x))
  else if (mode === 'context') a.sort((x, y) => (y.context_window || 0) - (x.context_window || 0))
  else if (mode === 'speed') a.sort((x, y) => (SPEED_RANK[y.speed_tier] || 2) - (SPEED_RANK[x.speed_tier] || 2))
  return a
}
export function familyTableHTML(f) {
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
export function tierPill(v, key) {
  const c = (v.capabilities || {})[key]
  if (!c) return '—'
  const t = TIER[c.tier] || { label: c.tier, lv: 'mid' }
  return `<span class="tier-pill tier-${t.lv}">${t.label}</span>`
}
export function viewFamily(id) {
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
export function browseResultsHTML() {
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
export function browseTableViewHTML() {
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
  <div class="table-wrap"><table class="data-table data-table--browse">
    <colgroup><col><col><col><col><col><col><col><col><col></colgroup>
    <thead><tr><th>模型</th><th>厂商</th><th>上下文</th><th>输入 $/M</th><th>输出 $/M</th><th>能力</th><th>速度</th><th>评分</th><th>对比</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`
}
export function viewBrowse() {
  // 能力维度为主观评级，用 chip--cap（虚线框）与客观硬性条件区分
  // 副标题（英文名 / 判定口径）收进 title，避免双行 chip 撑高侧栏
  const capChip = (d) =>
    `<button class="chip chip--cap ${state.browseCaps.includes(d.key) ? 'on' : ''}" aria-pressed="${state.browseCaps.includes(d.key) ? 'true' : 'false'}" title="${d.cn} · ${d.en}（能力评级）" data-cap="${d.key}">${d.cn}</button>`
  const traitChip = (t) =>
    `<button class="chip ${state.browseTraits.includes(t.key) ? 'on' : ''}" aria-pressed="${state.browseTraits.includes(t.key) ? 'true' : 'false'}" title="${t.cn} · ${t.hint}" data-trait="${t.key}">${t.cn}</button>`
  const modBtn = (k, label) =>
    `<button class="${state.browseModality === k ? 'selected' : ''}" aria-pressed="${state.browseModality === k ? 'true' : 'false'}" data-value="${k}">${label}</button>`
  const priceBtn = (k, label) =>
    `<button class="${state.browsePrice === k ? 'selected' : ''}" aria-pressed="${state.browsePrice === k ? 'true' : 'false'}" data-value="${k}">${label}</button>`
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '02 / 能力筛选', title: '按<em>能力</em>找模型', desc: '左边勾选你需要的条件，右边即时过滤并排序，找到最合适的型号。' })}
    <div class="browse-toolbar">
      <div class="bt-search"><span class="bt-ico">⌕</span><input id="browse-search" type="search" placeholder="搜索模型或厂商…" value="${esc(state.browseSearch)}" aria-label="搜索模型或厂商"></div>
      <div class="view-switch" role="group" aria-label="视图切换">
        <button class="${state.browseView === 'card' ? 'selected' : ''}" data-view="card" aria-pressed="${state.browseView === 'card'}">卡片</button>
        <button class="${state.browseView === 'table' ? 'selected' : ''}" data-view="table" aria-pressed="${state.browseView === 'table'}">表格</button>
      </div>
    </div>
    <div class="browse-layout">
      <aside class="filter-panel">
        <div class="fp-head"><h3>筛选</h3><button class="fp-reset" data-reset-filters>清空</button></div>
        <div class="fp-block"><h4>模态</h4><div class="segmented" data-seg="browseModality">${modBtn('all', '全部')}${modBtn('text', '文本')}${modBtn('image', '图像')}${modBtn('video', '视频')}</div></div>
        <div class="fp-block"><h4>价格</h4><div class="segmented" data-seg="browsePrice">${priceBtn('all', '全部')}${priceBtn('free', '免费')}${priceBtn('low', '低成本')}${priceBtn('standard', '标准价')}</div></div>
        <div class="fp-block"><h4>条件<small>同时满足</small></h4><div class="chip-wrap">${TRAITS.map(traitChip).join('')}${CAP_DIMS.map(capChip).join('')}<button class="chip chip--fav ${state.favOnly ? 'on' : ''}" aria-pressed="${state.favOnly}" title="只显示已收藏的模型（本地保存）" data-fav-only>★ 收藏${getFav().length ? ' ' + getFav().length : ''}</button></div></div>
        <div class="fp-block"><h4>排序</h4><div class="segmented" data-seg="browseSort"><button class="${state.browseSort === 'match' ? 'selected' : ''}" data-value="match">匹配度</button><button class="${state.browseSort === 'price' ? 'selected' : ''}" data-value="price">价格</button><button class="${state.browseSort === 'context' ? 'selected' : ''}" data-value="context">上下文</button></div></div>
      </aside>
      <div class="browse-results" id="browse-results">${state.browseView === 'table' ? browseTableViewHTML() : browseResultsHTML()}</div>
    </div>
  </div>`
}

// ---------- 视图：任务选择器 ----------
export function viewMatcher() {
  const taskBtn = (t) =>
    `<button class="task-option ${state.selectedTask === t.id ? 'selected' : ''}" aria-pressed="${state.selectedTask === t.id ? 'true' : 'false'}" data-task="${t.id}"><span class="to-ico">${t.icon || '◎'}</span><span class="to-text"><b>${esc(t.name_cn)}</b><small>${esc(t.description_cn)}</small></span></button>`
  const segBtn = (group, cur, val, label) =>
    `<button class="${cur === val ? 'selected' : ''}" aria-pressed="${cur === val ? 'true' : 'false'}" data-value="${val}">${label}</button>`
  return `<div class="matcher-page">
    <div class="wrap page">
      ${pageHead({ eyebrow: '03 / 任务选择器', title: '告诉我，<em>你想做什么？</em>', desc: '选择任务、预算和偏好，得到带理由的推荐列表。' })}
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
export function viewModel(id) {
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
    ${versionBlockHTML(v)}
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
export function recentModuleHTML() {
  const ids = getRecent()
  if (!ids.length) return ''
  const cards = ids.map(variantById).filter(Boolean).map((v) => modelCard(v, '')).join('')
  return `<section class="section wrap">
    <div class="heading"><div><span class="eyebrow">最近浏览</span><h2>你刚才看过的</h2></div><p>本地记录，刷新不丢。</p></div>
    <div class="card-grid">${cards}</div>
  </section>`
}

// ---------- 视图：对比集 ----------
export function viewCompare() {
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
    <header class="entity-head"><div class="eh-main"><span class="eyebrow">06 / 模型对比</span><h1>模型对比（${list.length}）</h1><p>本地保存，刷新不丢。点行看详情，✕ 移除。</p></div></header>
    <div class="table-wrap"><table class="cmp-table">
      <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${list.map(row).join('')}</tbody>
    </table></div>
  </div>`
}

// ---------- 视图：命名解释 ----------
// ---------- 视图：托管网关 ----------
export function viewGateways() {
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

export function viewGlossary() {
  return `<div class="wrap page">
    ${pageHead({ eyebrow: '05 / 名称解释', title: '模型名称，<em>其实有规律。</em>', desc: '不再被 Mini、Pro、Flash 搞混。快速理解型号后缀代表什么。' })}
    <div class="glossary-grid">${state.naming
      .map((i) => `<article class="glossary-card"><span class="naming-term">${esc(i.term)}</span><b>${esc(i.name_cn)}</b><p>${esc(i.description_cn)}</p><small>例：${esc(i.example)}</small></article>`)
      .join('')}</div>
  </div>`
}

export function notFound(kind, id, back) {
  return `<div class="wrap page"><button class="back-link" data-back="${esc(back)}">← 返回</button>
    <div class="empty-box big"><span>✦</span><h2>未找到${esc(kind)}：${esc(id)}</h2><p>可能已下线或尚未收录。</p></div></div>`
}
