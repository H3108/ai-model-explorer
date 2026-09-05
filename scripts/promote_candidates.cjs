#!/usr/bin/env node
// Phase 5 —— 候选入库（Promotion）
//
// 把 data/model_candidates.json 中 status==='ready' 的候选，校验定性字段齐全后，
// 补全 schema 默认值并追加写入 data/model_variants_extra.json（app.js 会自动合并到站点）。
//
// 设计原则：
//   - 客观字段（价格/上下文）来自发现源，已在候选里填好，直接采用；
//   - 定性字段（name_cn / one_liner_cn / capabilities / best_for 等）必须由人工补齐，
//     这是「人审」环节，脚本不猜测、不杜撰；
//   - 入库前强制校验最小字段集，缺失则跳过该候选并报错，绝不写半截数据。
//
// 用法：
//   node scripts/promote_candidates.cjs            # 入库全部 ready 候选
//   node scripts/promote_candidates.cjs --dry-run  # 仅校验并打印将入库内容，不落盘
//   node scripts/promote_candidates.cjs --only glm-5-3

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAND = path.join(ROOT, 'data/model_candidates.json');
const EXTRA = path.join(ROOT, 'data/model_variants_extra.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// 入库门槛：这些字段必须有非空内容，否则视为「尚未填好定性字段」，跳过
const REQUIRED = ['name_cn', 'one_liner_cn'];
const CAP_DIMS = ['reasoning', 'coding', 'agent', 'knowledge', 'multilingual'];
const TIERS = new Set(['none', 'low', 'medium', 'high']);

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    console.error(`✗ 解析失败 ${p}: ${e.message}`);
    process.exit(1);
  }
}

// 把候选补齐成完整的 extra 条目（缺的定性字段给合理默认值，但只针对「允许默认」的项）
function buildEntry(c) {
  const id = c.id;
  const providerId = c.provider_id;
  const caps = c.capabilities || {};
  const capabilities = {};
  for (const dim of CAP_DIMS) {
    const v = caps[dim];
    capabilities[dim] = {
      tier: v && TIERS.has(v.tier) ? v.tier : 'medium',
      basis: (v && v.basis) || `${c.name || id} 该项由人工评估。`,
    };
  }
  return {
    id,
    family_id: c.family_id || providerId,
    provider_id: providerId,
    name: c.name || id,
    name_cn: c.name_cn,
    model_id: c.model_id || id,
    one_liner_cn: c.one_liner_cn,
    context_window: c.context_window ?? null,
    max_output_tokens: c.max_output_tokens ?? null,
    input_price_per_mtok: c.input_price_per_mtok ?? null,
    output_price_per_mtok: c.output_price_per_mtok ?? null,
    currency: c.currency || 'USD',
    vision_support: c.vision_support ?? false,
    open_weight: c.open_weight ?? false,
    speed_tier: c.speed_tier || 'medium',
    model_type: c.model_type || ['Chat'],
    capabilities,
    best_for: c.best_for || [],
    avoid_for: c.avoid_for || [],
    release_date: c.release_date || '',
    source_url: c.source_url || '',
    verified: false,
    free: c.free ?? false,
    free_note: c.free_note || '',
    aliases: c.aliases || [id],
    cost_tier: c.cost_tier || (c.free ? 'free' : 'production'),
    role: c.role || (c.model_type && c.model_type[0]) || 'chat',
    access_types: c.access_types || (c.free ? ['official_api', 'free_api'] : ['official_api']),
    status: 'active',
    data_quality_score: c.data_quality_score ?? 70,
    data_source: 'discovery',
    last_verified_at: DRY ? '' : new Date().toISOString().slice(0, 10),
    price_model: c.price_model || 'per_token',
    benchmarks: c.benchmarks || [],
  };
}

function validate(c) {
  const miss = [];
  for (const k of REQUIRED) if (!c[k] || String(c[k]).trim() === '') miss.push(k);
  const caps = c.capabilities || {};
  for (const dim of CAP_DIMS) {
    const v = caps[dim];
    if (!v || !v.tier) miss.push(`capabilities.${dim}.tier`);
    else if (!TIERS.has(v.tier)) miss.push(`capabilities.${dim}.tier(非法值:${v.tier})`);
  }
  return miss;
}

function main() {
  const candidates = loadJSON(CAND, []);
  if (!candidates.length) { console.log('候选中转区为空，无需入库。'); return; }

  const ready = candidates.filter((c) => c.status === 'ready' && (!ONLY || c.id === ONLY));
  if (!ready.length) {
    console.log(`无 ready 候选${ONLY ? `（filter=${ONLY}）` : ''}。先补全 data/model_candidates.json 的定性字段并把 status 设为 ready。`);
    return;
  }

  const extra = loadJSON(EXTRA, []);
  const existingIds = new Set(extra.map((m) => m.id));

  let promoted = 0, skipped = 0;
  const toPromote = [];
  for (const c of ready) {
    const miss = validate(c);
    if (miss.length) {
      console.log(`  ⚠ 跳过 ${c.id}：缺失定性字段 [${miss.join(', ')}]`);
      skipped++;
      continue;
    }
    if (existingIds.has(c.id)) {
      console.log(`  · 已存在于 extra（${c.id}），跳过重复`);
      skipped++;
      continue;
    }
    toPromote.push({ candidate: c, entry: buildEntry(c) });
  }

  if (DRY) {
    console.log(`\n[dry-run] 将入库 ${toPromote.length} 条，跳过 ${skipped} 条：`);
    for (const { entry } of toPromote) {
      console.log(`  + ${entry.id} (${entry.name_cn}) in=${entry.input_price_per_mtok} out=${entry.output_price_per_mtok}`);
    }
    return;
  }

  // 落盘：追加到 extra + 回写候选 status=promoted
  for (const { candidate, entry } of toPromote) {
    extra.push(entry);
    candidate.status = 'promoted';
    candidate.promoted_at = new Date().toISOString().slice(0, 10);
    promoted++;
  }
  fs.writeFileSync(EXTRA, JSON.stringify(extra, null, 2) + '\n');
  fs.writeFileSync(CAND, JSON.stringify(candidates, null, 2) + '\n');

  console.log(`\n✓ 已入库 ${promoted} 条到 data/model_variants_extra.json${skipped ? `，跳过 ${skipped} 条` : ''}。`);
  if (promoted) console.log('  下一步：git add data/ && git commit（数据变更走正常提交，不进自动同步）。');
}

main();
