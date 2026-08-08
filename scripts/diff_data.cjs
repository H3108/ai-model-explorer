#!/usr/bin/env node
// Phase 1 — 将 data/.staging/collected.json 的 patch 与 data/ 当前记录做字段级 diff（仅白名单客观字段）。
// 产出 data/.staging/DATA_UPDATE_REPORT.md + diff.json。**不写回 data/**（人工确认后才 apply）。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// 用于"判定是否变动"的字段（排除 last_checked_at / source_url 这类每次都会变的溯源字段）
const COMPARE_FIELDS = [
  'input_price_per_mtok',
  'output_price_per_mtok',
  'context_window',
  'max_output_tokens',
  'release_date',
  'status',
  'media_pricing',
  'media_type',
];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function loadCurrent() {
  const main = loadJson(path.join(ROOT, 'data/model_variants.json'));
  const extra = loadJson(path.join(ROOT, 'data/model_variants_extra.json'));
  const map = new Map();
  for (const v of [...main, ...extra]) map.set(v.id, v);
  return { main, extra, map };
}

function main() {
  const staging = path.join(ROOT, 'data/.staging');
  const collectedPath = path.join(staging, 'collected.json');
  if (!fs.existsSync(collectedPath)) {
    console.error('✗ 没有 collected.json，请先运行: node scripts/run_collectors.cjs --offline');
    process.exit(2);
  }
  const collected = loadJson(collectedPath);
  const { map } = loadCurrent();
  const patches = (collected.patches || []).filter((p) => p._status === 'ok');

  const returnedByProvider = {};
  for (const p of patches) {
    (returnedByProvider[p.provider_id] = returnedByProvider[p.provider_id] || new Set()).add(p.id);
  }

  const changes = [];
  const news = [];
  for (const p of patches) {
    const cur = map.get(p.id);
    if (!cur) { news.push(p); continue; }
    const fieldChanges = [];
    for (const f of COMPARE_FIELDS) {
      if (p[f] === undefined || p[f] === null) continue;
      if (cur[f] !== p[f]) fieldChanges.push({ field: f, old: cur[f], new: p[f] });
    }
    if (fieldChanges.length) changes.push({ id: p.id, provider_id: p.provider_id, fields: fieldChanges });
  }

  // 疑似下架：仅在该源「实际覆盖」的型号范围内判断（coverage = 该源本次主动跟踪的型号 id）。
  // 避免未接入真实源/版本漂移的源把「本站有但没采到」误判为下架。
  const coverageByProvider = {};
  for (const s of (collected.sources || [])) {
    if (s.status !== 'ok' || !s.coverage) continue;
    (coverageByProvider[s.provider_id] = coverageByProvider[s.provider_id] || []).push(...s.coverage);
  }
  const deprecated = [];
  for (const [pid, cov] of Object.entries(coverageByProvider)) {
    const covSet = new Set(cov);
    for (const [id, cur] of map) {
      if (cur.provider_id === pid && covSet.has(id) && !returnedByProvider[pid].has(id)) deprecated.push({ id, provider_id: pid });
    }
  }

  const failed = (collected.sources || []).filter((s) => s.status === 'failed');

  const report = buildReport({ collected, changes, news, deprecated, failed });
  fs.mkdirSync(staging, { recursive: true });
  fs.writeFileSync(path.join(staging, 'DATA_UPDATE_REPORT.md'), report);
  fs.writeFileSync(path.join(staging, 'diff.json'), JSON.stringify({ generated_at: collected.generated_at, changes, news, deprecated, failed }, null, 2));

  console.log('=== 差异报告（Phase 1）===');
  console.log(`字段变动: ${changes.length} 条 | 新增候选: ${news.length} | 疑似下架: ${deprecated.length} | 失败源: ${failed.length}`);
  console.log('已写入 data/.staging/DATA_UPDATE_REPORT.md + diff.json');
}

function buildReport({ collected, changes, news, deprecated, failed }) {
  const L = [];
  L.push('# 数据同步差异报告\n');
  L.push(`> 生成时间: ${collected.generated_at} ｜ 模式: ${collected.mode}`);
  L.push('> ⚠️ 本报告仅作人工确认参考，**未自动修改** data/ 主数据。\n');
  L.push('## 摘要');
  L.push(`- 字段变动: **${changes.length}** 条（已存在型号的客观字段差异，可由人确认后合入）`);
  L.push(`- 新增候选: **${news.length}** 条（官方源出现但站內尚无，需人工补定性字段后入库）`);
  L.push(`- 疑似下架: **${deprecated.length}** 条（站內有但官方源未返回，需人工核销）`);
  L.push(`- 采集失败源: **${failed.length}** 个\n`);
  L.push('## 字段变动（客观字段，合入清单）');
  if (!changes.length) L.push('_无_');
  for (const c of changes) {
    L.push(`\n### ${c.id}`);
    for (const f of c.fields) L.push(`- \`${f.field}\`: ${JSON.stringify(f.old)} → ${JSON.stringify(f.new)}`);
  }
  L.push('\n## 新增候选（需人工补定性字段后入库）');
  if (!news.length) L.push('_无_');
  for (const n of news) L.push(`- ${n.id} （provider: ${n.provider_id}）`);
  L.push('\n## 疑似下架（请人工核销是否真的下架）');
  if (!deprecated.length) L.push('_无_');
  for (const d of deprecated) L.push(`- ${d.id} （provider: ${d.provider_id}）`);
  L.push('\n## 采集失败源');
  if (!failed.length) L.push('_无_');
  for (const f of failed) L.push(`- ${f.source}: ${f.error || '未知错误'}`);
  L.push('\n---\n人工确认后执行: `node scripts/apply_staging.cjs --apply`（仅合入以上字段变动，不动 free / 定性字段）');
  return L.join('\n');
}

main();
