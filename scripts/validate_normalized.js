#!/usr/bin/env node
// Phase 1 校验：检查规范化数据层（model_variants / model_families / providers /
// tasks / recommendations / naming_guide）的 JSON 合法性与外键一致性。
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'data')
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

let errors = 0
let warns = 0
const err = (m) => { errors++; console.log('  ✗ ' + m) }
const warn = (m) => { warns++; console.log('  ⚠ ' + m) }
const ok = (m) => console.log('  ✓ ' + m)

const providers = read('providers.json')
const families = read('model_families.json')
const variants = read('model_variants.json')
const tasks = read('tasks.json')
const recs = read('recommendations.json')
const naming = read('naming_guide.json')

const providerIds = new Set(providers.map((p) => p.id))
const familyIds = new Set(families.map((f) => f.id))
const taskIds = new Set(tasks.map((t) => t.id))
const variantIds = new Set(variants.map((v) => v.id))
const familyByProvider = {}
families.forEach((f) => {
  if (!providerIds.has(f.provider_id)) err(`model_families ${f.id} 的 provider_id=${f.provider_id} 不存在`)
  familyByProvider[f.id] = f.provider_id
})

console.log(`\n[providers] ${providers.length} 个`)
console.log(`[families] ${families.length} 个`)
console.log(`[variants] ${variants.length} 个`)
console.log(`[tasks] ${tasks.length} 个`)
console.log(`[recommendations] ${recs.length} 个`)
console.log(`[naming_guide] ${naming.length} 条\n`)

console.log('\n校验 providers（API 基础地址 / 风格，base_url 可空）：')
const styleOk = new Set(['openai', 'anthropic', 'google', 'media'])
providers.forEach((p) => {
  if (!('api_base_url' in p)) err(`${p.id}: 缺 api_base_url 字段`)
  if (p.api_base_url != null && typeof p.api_base_url !== 'string') err(`${p.id}: api_base_url 非字符串`)
  if (!styleOk.has(p.api_style)) err(`${p.id}: api_style=${p.api_style} 非法（应 openai/anthropic/google/media）`)
  if (!p.api_docs && p.api_base_url == null) warn(`${p.id}: 无官方文档且无 API 地址（如 Midjourney 无公开 API，可接受）`)
  if (!p.brand_color || !p.logo_file) warn(`${p.id}: 缺少品牌色或 logo_file，前端将降级显示`)
  if (p.brand_color && !/^#[0-9a-fA-F]{6}$/.test(p.brand_color)) err(`${p.id}: brand_color 格式非法`)
})
ok(`providers 均已声明 api_style；base_url 为 null 的走自托管/无公开 API 提示；${providers.filter((p) => p.brand_color).length} 家已配置品牌色`)

console.log('校验 model_variants：')
const tierOk = new Set(['low', 'low-medium', 'medium', 'medium-high', 'high', 'highest'])
const isMedia = (v) => Array.isArray(v.model_type) && (v.model_type.includes('Image') || v.model_type.includes('Video'))
let priceKnown = 0
let mediaCount = 0
variants.forEach((v) => {
  if (!familyIds.has(v.family_id)) err(`${v.id}: family_id=${v.family_id} 不在 model_families`)
  else if (familyByProvider[v.family_id] !== v.provider_id) err(`${v.id}: family ${v.family_id} 属于 ${familyByProvider[v.family_id]}，但 variant.provider_id=${v.provider_id}`)
  if (!providerIds.has(v.provider_id)) err(`${v.id}: provider_id=${v.provider_id} 不存在`)
  const media = isMedia(v)
  if (media) {
    mediaCount++
    if (!v.media_pricing || typeof v.media_pricing !== 'object') err(`${v.id}: 媒体模型需 media_pricing 对象`)
    else {
      if (!['image', 'second'].includes(v.media_pricing.unit)) err(`${v.id}: media_pricing.unit=${v.media_pricing.unit} 非法`)
      if (v.media_pricing.price != null && typeof v.media_pricing.price !== 'number') err(`${v.id}: media_pricing.price 非数字`)
      if (v.media_pricing.currency && !['USD', 'CNY'].includes(v.media_pricing.currency)) err(`${v.id}: media_pricing.currency 非法`)
    }
    if (v.context_window != null) warn(`${v.id}: 媒体模型 context_window 应留空（用 media_pricing 表达）`)
  } else {
    if (v.context_window == null || v.context_window <= 0) err(`${v.id}: context_window 无效`)
    if (v.input_price_per_mtok != null && (typeof v.input_price_per_mtok !== 'number')) err(`${v.id}: input_price 非数字`)
    else if (v.input_price_per_mtok != null) priceKnown++
    if (v.currency && !['USD', 'CNY'].includes(v.currency)) err(`${v.id}: currency=${v.currency} 非法`)
    if (v.input_price_per_mtok != null && v.output_price_per_mtok == null) err(`${v.id}: 有输入价但缺输出价`)
  }
  const caps = v.capabilities || {}
  for (const dim of ['reasoning', 'coding', 'agent', 'knowledge', 'multilingual']) {
    if (!caps[dim]) { err(`${v.id}: 缺能力维度 ${dim}`); continue }
    if (!tierOk.has(caps[dim].tier)) err(`${v.id}: 能力 ${dim}.tier=${caps[dim].tier} 非法`)
    if (!caps[dim].basis || caps[dim].basis.length < 4) warn(`${v.id}: 能力 ${dim} 缺依据说明`)
  }
  ;(v.best_for || []).forEach((t) => { if (!taskIds.has(t)) err(`${v.id}: best_for 含未知任务 ${t}`) })
  ;(v.avoid_for || []).forEach((t) => { if (!taskIds.has(t)) warn(`${v.id}: avoid_for 含非任务标签 ${t}（能力/场景标签，可接受）`) })
  if (!v.one_liner_cn) err(`${v.id}: 缺一句话定位 one_liner_cn`)
  if (!v.source_url) warn(`${v.id}: 缺 source_url`)
  if (v.verified !== true) warn(`${v.id}: verified != true`)
})
ok(`文本模型价格已知 ${priceKnown}/${variants.length - mediaCount}；媒体模型 ${mediaCount} 个；未知价格的型号保持 null（不编造）`)

console.log('\n校验 recommendations：')
recs.forEach((r) => {
  if (!taskIds.has(r.task_id)) err(`${r.id}: task_id=${r.task_id} 不在 tasks`)
  if (!Array.isArray(r.model_ids)) { err(`${r.id}: model_ids 非数组`); return }
  r.model_ids.forEach((m) => {
    if (!variantIds.has(m.id)) err(`${r.id}: 引用未知型号 ${m.id}`)
    if (typeof m.score !== 'number' || m.score < 1 || m.score > 5) err(`${r.id}->${m.id}: score 必须在 1-5`)
    if (!m.reason) err(`${r.id}->${m.id}: 缺 reason`)
  })
  if (r.model_ids.length > 0) {
    const sorted = [...r.model_ids].sort((a, b) => b.score - a.score)
    if (sorted[0].id !== r.model_ids[0].id) warn(`${r.id}: 列表未按 score 降序（前端会重排，仅提示）`)
  }
})

console.log('\n校验命名解释系统：')
naming.forEach((n) => { if (!n.term || !n.name_cn || !n.description_cn) err(`naming ${n.term || '?'}: 字段不全`) })

console.log(`\n=== 结果：错误 ${errors}，警告 ${warns} ===`)
process.exit(errors > 0 ? 1 : 0)
