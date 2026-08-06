// V4 数据层迁移脚本（Step 2）
// 仅读取现有已核实数据，派生出新文件与字段，不编造任何数值。
// 输出：
//   data/gateways.json      网关（独立实体，V4 §11）
//   data/scenarios.json     Scene 场景层（V4 §9）
//   data/api_access.json    模型 API 访问方式（独立实体，V4 §10）
//   并在 model_variants / extra 上追加 aliases / cost_tier / role / access_types
const fs = require('fs')
const D = 'data/'
const read = (f) => JSON.parse(fs.readFileSync(D + f + '.json'))
const write = (f, o) => fs.writeFileSync(D + f + '.json', JSON.stringify(o, null, 2) + '\n')

const providers = read('providers')
const variants = read('model_variants')
const extra = read('model_variants_extra')
const tasks = read('tasks')

const gwIds = new Set(providers.filter((p) => p.category === 'gateway').map((p) => p.id))
const byId = (arr, id) => arr.find((x) => x.id === id)
const proto = (s) => ({ openai: 'openai', anthropic: 'anthropic', google: 'google', media: 'provider_specific' }[s] || 'openai')

// 厂商别名（用于模型别名搜索：搜“智谱/通义千问”能命中对应模型）
const VENDOR_ALIAS = {
  'alibaba-qwen': ['通义千问', '千问'], 'deepseek': ['深度求索'], 'zhipu-glm': ['智谱', '智谱清言'],
  'moonshot-kimi': ['月之暗面'], 'google': ['谷歌'], 'anthropic': ['Claude'], 'openai': ['ChatGPT'],
  'meta': ['脸书'], 'baidu': ['文心'], 'tencent-hunyuan': ['混元'], 'xai': ['Grok'],
}

// ---------- 1. 模型字段 enrichment ----------
function enrich(v) {
  const p = byId(providers, v.provider_id) || {}
  // aliases：模型原名 / 中文名 / model_id / 厂商中文名与别名
  const a = new Set([v.name, v.name_cn, v.model_id, p.name_cn].filter(Boolean))
  ;(VENDOR_ALIAS[v.provider_id] || []).forEach((x) => a.add(x))
  const aliases = [...a].filter((x) => x && x !== v.name)
  // cost_tier：free / cost_effective / production
  let cost_tier
  if (v.free) cost_tier = 'free'
  else {
    const ip = v.input_price_per_mtok, op = v.output_price_per_mtok
    if (ip != null && op != null && ip <= 1 && op <= 3) cost_tier = 'cost_effective'
    else cost_tier = 'production'
  }
  // role（模型定位）：按 model_type 推断
  const mt = v.model_type || []
  let role = 'general'
  if (mt.includes('Reasoning')) role = 'reasoning'
  else if (mt.includes('Coding')) role = 'coding'
  else if (mt.includes('Agent')) role = 'agent'
  else if (mt.includes('Image') || mt.includes('Video')) role = 'multimodal'
  else if (v.free || (v.best_for || []).includes('low_cost')) role = 'low_cost'
  // access_types
  const access_types = ['official_api']
  if (v.open_weight) { access_types.push('open_source', 'self_host') }
  if (v.free) access_types.push('free_api')
  return { ...v, aliases, cost_tier, role, access_types }
}
const variants2 = variants.map(enrich)
const extra2 = extra.map(enrich)
write('model_variants', variants2)
write('model_variants_extra', extra2)

// ---------- 2. gateways.json（独立实体） ----------
const gateways = providers.filter((p) => p.category === 'gateway').map((p) => {
  const models = [...variants2, ...extra2].filter((v) => v.provider_id === p.id).map((v) => v.id)
  return {
    id: p.id, name: p.name, name_cn: p.name_cn, logo_file: p.logo_file, country: p.country,
    website: p.website, api_docs: p.api_docs, api_base_url: p.api_base_url, api_style: p.api_style,
    brand_color: p.brand_color, description_cn: p.description_cn, source: p.source,
    last_verified: p.last_verified, models,
  }
})
write('gateways', gateways)

// ---------- 3. scenarios.json（Scene 层，V4 §9） ----------
const scenes = [
  { id: 'chat', name_cn: '日常聊天', icon: '✦', description_cn: '问答、总结、翻译、写作。', task_ids: ['chat'] },
  { id: 'coding', name_cn: '写代码', icon: '⌘', description_cn: '生成、审查、重构代码。', task_ids: ['coding'] },
  { id: 'agent', name_cn: '开发 Agent', icon: '⚙', description_cn: '规划、工具调用、多步任务。', task_ids: ['agent'] },
  { id: 'reasoning', name_cn: '复杂推理', icon: '✜', description_cn: '数学、规划、科研。', task_ids: ['reasoning'] },
  { id: 'writing', name_cn: '内容创作', icon: '✎', description_cn: '长文、文案、报告。', task_ids: ['writing'] },
  { id: 'image_gen', name_cn: '图片生成', icon: '◉', description_cn: '文生图、图生图。', task_ids: ['image'] },
  { id: 'image_und', name_cn: '图片理解', icon: '◉', description_cn: '看图问答、文档分析。', task_ids: ['image_understanding'] },
  { id: 'video', name_cn: '视频生成', icon: '↗', description_cn: '文/图到视频。', task_ids: ['video'] },
  { id: 'doc', name_cn: '文档分析', icon: '▤', description_cn: '长文档、代码库、资料阅读。', task_ids: ['long_context', 'knowledge'] },
  { id: 'local', name_cn: '本地部署', icon: '⌂', description_cn: '开放权重、私有化。', task_ids: ['local'] },
  { id: 'low_cost', name_cn: '寻找低成本 API', icon: '♧', description_cn: '高性价比模型。', task_ids: ['low_cost'] },
  { id: 'learning', name_cn: '学习 AI', icon: '✺', description_cn: '概念理解、答疑入门。', task_ids: ['learning'] },
  { id: 'enterprise', name_cn: '企业应用', icon: '▣', description_cn: 'RAG、流程自动化。', task_ids: ['enterprise'] },
]
write('scenarios', scenes)

// ---------- 4. api_access.json（独立实体，V4 §10） ----------
function features(v) {
  const f = []
  const mt = v.model_type || []
  if (mt.some((x) => ['Chat', 'Reasoning', 'Coding', 'Agent'].includes(x))) f.push('streaming')
  if ((v.capabilities && v.capabilities.agent && v.capabilities.agent.tier)) f.push('tool_calling')
  return f
}
const allModels = [...variants2, ...extra2]
const apiAccess = allModels.map((v) => {
  const p = byId(providers, v.provider_id) || {}
  const official = {
    vendor: v.provider_id, access_type: v.free ? 'free_api' : 'official_api',
    base_url: p.api_base_url || null, protocol: proto(p.api_style), auth_type: 'api_key',
    model_id: v.model_id, features: features(v),
  }
  const entries = [official]
  // 网关托管的型号：补充网关访问入口（provider 即网关）
  if (gwIds.has(v.provider_id)) {
    entries.push({
      vendor: v.provider_id, access_type: 'gateway', base_url: p.api_base_url || null,
      protocol: proto(p.api_style), auth_type: 'api_key', model_id: v.model_id, features: features(v),
    })
  }
  return { id: v.id, name: v.name, provider_id: v.provider_id, accesses: entries }
})
write('api_access', apiAccess)

// ---------- 校验 ----------
const allIds = new Set(allModels.map((v) => v.id))
const orphanGw = gateways.flatMap((g) => g.models.filter((m) => !allIds.has(m)))
const orphanApi = apiAccess.filter((a) => !allIds.has(a.id))
console.log('=== V4 迁移结果 ===')
console.log('型号总数:', allModels.length, '（含 enrichment）')
console.log('网关数:', gateways.length, '网关模型引用:', gateways.reduce((s, g) => s + g.models.length, 0))
console.log('场景(Scene)数:', scenes.length)
console.log('API 访问记录数:', apiAccess.length)
console.log('cost_tier 分布:', JSON.stringify(allModels.reduce((m, v) => { m[v.cost_tier] = (m[v.cost_tier] || 0) + 1; return m }, {})))
console.log('role 分布:', JSON.stringify(allModels.reduce((m, v) => { m[v.role] = (m[v.role] || 0) + 1; return m }, {})))
console.log('孤儿校验: 网关模型孤儿', orphanGw.length, '| api 孤儿', orphanApi.length)
console.log('校验通过:', orphanGw.length === 0 && orphanApi.length === 0 ? '✅' : '❌')
