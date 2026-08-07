// AI Model Explorer — 常量层（纯数据，无依赖）

// ---------- 常量 ----------
export const TIER = {
  low: { label: '弱', lv: 'weak', pct: 18, score: 1 },
  'low-medium': { label: '较弱', lv: 'weak', pct: 34, score: 2 },
  medium: { label: '中等', lv: 'mid', pct: 54, score: 3 },
  'medium-high': { label: '较强', lv: 'mid', pct: 72, score: 4 },
  high: { label: '强', lv: 'high', pct: 88, score: 5 },
  highest: { label: '顶尖', lv: 'top', pct: 100, score: 6 },
}
export const SPEED_RANK = { slow: 1, slower: 2, moderate: 3, medium: 3, fast: 4, faster: 5, fastest: 6 }
export const SPEED_CN = { slow: '较慢', slower: '偏慢', moderate: '中速', medium: '中速', fast: '快', faster: '很快', fastest: '极快' }
export const API_STYLE_CN = { openai: 'OpenAI 兼容', media: '媒体接口', anthropic: 'Anthropic', google: 'Google Gemini' }
export const MODALITY = {
  text: { label: '文本', short: '文本', icon: '¶' },
  image: { label: '图像生成', short: '图像', icon: '◈' },
  video: { label: '视频生成', short: '视频', icon: '▶' },
}
export const CAP_DIMS = [
  { key: 'reasoning', cn: '推理', en: 'Reasoning' },
  { key: 'coding', cn: '编码', en: 'Coding' },
  { key: 'agent', cn: '智能体', en: 'Agent' },
  { key: 'knowledge', cn: '知识', en: 'Knowledge' },
  { key: 'multilingual', cn: '多语', en: 'Multilingual' },
]
// 能力匹配器的附加硬性条件
export const TRAITS = [
  { key: 'long_context', cn: '长上下文', hint: '≥ 128K tokens', test: (v) => (v.context_window || 0) >= 128000 },
  { key: 'vision', cn: '视觉输入', hint: '能看图', test: (v) => !!v.vision_support },
  { key: 'open_weight', cn: '开放权重', hint: '可本地部署', test: (v) => !!v.open_weight },
  { key: 'low_cost', cn: '低成本', hint: '输入 ≤ $1/M', test: (v) => v.input_price_per_mtok != null && v.input_price_per_mtok <= 1 },
  { key: 'fast', cn: '高速', hint: '速度档 faster 以上', test: (v) => (SPEED_RANK[v.speed_tier] || 2) >= 3 },
]

export const COMPARE_LIMIT = 6

// ---------- 本地存储键 ----------
export const LS_RECENT = 'ame_recent_views'
export const LS_COMPARE = 'ame_compare_set'
export const LS_FAV = 'ame_fav_set'
export const LS_RECENT_SEARCH = 'ame_recent_search'
export const LS_BROWSE_FILTERS = 'ame_browse_filters'
