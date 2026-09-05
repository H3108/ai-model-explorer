// AI Model Explorer — 路由 / 局部刷新 / 全局事件委托
import {
  state, $, $$, updateCmpBadge, familyById, toggleCompare, toggleFav, saveBrowseFilters, pushRecentSearch,
} from './store.js'
import {
  viewHome, viewProviders, viewProvider, viewFamily, viewBrowse, viewMatcher, viewGateways,
  viewModel, viewCompare, viewGlossary, notFound,
  providerGridHTML, browseTableViewHTML, browseResultsHTML, familyTableHTML,
  renderHomeChips, startMatchFromHome,
} from './views.js'
import { extractConditions, applySearchQuery, syncSeg, recommendationHTML } from './search.js'

// ---------- 路由 ----------
const scrollMem = new Map()
let currentKey = null
let navCount = 0

export function parseHash() {
  const raw = (location.hash || '#home').replace(/^#\/?/, '')
  const slash = raw.indexOf('/')
  const name = slash === -1 ? raw : raw.slice(0, slash)
  const param = slash === -1 ? null : safeDecodeURI(raw.slice(slash + 1))
  return { name: name || 'home', param, key: raw || 'home' }
}

// 畸形 hash（如 #model/%%%）会让 decodeURIComponent 抛 URIError，回退原串避免路由卡死
function safeDecodeURI(s) {
  try { return decodeURIComponent(s) } catch { return s }
}

export function render() {
 try {
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
  // 路由切换后把焦点移到主容器，便于键盘 / 读屏用户从新页面顶部继续
  const appEl = $('#app')
  if (appEl) appEl.focus({ preventScroll: true })
 } catch (err) {
  console.error('render 失败：', err)
  const app = $('#app')
  if (app) app.innerHTML = notFound('页面', '渲染出错', '#home')
 }
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
export function refresh(sel, html) {
  const el = $(sel)
  if (el) el.innerHTML = html
}
export function refreshProviderGrid() {
  refresh('#provider-grid', providerGridHTML())
}
export function refreshBrowse() {
  const el = document.getElementById('browse-results')
  if (el) el.innerHTML = state.browseView === 'table' ? browseTableViewHTML() : browseResultsHTML()
}

// ---------- 事件 ----------
export function bindGlobalEvents() {
  document.addEventListener('input', (e) => {
    const t = e.target
    if (t.id === 'provider-search') { state.providerSearch = t.value; refreshProviderGrid() }
    else if (t.id === 'task-input') { state.homeConditions = extractConditions(t.value); renderHomeChips() }
    else if (t.id === 'browse-search') {
      state.browseSearch = t.value
      applySearchQuery(t.value)
      pushRecentSearch(t.value)
      saveBrowseFilters()
      // 同步筛选面板分段按钮高亮（结构化搜索改了 state，但筛选面板未整体重渲染）
      syncSeg('browseModality', state.browseModality)
      syncSeg('browsePrice', state.browsePrice)
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
      if (r.name === 'family') { const f = familyById(r.param); if (f) refresh('#family-table', familyTableHTML(f)) }
    }
  })
  document.addEventListener('keydown', (e) => {
    // 免费信息点标了 role="button" + tabindex，补键盘可达性：Enter / Space 展开收起
    const freeInfoKey = e.target.closest && e.target.closest('.free-info')
    if (freeInfoKey && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      freeInfoKey.classList.toggle('active')
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
      // browse 表内紧凑按钮保持短文案，避免撑破列宽；长文案仅用于宽按钮
      const compact = cmpBtn.classList.contains('sm')
      cmpBtn.textContent = on ? (compact ? '✓' : '✓ 已加入对比') : (compact ? '＋' : '＋ 加入对比')
      cmpBtn.setAttribute('aria-pressed', String(on))
      cmpBtn.setAttribute('aria-label', on ? '移出对比' : '加入对比')
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
      if (input) { input.value = popTask.dataset.popTask; state.homeConditions = extractConditions(input.value); renderHomeChips(); input.focus() }
      return
    }
    const rmChip = e.target.closest('[data-rm-chip]')
    if (rmChip) {
      const i = Number(rmChip.dataset.rmChip)
      state.homeConditions = state.homeConditions.filter((_, idx) => idx !== i)
      renderHomeChips()
      return
    }
    // 首页成本入口（如「免费模型」）→ 清掉历史筛选、只留价格条件进入浏览页
    // 全量清空是刻意的：入口在首页，用户带着「看免费的」单一诉求点进来，
    // 若沿用上次残留的能力 / 模态筛选会得到看不懂的空结果。
    const costChip = e.target.closest('[data-cost]')
    if (costChip) {
      state.browseCaps = []
      state.browseTraits = []
      state.browseModality = 'all'
      state.browseSort = 'match'
      state.minContext = 0
      state.browseSearch = ''
      state.browseSearchClean = ''
      state.favOnly = false
      state.browsePrice = costChip.dataset.cost
      saveBrowseFilters()
      if (parseHash().name === 'browse') render()
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
      if (input) { input.value = rs.dataset.recSearch; state.homeConditions = extractConditions(input.value); renderHomeChips() }
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
        segBtn.parentElement.querySelectorAll('button').forEach((b) => { b.classList.remove('selected'); b.setAttribute('aria-pressed', String(b === segBtn)) })
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
      capChip.setAttribute('aria-pressed', String(state.browseCaps.includes(k)))
      refreshBrowse(); saveBrowseFilters()
      return
    }
    const traitChip = e.target.closest('[data-trait]')
    if (traitChip) {
      const k = traitChip.dataset.trait
      state.browseTraits = state.browseTraits.includes(k) ? state.browseTraits.filter((x) => x !== k) : [...state.browseTraits, k]
      traitChip.classList.toggle('on')
      traitChip.setAttribute('aria-pressed', String(state.browseTraits.includes(k)))
      refreshBrowse(); saveBrowseFilters()
      return
    }
    if (e.target.closest('[data-reset-filters]')) {
      state.browseCaps = []
      state.browseTraits = []
      state.browseModality = 'all'
      state.browseSort = 'match'
      state.browsePrice = 'all'
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
