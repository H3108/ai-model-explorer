// AI Model Explorer — 全局状态 / 数据查询 / 本地持久化
import { LS_RECENT, LS_COMPARE, LS_FAV, LS_RECENT_SEARCH, LS_BROWSE_FILTERS, COMPARE_LIMIT, CAP_DIMS } from './constants.js'
import { esc } from './ui.js'

export const $ = (s, root = document) => root.querySelector(s)
export const $$ = (s, root = document) => Array.from(root.querySelectorAll(s))

export const state = {
  providers: [], families: [], variants: [], tasks: [], recommendations: [], naming: [],
  // V4 新增数据层
  gateways: [], scenarios: [], apiAccess: [],
  // 厂商列表
  providerFilter: 'all', providerModality: 'all', providerSearch: '',
  // 系列页
  familySort: 'default',
  // 浏览页
  browseModality: 'all', browseCaps: [], browseTraits: [], browseSort: 'match', browsePrice: 'all',
  browseView: 'card', browseSearch: '', browseSearchClean: '', minContext: 0, favOnly: false,
  // 匹配器
  selectedTask: null, budget: 'balanced', speed: 'balanced',
  // 首页任务输入的结构化条件（可变，跨模块共享，必须挂在 state 上）
  homeConditions: [],
}

// ---------- 查询 ----------
export const byId = (arr, key, value) => arr.find((i) => i[key] === value) || null
export const providerById = (id) => byId(state.providers, 'id', id) || {}
export const familyById = (id) => byId(state.families, 'id', id) || null
export const variantById = (id) => byId(state.variants, 'id', id)
export const variantsOfProvider = (pid) => state.variants.filter((v) => v.provider_id === pid)
export const familiesOfProvider = (pid) => state.families.filter((f) => f.provider_id === pid)
export const variantsOfFamily = (fid) => state.variants.filter((v) => v.family_id === fid)
export const providerOf = (v) => providerById(v.provider_id)
export const familyOf = (v) => familyById(v.family_id)
// 厂商链接守卫：p 解析失败时回落到厂商列表，杜绝 #provider/undefined 死链
// （providerById 返回 {} 而非 null，使各调用点的 p.x 读取永不抛 NPE；
//  引用完整性由 scripts/validate_normalized.cjs 强制保证，故不会真正解析失败）
export const providerLink = (p) => (p && p.id) ? `#provider/${encodeURIComponent(p.id)}` : '#providers'
export const famName = (v) => { const f = familyOf(v); return f ? (f.name_cn || f.name || '') : '' }
export const modalityOf = (v) => (v.media_type === 'video' ? 'video' : v.media_type === 'image' ? 'image' : 'text')

export const apiAccessOf = (v) => state.apiAccess.find((a) => a.id === v.id) || null
export const capCn = (k) => (CAP_DIMS.find((c) => c.key === k) || {}).cn || k

// ---------- 数据时效：全站日期的唯一来源 ----------
// 页面上任何「数据于 X 核实」都必须走这里，禁止在视图 / HTML 里写死日期。
// 数据更新时只需改 data/*.json 的 verified_date，全站文案自动跟随。
// 计算结果缓存，避免每次渲染重扫 118 条记录；state.variants 变化后调 resetDataMeta()。
let _meta = null
export function resetDataMeta() { _meta = null }
export function dataMeta() {
  if (_meta) return _meta
  const dates = state.variants.map((v) => v.verified_date).filter(Boolean).sort()
  const latest = dates.length ? dates[dates.length - 1] : null
  const earliest = dates.length ? dates[0] : null
  // 距最近一次核验的天数，用于「数据可能过期」提示（按 UTC 日期差，避免时区抖动）
  let ageDays = null
  if (latest) {
    const d = Date.parse(latest + 'T00:00:00Z')
    if (!Number.isNaN(d)) ageDays = Math.max(0, Math.floor((Date.now() - d) / 86400000))
  }
  _meta = {
    latest,
    earliest,
    total: state.variants.length,
    dated: dates.length,
    // 覆盖率不足 100% 时说明有型号漏标 verified_date，validate 脚本会告警
    fullyDated: dates.length === state.variants.length && dates.length > 0,
    ageDays,
    stale: ageDays != null && ageDays > 30,
  }
  return _meta
}
// 「数据于 YYYY-MM-DD 联网核实」——全站统一文案，缺日期时降级为不带日期的说法
export function verifiedNotice(suffix = '价格与能力以厂商官方为准。') {
  const { latest } = dataMeta()
  return latest ? `数据于 ${latest} 联网核实，${suffix}` : `数据已联网核实，${suffix}`
}
// 合并变体自带 aliases 字段与 model_aliases.json 别名表
export function aliasesOf(v) {
  const own = (v.aliases || []).map((a) => (typeof a === 'string' ? a : a.alias || '')).filter(Boolean)
  const fromFile = (state.aliases || [])
    .filter((a) => a.model_id && (a.model_id === v.id || a.model_id === v.model_id))
    .map((a) => a.alias)
    .filter(Boolean)
  const p = providerOf(v)
  const prov = p ? [p.name, p.name_cn] : []
  return Array.from(new Set([...own, ...fromFile, ...prov])).join(' ').toLowerCase()
}
// 该型号在 model_versions.json 中的版本记录（按发布时间倒序）
export function versionsOf(v) {
  return (state.versions || [])
    .filter((x) => x.model_id && (x.model_id === v.id || x.model_id === v.model_id))
    .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
}
// V4 全文搜索匹配：模型名/中文名/别名/厂商/能力/使用场景
export function variantMatches(v, q) {
  if (!q) return true
  const hay = [v.name, v.name_cn, v.model_id, v.one_liner_cn, aliasesOf(v), capCn(v.role)]
    .filter(Boolean).join(' ').toLowerCase()
  if (hay.includes(q)) return true
  if ((v.capabilities || {}) && Object.keys(v.capabilities).some((k) => capCn(k).includes(q))) return true
  if (state.scenarios.some((s) => s.name_cn.toLowerCase().includes(q) && (s.task_ids || []).some((tid) => (v.best_for || []).includes(tid)))) return true
  return false
}

// ---------- 本地存储：最近浏览 / 对比集（跨会话持久化） ----------
export function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
export function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
export function getRecent() { return lsGet(LS_RECENT, []).filter((id) => variantById(id)) }
export function pushRecent(id) {
  const r = getRecent().filter((x) => x !== id)
  r.unshift(id)
  lsSet(LS_RECENT, r.slice(0, 8))
}
export function getCompare() { return lsGet(LS_COMPARE, []).filter((id) => variantById(id)) }
export function toggleCompare(id) {
  const c = getCompare()
  const i = c.indexOf(id)
  if (i >= 0) { c.splice(i, 1) }
  else {
    // 防止把不存在的 id 加进对比集（避免满额时静默挤出真实模型导致数据丢失）
    if (!variantById(id)) return c
    if (c.length >= COMPARE_LIMIT) {
      const dropped = c[0]
      c.shift()
      toast(`对比集最多 ${COMPARE_LIMIT} 个，已移除最早的「${variantById(dropped)?.name_cn || dropped}」以加入新项`)
    }
    c.push(id)
  }
  lsSet(LS_COMPARE, c.slice(0, COMPARE_LIMIT))
  return c
}
export function inCompare(id) { return getCompare().includes(id) }
export function updateCmpBadge() {
  const el = document.getElementById('cmp-count')
  if (!el) return
  const n = getCompare().length
  el.textContent = n
  el.hidden = n === 0
}
// 轻提示（对比集上限等场景）。创建一次 toast 容器，复用之。
export function toast(msg) {
  let t = document.getElementById('toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'toast'
    t.className = 'toast'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => t.classList.remove('show'), 2400)
}
// ---------- Phase 2 用户偏好持久化 ----------
// 收藏集
export function getFav() { return lsGet(LS_FAV, []).filter((id) => variantById(id)) }
export function isFav(id) { return getFav().includes(id) }
export function toggleFav(id) { const f = getFav(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); lsSet(LS_FAV, f); return f }
// 最近搜索（保留最近 5 条，去重）
export function getRecentSearch() { return lsGet(LS_RECENT_SEARCH, []) }
export function pushRecentSearch(q) {
  const s = (q || '').trim()
  if (s.length < 2) return
  const arr = getRecentSearch().filter((x) => x !== s)
  arr.unshift(s)
  lsSet(LS_RECENT_SEARCH, arr.slice(0, 5))
}
export function recentSearchHTML() {
  const list = getRecentSearch()
  if (!list.length) return ''
  return `<div class="recent-search"><span class="rs-label">最近搜索：</span>${list
    .map((s) => `<button type="button" class="rs-chip" data-rec-search="${esc(s)}">${esc(s)}</button>`)
    .join('')}</div>`
}
// 浏览筛选记忆（跨会话还原）
export function saveBrowseFilters() {
  lsSet(LS_BROWSE_FILTERS, {
    browseModality: state.browseModality, browseCaps: state.browseCaps, browseTraits: state.browseTraits,
    browseSort: state.browseSort, browsePrice: state.browsePrice,
    browseView: state.browseView,
    browseSearch: state.browseSearch, browseSearchClean: state.browseSearchClean, minContext: state.minContext, favOnly: state.favOnly,
  })
}
export function restoreBrowseFilters() {
  const s = lsGet(LS_BROWSE_FILTERS, null)
  if (!s) return
  if (s.browseModality) state.browseModality = s.browseModality
  if (Array.isArray(s.browseCaps)) state.browseCaps = s.browseCaps
  if (Array.isArray(s.browseTraits)) state.browseTraits = s.browseTraits
  if (s.browseSort) state.browseSort = s.browseSort
  if (s.browsePrice) state.browsePrice = s.browsePrice
  if (s.browseView) state.browseView = s.browseView
  if (typeof s.browseSearch === 'string') state.browseSearch = s.browseSearch
  if (typeof s.browseSearchClean === 'string') state.browseSearchClean = s.browseSearchClean
  if (typeof s.minContext === 'number') state.minContext = s.minContext
  if (typeof s.favOnly === 'boolean') state.favOnly = s.favOnly
}
