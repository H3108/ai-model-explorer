#!/usr/bin/env node
// 更新型号的 verified_date —— 数据核实完成后跑一次，全站「数据于 X 联网核实」文案自动跟随。
//
// 用法：
//   node scripts/bump_verified.cjs --check              查看当前核验日期分布（不写文件）
//   node scripts/bump_verified.cjs --all                把全部型号标记为今天
//   node scripts/bump_verified.cjs --id a,b,c           只更新指定型号
//   node scripts/bump_verified.cjs --provider openai    只更新某厂商的型号
//   node scripts/bump_verified.cjs --all --date 2026-08-10   指定日期而非今天
//   node scripts/bump_verified.cjs --all --dry-run      预演，只打印不落盘
//
// 注意：日期是「你确实去核对过官方页面」的凭据，别为了让站点显示新鲜就无脑 --all。
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'data')
const FILES = ['model_variants.json', 'model_variants_extra.json']

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}

const today = () => new Date().toISOString().slice(0, 10)
const targetDate = value('date') || today()
if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error(`✗ 日期格式非法：${targetDate}（应为 YYYY-MM-DD）`)
  process.exit(1)
}

// 读入两个数据文件，记录每条记录来自哪个文件，便于按原文件写回
const buckets = FILES.map((f) => {
  const p = path.join(DIR, f)
  if (!fs.existsSync(p)) return { file: f, path: p, list: [], missing: true }
  return { file: f, path: p, list: JSON.parse(fs.readFileSync(p, 'utf8')) }
}).filter((b) => !b.missing)

const all = buckets.flatMap((b) => b.list)

// --check：只报告分布
if (flag('check') || argv.length === 0) {
  const byDate = {}
  all.forEach((v) => { const d = v.verified_date || '(缺失)'; byDate[d] = (byDate[d] || 0) + 1 })
  const dates = Object.keys(byDate).filter((d) => d !== '(缺失)').sort()
  console.log(`型号总数：${all.length}`)
  Object.entries(byDate).sort().forEach(([d, n]) => console.log(`  ${d}  ${n} 个`))
  if (dates.length) {
    const latest = dates[dates.length - 1]
    const age = Math.floor((Date.now() - Date.parse(latest + 'T00:00:00Z')) / 86400000)
    console.log(`\n最新核验：${latest}（距今 ${age} 天）${age > 30 ? ' ⚠ 建议重新核实' : ''}`)
    console.log(`站点显示的日期即为：${latest}`)
  }
  if (argv.length === 0) console.log('\n提示：加 --all / --id / --provider 才会写入，--help 见脚本头部注释。')
  process.exit(0)
}

// 选择要更新的型号
let match
if (flag('all')) {
  match = () => true
} else if (value('id')) {
  const ids = new Set(value('id').split(',').map((s) => s.trim()).filter(Boolean))
  match = (v) => ids.has(v.id)
} else if (value('provider')) {
  const pid = value('provider')
  match = (v) => v.provider_id === pid
} else {
  console.error('✗ 需指定范围：--all | --id a,b | --provider <id>（或用 --check 查看现状）')
  process.exit(1)
}

const dry = flag('dry-run')
let changed = 0
const changedIds = []
buckets.forEach((b) => {
  let touched = false
  b.list.forEach((v) => {
    if (!match(v)) return
    if (v.verified_date === targetDate) return
    v.verified_date = targetDate
    changed++
    changedIds.push(v.id)
    touched = true
  })
  if (touched && !dry) {
    // 保持 2 空格缩进与文件末尾换行，与仓库现有 JSON 风格一致，减少 diff 噪音
    fs.writeFileSync(b.path, JSON.stringify(b.list, null, 2) + '\n', 'utf8')
    console.log(`  ✓ 写入 data/${b.file}`)
  }
})

if (!changed) {
  console.log(`无需更新：匹配到的型号 verified_date 已经是 ${targetDate}`)
  process.exit(0)
}
console.log(`${dry ? '[预演] ' : ''}已将 ${changed} 个型号的 verified_date 设为 ${targetDate}`)
console.log(`  ${changedIds.slice(0, 10).join(', ')}${changedIds.length > 10 ? ` … 等 ${changedIds.length} 个` : ''}`)
if (dry) console.log('（--dry-run 未写入任何文件）')
else console.log('\n下一步：node scripts/validate_normalized.cjs 校验，站点文案会自动显示新日期。')
