// 生成《数据评审稿》——供用户拿去其它 AI 评审「模型覆盖度」与「设计合理性」
// 用法: node scripts/gen_data_review.js  -> 输出 DATA_REVIEW.md（项目根）
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', p), 'utf8'))

const providers = read('providers.json')
const families = read('model_families.json')
const main = read('model_variants.json')
const extra = read('model_variants_extra.json')
const tasks = read('tasks.json')
const recs = read('recommendations.json')
const naming = read('naming_guide.json')

const all = [...main, ...extra]
const byId = (arr, id) => arr.find((x) => x.id === id)
const pName = (id) => { const p = byId(providers, id); return p ? (p.name_cn || p.name) : id }
const fName = (id) => { const f = byId(families, id); return f ? (f.name_cn || f.name) : '—' }

// ---------- 统计 ----------
const vendors = providers.filter((p) => p.category !== 'gateway')
const gateways = providers.filter((p) => p.category === 'gateway')
const freeModels = all.filter((v) => v.free)

const modCount = {}
all.forEach((v) => { const m = v.media_type || v.modality || 'text'; modCount[m] = (modCount[m] || 0) + 1 })

const CAP = ['reasoning', 'coding', 'agent', 'knowledge', 'multilingual']
const capCount = {}; CAP.forEach((k) => (capCount[k] = 0))
all.forEach((v) => { const c = v.capabilities || {}; CAP.forEach((k) => { if (c[k] && c[k].tier) capCount[k]++ }) })

const ctxBucket = (cw) => {
  if (!cw) return '未知'
  if (cw < 32000) return '<32K'
  if (cw < 128000) return '32K–128K'
  if (cw < 256000) return '128K–256K'
  return '≥256K'
}
const ctxBuckets = {}
all.forEach((v) => { const b = ctxBucket(v.context_window); ctxBuckets[b] = (ctxBuckets[b] || 0) + 1 })

// 厂商维度统计
const perProvider = providers.map((p) => {
  const vs = all.filter((v) => v.provider_id === p.id)
  const fcnt = new Set(vs.map((v) => v.family_id).filter(Boolean)).size
  return { id: p.id, name: p.name_cn || p.name, cat: p.category || 'vendor', models: vs.length, families: fcnt, free: vs.filter((v) => v.free).length }
}).sort((a, b) => b.models - a.models)

// 免费按厂商
const freeByProv = {}
freeModels.forEach((v) => { const n = pName(v.provider_id); freeByProv[n] = (freeByProv[n] || 0) + 1 })

// ---------- 全量型号表 ----------
const capStr = (v) => CAP.filter((k) => v.capabilities && v.capabilities[k] && v.capabilities[k].tier).map((k) => k[0].toUpperCase()).join('')
const priceStr = (v) => v.free ? '免费' : (v.input_price_per_mtok != null ? `${v.currency || '$'}${v.input_price_per_mtok}/M` : '未公开')

let tableRows = all.map((v) => {
  const mod = v.media_type || v.modality || 'text'
  return `| ${v.id} | ${pName(v.provider_id)} | ${fName(v.family_id)} | ${v.name_cn || v.name || ''} | ${mod} | ${v.params || '—'} | ${v.context_window ? (v.context_window / 1000) + 'K' : '—'} | ${priceStr(v)} | ${capStr(v) || '—'} |`
}).join('\n')

// 免费模型 free_note
let freeNotes = freeModels.map((v) => `| ${pName(v.provider_id)} | ${v.name_cn || v.name} | ${v.free_note || '—'} |`).join('\n')

// ---------- 已知大厂覆盖判断（动态，基于实际数据，避免写死出错） ----------
const provNamesLow = providers.map((p) => (p.name || '').toLowerCase())
const has = (kw) => provNamesLow.some((n) => n.includes(kw))
const MAJOR = [
  ['OpenAI', 'openai'], ['Anthropic (Claude)', 'anthropic'], ['Google (Gemini/Gemma)', 'gemini'],
  ['Meta (Llama)', 'llama'], ['DeepSeek', 'deepseek'], ['Alibaba (Qwen)', 'qwen'], ['Zhipu (GLM)', 'zhipu'],
  ['Mistral', 'mistral'], ['Moonshot (Kimi)', 'kimi'], ['Tencent (Hunyuan)', 'hunyuan'], ['xAI (Grok)', 'xai'],
  ['Cohere', 'cohere'], ['Amazon (Nova/Titan)', 'amazon'], ['Perplexity', 'perplexity'], ['Apple', 'apple'],
  ['Stability (SD)', 'stability'], ['Black Forest (Flux)', 'black forest'], ['Runway', 'runway'], ['ElevenLabs', 'elevenlabs'],
]
const coverRows = MAJOR.map(([n, kw]) => `| ${n} | ${has(kw) ? '✅ 已收录（含付费）' : '❌ 未收录'} |`).join('\n')

// ---------- 待评审问题 ----------
const openQuestions = [
  'Q1 覆盖度：免费模型集中在 Groq/OpenRouter/NVIDIA NIM 网关(各 9–10 个)、智谱 GLM、Agnes 等；而 Claude、GPT-5、Grok 等虽已收录为付费标杆，但**免费层缺失**(Anthropic 无免费 API、xAI 无免费层)。真正完全未收录的主流厂为 Cohere / Amazon / Perplexity / Apple / ElevenLabs。评审者需判断：是否应补充这些缺失主流厂(哪怕付费)以提升参考完整性，还是维持「免费优先」聚焦？',
  'Q2 平衡：若补充付费标杆，是否破坏「免费优先」的产品定位？还是单列「标杆对照」区？',
  'Q3 能力维度：5 维（推理/编码/智能体/知识/多语）是否足够刻画模型差异？是否缺「数学」「创意写作」「长文档」等专业维度？',
  'Q4 硬筛选语义：能力维度改为 AND 硬筛选后，因 104/118 型号具备全部 5 维，单独筛选几乎不收窄；真正切量靠硬性条件（长上下文/视觉/开放权重/低成本/高速）。这是预期行为吗？',
  'Q5 数据时效：verified_date 多在 2026-08-05，价格/能力以厂商官方为准。是否有明显的已过期或缺失字段？',
  'Q6 命名解读：16 条术语是否覆盖用户最常见的困惑后缀？有无高频但遗漏的（如 Mini/Instruct/Instruct/Base/SFT/R1/V3）？',
  'Q7 推荐系统：14 任务 × 7 推荐 = 98 条，理由均基于字段。是否存在「推荐了但被硬筛选/价格排除」导致用户看不到的矛盾？',
  'Q8 设计结构：首页「30s 秒级选型」与现已被拆成「按厂商/按能力/任务选择器」三条路径的表述是否冲突？hero 数字是否应调整？',
]

const escT = (s) => (s == null ? '' : String(s))

const md = `# AI Model Explorer —— 数据评审稿（自包含 · 供外部 AI 评审）

> **用途**：本文由项目脚本于生成时自动汇总全站数据，可整体复制粘贴给其它 AI，用于评审两件事：
> ① **模型覆盖度**——是否覆盖了主流/必要的模型与厂商；② **设计合理性**——筛选/匹配/推荐的数据结构与口径是否成立。
> 全文自包含，无外链依赖。

---

## 0. 产品定位与目标用户
- **是什么**：一个纯前端、零后端的「AI 模型选型的导航与对比工具」。收录可程序化调用的模型（重点：真·免费 API），帮助用户按厂商 / 能力 / 任务三步找到合适模型。
- **目标用户**：开发者、产品经理、研究者等需要在众多模型里做选型的人；尤其关注「免费/低成本可上手」的群体。
- **核心约束（非常重要，决定覆盖边界）**：只收录**可免费或低成本程序化调用**的模型；明确不收录「仅网页对话」「仅赠金」「仅开放权重自部署」「仅企业试用额度」的形态。

## 1. 数据总览（量化）
| 指标 | 数值 |
| --- | --- |
| 主要厂商（非网关） | ${vendors.length} |
| 托管网关 | ${gateways.length} |
| 厂商合计 | ${providers.length} |
| 模型系列 | ${families.length} |
| 具体型号（主 + 增量） | ${all.length}（主 ${main.length} + 增量 ${extra.length}） |
| 免费型号 | ${freeModels.length} |
| 任务类型 | ${tasks.length} |
| 推荐条目 | ${recs.reduce((s, r) => s + (r.model_ids || []).length, 0)}（每任务 ${recs[0] ? recs[0].model_ids.length : '?'} 条） |
| 命名词典 | ${naming.length} 条 |

**模态分布**：${Object.entries(modCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(' · ')}
**能力维度命中（具备 tier 的型号数）**：${CAP.map((k)=>`${k}=${capCount[k]}`).join(' · ')}
**上下文窗口分布**：${Object.entries(ctxBuckets).sort().map(([k,v])=>`${k}=${v}`).join(' · ')}

## 2. 厂商清单与模型数
| 厂商 | 类别 | 型号数 | 系列数 | 免费数 |
| --- | --- | --- | --- | --- |
${perProvider.map((p)=>`| ${p.name} | ${p.cat} | ${p.models} | ${p.families} | ${p.free} |`).join('\n')}

**免费模型按厂商分布**：${Object.entries(freeByProv).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(' · ')}

## 3. 完整型号清单（全量，供覆盖度核对）
> 列：ID | 厂商 | 系列 | 名称(中) | 模态 | 参数 | 上下文 | 价格 | 能力(首字母 R/C/A/K/M)
| ID | 厂商 | 系列 | 名称 | 模态 | 参数 | 上下文 | 价格 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows}

### 3.1 免费模型的「免费依据」（口径证据）
| 厂商 | 模型 | 免费说明(free_note) |
| --- | --- | --- |
${freeNotes}

## 4. 能力 / 任务 / 推荐 / 命名 体系
- **5 个能力维度（capabilities，用于浏览页硬筛选与匹配打分）**：reasoning 推理 / coding 编码 / agent 智能体 / knowledge 知识 / multilingual 多语。每项存 \`{tier, basis}\`，tier∈{high,medium,low}，basis 为定性依据（不编造分数）。
- **5 个硬性条件（traits，浏览页硬筛选）**：long_context 长上下文(≥128K) / vision 视觉输入 / open_weight 开放权重 / low_cost 低成本(输入≤$1/M) / fast 高速。
- **${tasks.length} 类任务（任务选择器 matcher）**：${tasks.map((t)=>t.name_cn||t.name).join('、')}。
- **推荐**：每任务 ${recs[0]?recs[0].model_ids.length:'?'} 条，共 ${recs.reduce((s,r)=>s+(r.model_ids||[]).length,0)} 条；理由基于价格/上下文/能力 tier 等真实字段。
- **命名词典 ${naming.length} 条**：覆盖 Max/Ultra/Large、Turbo、Preview/Beta、MoE、VL/Omni、参数规模(7B/70B/671B)、Embedding/Rerank、Coder/Code、Mini、Instruct、Base、Flash、Lite、Pro、Nano 等。

## 5. 筛选与匹配逻辑（设计核心）
### 5.1 浏览页（#browse）硬筛选流程
1. 模态过滤（text/image/video）
2. 价格过滤（全部/免费/低成本/标准价）
3. **能力维度硬筛选（AND）**：选中 k 项能力 → 仅保留 \`capabilities[k].tier\` 全部存在的型号；缺任一即剔除
4. **硬性条件（AND）**：每项 trait 通过对应 test 函数判断
5. 排序：匹配度 / 价格 / 上下文 / 速度
> 注：能力维度为 AND 语义后，因多数型号具备全部 5 维，单独筛选收窄有限；硬切量主要靠硬性条件。

### 5.2 任务匹配（#matcher）打分
- 用户选任务 + 预算 + 速度偏好 → 取 recommendations 中该任务的候选 → 按 价格档 / 上下文 / 速度档 / 能力 tier 综合打分并排序，输出带理由的推荐列表。

## 6. 「免费」口径定义（关键设计决策）
**本站「免费」= 可免信用卡、可程序化调用、官方稳定免费层的 API key。** 明确**不算**免费：① 仅网页/Playground 免费 ② 网页免费+API 赠金 ③ 开放权重自部署（无授权费但需自备算力）④ 网页/额度免费。
此口径直接决定覆盖边界（见第 8 节盲区）。

## 7. 设计结构与导航
- 纯前端 vanilla JS SPA + hash 路由，无后端、无构建。
- 页面：首页 / 厂商(#providers) / 厂商详情 / 系列详情 / 浏览(#browse) / 任务匹配(#matcher) / 托管网关(#gateways) / 命名词典(#glossary) / 模型详情(#model)。
- 数据层：providers / model_families / model_variants(主) + model_variants_extra(增量，安全合并) / tasks / recommendations / naming_guide。
- 增量合并：extra 文件用 try/catch 加载，失败不影响主站。

## 8. 已知覆盖盲区与待评审问题
### 8.1 主要厂商覆盖判断
| 厂商 | 状态 |
| --- | --- |
${coverRows}

> 说明：未收录者主要因「无免费/可程序化 API key」或「仅网页/赠金」。评审者需判断这是合理聚焦还是过度收窄。

### 8.2 请评审者重点回答
${openQuestions.map((q)=>`${q}`).join('\n')}

## 9. 数据 Schema 速览（variant 关键字段）
\`\`\`json
{
  "id": "唯一ID",
  "model_id": "厂商 API 模型名",
  "name": "英文名", "name_cn": "中文名",
  "provider_id": "厂商ID", "family_id": "系列ID(可空)",
  "media_type": "text|image|video|audio",
  "params": "参数规模如 122B / 8x22B / 1.8T",
  "context_window": 256000,
  "max_output_tokens": 8192,
  "input_price_per_mtok": 0, "output_price_per_mtok": 0, "currency": "$",
  "free": true, "free_note": "免费依据",
  "open_weight": false, "vision_support": true, "speed_tier": "fast",
  "capabilities": { "reasoning": {"tier":"high","basis":"..."}, ... },
  "best_for": ["task_id"], "avoid_for": ["task_id"],
  "one_liner_cn": "一句话定位", "source_url": "...", "verified_date": "2026-08-05"
}
\`\`\`

---
*本文件由 scripts/gen_data_review.js 自动生成，可随时重新生成以跟随数据更新。*
`

fs.writeFileSync(path.join(ROOT, 'DATA_REVIEW.md'), md, 'utf8')
console.log('已生成 DATA_REVIEW.md，字数≈', md.length, '；型号行数', all.length)
