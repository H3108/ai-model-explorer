/**
 * 治理 v2.0 脚本（C级降权数据基础 + Benchmark/生态接入）
 * 对应 DATA_GOVERNANCE_REPORT.md §六「后续建议」
 *
 * 动作：
 *  1) 为 open_weight 模型补 repo_url（官方 HuggingFace 组织页；其余走 HF 搜索兜底，避免错链）
 *  2) 全量补 benchmarks 字段（schema 就绪，留待接入实时基准数据；本脚本不写死分数，避免编造）
 * 不删除、不改动既有字段；可重复运行（已存在则跳过 repo_url）。
 */
const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '..', 'data')
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const write = (f, o) => fs.writeFileSync(path.join(DIR, f), JSON.stringify(o, null, 2) + '\n', 'utf8')

// 已核实的官方 HuggingFace 组织页（仅收录 100% 确定的 org，其余走搜索兜底）
const PROVIDER_REPO = {
  meta: 'https://huggingface.co/meta-llama',
  deepseek: 'https://huggingface.co/deepseek-ai',
  'alibaba-qwen': 'https://huggingface.co/Qwen',
  mistral: 'https://huggingface.co/mistralai',
  blackforest: 'https://huggingface.co/black-forest-labs',
  stability: 'https://huggingface.co/stabilityai',
  kuaishou: 'https://huggingface.co/Kwai-Kolors',
}
const repoFor = (v) => {
  if (PROVIDER_REPO[v.provider_id]) return PROVIDER_REPO[v.provider_id]
  const q = encodeURIComponent(v.name || v.id)
  return `https://huggingface.co/models?search=${q}`
}

let repoAdded = 0
let benchAdded = 0
for (const file of ['model_variants.json', 'model_variants_extra.json']) {
  const arr = read(file)
  for (const v of arr) {
    if (v.open_weight && !v.repo_url) {
      v.repo_url = repoFor(v)
      repoAdded++
    }
    if (!Array.isArray(v.benchmarks)) {
      v.benchmarks = []
      benchAdded++
    }
  }
  write(file, arr)
}
console.log(`repo_url 新增: ${repoAdded} | benchmarks 字段补齐: ${benchAdded}`)
const vs = read('model_variants.json').concat(read('model_variants_extra.json'))
console.log('open_weight 总数:', vs.filter((v) => v.open_weight).length, '| 带 repo_url:', vs.filter((v) => v.repo_url).length)
