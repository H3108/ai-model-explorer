// AI Model Explorer — V3 视图层（入口：加载数据后交给 src/ 各模块）
// 路由：#home / #providers / #provider/:id / #family/:id / #browse / #matcher / #model/:id / #compare / #gateways / #glossary
// 设计原则：单一视图容器 + 局部刷新，杜绝锚点滚动跳动；能力用三档定性 + 中文依据，不编造分数。
// 模块拆分：src/constants.js（常量） · src/store.js（状态/查询/存储） · src/ui.js（展示组件）
//           src/search.js（搜索与评分） · src/views.js（页面视图） · src/router.js（路由与事件）

import { $, state, restoreBrowseFilters } from './src/store.js'
import { bindGlobalEvents, render } from './src/router.js'

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
    const [gw, sc, api, al, ver] = await Promise.all([
      fetch('./data/gateways.json').then((r) => (r.ok ? r.json() : [])),
      fetch('./data/scenarios.json').then((r) => (r.ok ? r.json() : [])),
      fetch('./data/api_access.json').then((r) => (r.ok ? r.json() : [])),
      fetch('./data/model_aliases.json').then((r) => (r.ok ? r.json() : [])),
      fetch('./data/model_versions.json').then((r) => (r.ok ? r.json() : [])),
    ])
    state.gateways = Array.isArray(gw) ? gw : []
    state.scenarios = Array.isArray(sc) ? sc : []
    state.apiAccess = Array.isArray(api) ? api : []
    state.aliases = Array.isArray(al) ? al : []
    state.versions = Array.isArray(ver) ? ver : []
  } catch (e) {
    console.warn('V4 数据加载失败：', e)
  }
  state.selectedTask = state.tasks[0]?.id || null
  restoreBrowseFilters()
  bindGlobalEvents()
  render()
}

loadData().catch((err) => {
  console.error(err)
  $('#app').innerHTML = `<div class="wrap page"><div class="empty-box big"><span>✦</span><h2>数据加载失败</h2><p>请通过本地静态服务器启动，例如 <code>python3 -m http.server 8848</code>。</p></div></div>`
})
