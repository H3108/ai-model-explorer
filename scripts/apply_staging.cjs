#!/usr/bin/env node
// Phase 1 — 人工确认后，将 diff 中的「字段变动」合入 data/（仅白名单客观字段）。
// 默认 --dry-run（只打印不写）；--apply 才真正写入。
// 安全网：free / free_note / 非白名单字段一律拒绝写入；绝不自动改主数据以外的内容。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OBJECTIVE = [
  'input_price_per_mtok',
  'output_price_per_mtok',
  'context_window',
  'max_output_tokens',
  'release_date',
  'status',
  'media_pricing',
  'media_type',
  'source_url',
  'last_checked_at',
];
const DRY = !process.argv.includes('--apply');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function main() {
  const diffPath = path.join(ROOT, 'data/.staging/diff.json');
  if (!fs.existsSync(diffPath)) {
    console.error('✗ 没有 diff.json，请先运行 run_collectors + diff_data');
    process.exit(2);
  }
  const diff = loadJson(diffPath);
  const main = loadJson(path.join(ROOT, 'data/model_variants.json'));
  const extra = loadJson(path.join(ROOT, 'data/model_variants_extra.json'));

  const byId = new Map();
  for (const v of main) byId.set(v.id, { rec: v, file: 'main' });
  for (const v of extra) byId.set(v.id, { rec: v, file: 'extra' });

  const plan = [];
  for (const c of diff.changes || []) {
    const hit = byId.get(c.id);
    if (!hit) { plan.push({ id: c.id, status: 'skip(无对应记录)' }); continue; }
    const applied = {};
    for (const f of c.fields) {
      if (!OBJECTIVE.includes(f.field)) { applied[f.field] = 'BLOCKED(非白名单)'; continue; }
      if (f.field === 'free' || f.field === 'free_note') { applied[f.field] = 'BLOCKED(free 字段不自动写)'; continue; }
      hit.rec[f.field] = f.new;
      applied[f.field] = 'applied';
    }
    plan.push({ id: c.id, file: hit.file, applied });
  }

  console.log('=== 应用 Staging（' + (DRY ? 'dry-run' : 'APPLY') + '）===');
  for (const p of plan) console.log(JSON.stringify(p));
  if (DRY) {
    console.log('\n(dry-run) 未写入。确认无误后加 --apply 执行。');
    return;
  }
  fs.writeFileSync(path.join(ROOT, 'data/model_variants.json'), JSON.stringify(main, null, 2));
  fs.writeFileSync(path.join(ROOT, 'data/model_variants_extra.json'), JSON.stringify(extra, null, 2));
  console.log('\n✓ 已合入 data/（仅客观字段）。建议随后: npm run bump -- --all && git commit && npm run deploy');
}

main();
