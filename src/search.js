// AI Model Explorer — 搜索 / 结构化条件提取 / 评分 / 匹配与推荐
import { TIER, CAP_DIMS, SPEED_RANK, SPEED_CN, TRAITS } from './constants.js'
import { state, byId, variantById, variantMatches, modalityOf, getFav, providerOf, famName } from './store.js'
import { esc, priceValue, ctxShort, logoHTML, modBadge } from './ui.js'

// ---------- 首页任务输入：结构化提取（Phase 1 V1，不做 AI 推理，仅关键词映射） ----------
// 将自然语言需求解析为可编辑的结构化条件
// raw：命中的原文片段，用于从搜索词中剔除结构化部分，仅保留纯文本做子串匹配
export function extractConditions(text) {
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
export function cleanQuery(text, conds) {
  let q = text || ''
  conds.forEach((c) => { if (c.raw) q = q.split(c.raw).join(' ').split(c.raw.toLowerCase()).join(' ') })
  q = q.replace(/\s+/g, ' ').trim().toLowerCase()
  return q.length >= 2 ? q : ''
}
// 浏览搜索框：把自然语言解析为结构化筛选条件并应用到 state
// 每次输入完整重算（文本为空时派生筛选全部复位），保证「清空搜索」能恢复全量
export function applySearchQuery(text) {
  const conds = extractConditions(text)
  const mod = conds.find((c) => c.key === 'modality')
  state.browseModality = mod ? mod.value : 'all'
  const ctx = conds.find((c) => c.key === 'context')
  state.minContext = ctx ? ctx.value : 0
  const bud = conds.find((c) => c.key === 'budget')
  // 预算映射：「免费」→ free；「省钱/便宜」→ low；「质量优先/旗舰」与价格无关，不限制区间（旧逻辑误判成 low，搜旗舰只剩廉价模型）
  state.browsePrice = !bud ? 'all' : bud.label.includes('免费') ? 'free' : bud.value === 'high' ? 'all' : 'low'
  state.browseSearchClean = cleanQuery(text, conds)
}
// 同步筛选面板分段控件高亮（state 变更后，避免面板与结果区不一致）
export function syncSeg(group, val) {
  const seg = document.querySelector('[data-seg="' + group + '"]')
  if (seg) seg.querySelectorAll('button').forEach((b) => b.classList.toggle('selected', b.dataset.value === val))
}

// ---------- 能力档位求和（评分与「系列内怎么选」共用） ----------
export function capSum(v) {
  return CAP_DIMS.reduce((s, d) => s + (TIER[(v.capabilities || {})[d.key]?.tier]?.score || 0), 0)
}
// ---------- Phase 2 加权推荐评分（透明、可复现）----------
// 方法论（IMPLEMENTATION_PLAN §2.3）：任务匹配 40% + 能力质量 30% + 成本效率 20% + 响应速度 10%
// 无任务上下文时，任务匹配 40% 权重按比例分摊给其余三项（能力 50 / 成本 33 / 速度 17），保证仍为 0-100
export function fitScore(v, taskId) {
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
export function scoreBreakdownHTML(v, taskId) {
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
// 型号详情：推荐理由（基于公开规格派生，不编造综合分数）
export function whyRecommendedHTML(v, taskId) {
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

// ---------- 浏览页筛选与排序 ----------
export function matchModels() {
  let list = state.variants.filter((v) => state.browseModality === 'all' || modalityOf(v) === state.browseModality)
  // 子串匹配用「清洗后的纯文本」：结构化片段（模态/上下文/预算等）已转为筛选条件，不再参与文本匹配
  if (state.browseSearchClean) list = list.filter((v) => variantMatches(v, state.browseSearchClean))
  if (state.minContext > 0) list = list.filter((v) => (v.context_window || 0) >= state.minContext)
  if (state.favOnly) { const fav = getFav(); list = list.filter((v) => fav.includes(v.id)) }
  if (state.browsePrice === 'free') list = list.filter((v) => v.free)
  else if (state.browsePrice === 'low') list = list.filter((v) => v.free !== true && v.input_price_per_mtok != null && v.input_price_per_mtok <= 1)
  else if (state.browsePrice === 'standard') list = list.filter((v) => v.free !== true && v.input_price_per_mtok != null && v.input_price_per_mtok > 1)
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

// ---------- 任务选择器：候选排序与推荐列表 ----------
export function rankCandidates(ids) {
  const arr = ids.map((r) => ({ r, v: variantById(r.id) })).filter((x) => x.v)
  const speedOf = (v) => SPEED_RANK[v.speed_tier] ?? 2
  if (state.budget === 'low') arr.sort((a, b) => priceValue(a.v) - priceValue(b.v))
  else if (state.budget === 'high' || state.speed === 'quality') arr.sort((a, b) => fitScore(b.v, state.selectedTask) - fitScore(a.v, state.selectedTask))
  else if (state.speed === 'fast') arr.sort((a, b) => speedOf(b.v) - speedOf(a.v))
  else arr.sort((a, b) => fitScore(b.v, state.selectedTask) - fitScore(a.v, state.selectedTask))
  return arr
}
export function recommendationHTML(taskId = state.selectedTask) {
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
