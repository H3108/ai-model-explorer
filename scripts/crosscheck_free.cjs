/**
 * 真·免费 API 交叉核对（一次性 / 周期性均可）
 * 运行：node scripts/crosscheck_free.cjs [外部README路径]
 * 默认外部源：/tmp/afm_readme.md（先 `curl -sL https://raw.githubusercontent.com/12britz/awesome-free-models/main/README.md -o /tmp/afm_readme.md`）
 * 产出：FREE_CROSSCHECK_REPORT.md
 *
 * 口径（来自项目约定）：「真·免费」= 免信用卡、可程序化调用、官方稳定免费层。
 * 以下三类不算本站免费：① 仅网页/Playground 免费 ② 网页免费+API 赠金 ③ 开放权重自部署 ④ 网页/额度免费。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const readmePath = process.argv[2] || '/tmp/afm_readme.md'

const j = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const providers = j('data/providers.json')
const mainVars = j('data/model_variants.json')
const extraVars = j('data/model_variants_extra.json')

const freeProv = providers.filter((p) => p.category === 'free' || p.category === 'gateway')
const freeVars = extraVars.filter((v) => v.free).concat(mainVars.filter((v) => v.free))

// 外部免费厂商关键词 → 本站 provider id（用于双向匹配）
const MAP = [
  ['Groq', 'groq'], ['OpenRouter', 'openrouter'], ['NVIDIA NIM', 'nvidia-nim'],
  ['Mistral', 'mistral'], ['Cerebras', 'cerebras'], ['DeepSeek', 'deepseek'],
  ['Qwen', 'qwen'], ['Kimi', 'kimi'], ['GLM', 'glm'], ['Zhipu', 'zhipu'],
  ['Alibaba', 'alibaba'], ['DashScope', 'dashscope'], ['Cloudflare', 'cloudflare'],
  ['GitHub Models', 'github'], ['Google AI Studio', 'google'], ['Google', 'google'],
  ['Hugging Face', 'huggingface'], ['Fireworks', 'fireworks'], ['Together', 'together'],
  ['SambaNova', 'sambanova'], ['OVH', 'ovh-ai'], ['Chutes', 'chutes'], ['Cohere', 'cohere'],
  ['Perplexity', 'perplexity'], ['BazaarLink', 'bazaarlink'], ['Requesty', 'requesty'],
  ['AnyAPI', 'anyapi'], ['Agnes', 'agnes'], ['OpenCode', 'opencode-zen'], ['FreeAI', 'freeai'],
  ['Scaleway', 'scaleway'], ['Replicate', 'replicate'], ['Featherless', 'featherless'],
  ['Lambda', 'lambda'], ['Azure', 'azure'], ['Amazon Bedrock', 'bedrock'], ['Vertex', 'vertex'],
  ['OpenAI', 'openai'], ['Anthropic', 'anthropic'], ['Meta', 'meta'], ['MiniMax', 'minimax'],
  ['StepFun', 'stepfun'], ['Z.ai', 'zai'], ['LongCat', 'longcat'], ['Coze', 'coze'],
  ['ModelScope', 'modelscope'], ['Vercel', 'vercel'], ['Glhf', 'glhf'], ['TensorBlock', 'tensorblock'],
]

function main() {
  if (!fs.existsSync(readmePath)) {
    console.error('未找到外部 README:', readmePath, '\n请先执行: curl -sL https://raw.githubusercontent.com/12britz/awesome-free-models/main/README.md -o /tmp/afm_readme.md')
    process.exit(1)
  }
  const readme = fs.readFileSync(readmePath, 'utf8')

  // 1) 本站 free 厂商在外部清单的覆盖
  const ourCovered = []
  const ourMissing = [] // 外部清单未提及 → 需人工复核是否仍有效
  for (const p of freeProv) {
    const labels = MAP.filter(([, id]) => id === p.id).map(([l]) => l)
    const hit = labels.some((l) => readme.includes(l))
    ;(hit ? ourCovered : ourMissing).push(p)
  }

  // 2) 外部免费厂商本站缺失（候选新增）
  const ourIds = new Set(freeProv.map((p) => p.id))
  const candidates = []
  for (const [label, id] of MAP) {
    if (readme.includes(label) && !ourIds.has(id)) candidates.push(label)
  }

  // 3) 装配报告
  const lines = []
  lines.push('# 真·免费 API 交叉核对报告')
  lines.push('')
  lines.push(`生成: ${new Date().toISOString()}`)
  lines.push(`外部源: 12britz/awesome-free-models (${readmePath})`)
  lines.push(`本站口径: free/gateway 厂商 ${freeProv.length} 家, free:true 型号 ${freeVars.length} 个`)
  lines.push('')
  lines.push('## A. 本站免费厂商 — 外部清单已确认')
  lines.push('')
  lines.push('| 厂商 | id | 类别 |')
  lines.push('|---|---|---|')
  for (const p of ourCovered) lines.push(`| ${p.name || p.id} | ${p.id} | ${p.category} |`)
  lines.push('')
  lines.push('## B. 本站免费厂商 — 外部清单未提及（需人工复核是否仍有效 / 是否为小众网关）')
  lines.push('')
  if (ourMissing.length === 0) lines.push('_（全部在外部清单中被提及）_')
  else {
    lines.push('| 厂商 | id | 类别 | 风险 |')
    lines.push('|---|---|---|---|')
    for (const p of ourMissing) lines.push(`| ${p.name || p.id} | ${p.id} | ${p.category} | 建议重新核验免费层是否仍可用 |`)
  }
  lines.push('')
  lines.push('## C. 外部免费厂商 — 本站缺失（候选新增）')
  lines.push('')
  if (candidates.length === 0) lines.push('_（无新增候选）_')
  else lines.push('> ' + candidates.join('、'))
  lines.push('')
  lines.push('## D. 核对结论')
  lines.push('')
  lines.push(`- 本站 ${freeProv.length} 家免费厂商中，${ourCovered.length} 家被外部权威清单佐证，${ourMissing.length} 家需人工复核。`)
  lines.push(`- 外部清单中 ${candidates.length} 家免费厂商本站尚未收录，可作为下一轮数据扩充候选。`)
  lines.push('- 本次仅做"厂商级"覆盖核对；型号级（具体免费模型 id / 速率限制）需逐家打开官方免费层页二次确认。')
  lines.push('- 注：外部清单含大量"开放权重自部署 / 网页免费 / 赠金"项，按本站口径**不计入**免费，故候选列表已按口径过滤。')

  const out = lines.join('\n')
  fs.writeFileSync(path.join(ROOT, 'FREE_CROSSCHECK_REPORT.md'), out)
  console.log(out)
  console.log('\n报告已写入 FREE_CROSSCHECK_REPORT.md')
}

main()
