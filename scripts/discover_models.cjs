#!/usr/bin/env node
// Phase 5 —— 新模型发现（Discovery）
//
// 背景（为什么要这个脚本）：现有采集链路是「拿本站已有 id 去源上查价」，
// 结构上永远发现不了新模型 —— 官方发布了 GLM-5.3、本站没有该 id，就永远查不到它。
// 这正是「GLM 都出 5.3 了项目里还没有」的根因。
//
// 本脚本反过来做：从聚合源拉【全量型号清单】，与本站已有 id 做反向比对，
// 产出「站外有、站内没有」的候选清单，供人工补定性字段后入库。
//
// 数据源：
//   OpenRouter（431 模型，覆盖 openai/anthropic/google/deepseek/qwen/zhipu/nvidia）
//   LiteLLM   （3561 条目，额外覆盖 groq/together/cloudflare/replicate）
//
// 产出：
//   data/.staging/discovered.json    机器可读候选清单
//   data/.staging/DISCOVERY_REPORT.md 人工阅读报告
//   --write-candidates 时，把候选合并写入 data/model_candidates.json（不覆盖人工已填内容）
//
// 数据诚信：只做精确前缀匹配 + 反向归一化，匹配不上不猜测；变体后缀（:free/:batch 等）一律跳过。

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write-candidates');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// OpenRouter：本站 provider_id -> { prefix: OR id 前缀, ourPrefix: 本站 id 前缀 }
// ourPrefix 为空表示本站 id 不带厂商前缀（如智谱的 glm-5-2、DeepSeek 的 deepseek-v3）
const OR_REVERSE = {
  openai: { prefix: 'openai/', ourPrefix: 'openai-' },
  anthropic: { prefix: 'anthropic/', ourPrefix: 'anthropic-' },
  google: { prefix: 'google/', ourPrefix: 'google-' },
  deepseek: { prefix: 'deepseek/', ourPrefix: '' },
  'alibaba-qwen': { prefix: 'qwen/', ourPrefix: '' },
  'zhipu-glm': { prefix: 'z-ai/', ourPrefix: '' },
  'nvidia-nim': { prefix: 'nvidia/', ourPrefix: '' },
};

// LiteLLM：本站 provider_id（见 collectors/_litellm.js PROVIDER_MAP）
const LITELLM_PROVIDERS = ['groq', 'together', 'cloudflare', 'replicate'];

function perMtok(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 1e6 * 1e4) / 1e4;
}

function loadCurrentIds() {
  const ids = new Set();
  const byProvider = {};
  for (const f of ['data/model_variants.json', 'data/model_variants_extra.json']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const list = Array.isArray(data) ? data : (data.model_variants || data.variants || []);
    for (const m of list) {
      ids.add(m.id);
      (byProvider[m.provider_id] = byProvider[m.provider_id] || new Set()).add(m.id);
    }
  }
  return { ids, byProvider };
}

// OpenRouter id -> 建议的本站 id（反向归一化）；不属于该 provider 返回 null
function reverseOpenRouterId(orId, cfg) {
  if (!orId.startsWith(cfg.prefix)) return null;
  const rest = orId.slice(cfg.prefix.length).replace(/\./g, '-');
  return cfg.ourPrefix + rest;
}

// 跳过噪音变体：:free / :batch / :beta / :extended / :thinking 等 OpenRouter 后缀
function isVariant(orId) {
  return orId.includes(':');
}

function titleCase(id) {
  // 由 id 生成「建议展示名」，仅作初稿，人工可在候选中转区改
  return String(id)
    .split(/[-_]/)
    .map((s) => (s.length <= 3 && /^[a-z]+$/.test(s) ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1)))
    .join(' ');
}

async function discoverOpenRouter(providerId, known) {
  const { getOpenRouterModels } = await import(pathToFileURL(path.join(ROOT, 'collectors/_openrouter.js')).href);
  const cfg = OR_REVERSE[providerId];
  if (!cfg) return [];
  const models = await getOpenRouterModels();
  const out = [];
  for (const m of models) {
    const orId = String(m.id);
    if (isVariant(orId)) continue;
    const suggested = reverseOpenRouterId(orId, cfg);
    if (!suggested || known.has(suggested)) continue;
    out.push({
      provider_id: providerId,
      suggested_id: suggested,
      name_guess: titleCase(suggested),
      source: 'openrouter',
      source_key: orId,
      input_price_per_mtok: perMtok(m.pricing && m.pricing.prompt),
      output_price_per_mtok: perMtok(m.pricing && m.pricing.completion),
      context_window: m.context_length ? Math.floor(Number(m.context_length)) : undefined,
      source_url: `https://openrouter.ai/models/${orId}`,
    });
  }
  return out;
}

async function discoverLiteLLM(providerId, byProvider) {
  const { discoverFromLiteLLM } = await import(pathToFileURL(path.join(ROOT, 'collectors/_litellm.js')).href);
  // 仅传该 provider 自己的本站 id，避免跨 provider 归一化误命中
  const ourIds = [...(byProvider[providerId] || [])];
  const found = await discoverFromLiteLLM(providerId, ourIds);
  return found.map((f) => ({
    provider_id: f.provider_id,
    suggested_id: f.suggested_id,
    name_guess: titleCase(f.suggested_id),
    source: 'litellm',
    source_key: f.litellm_key,
    input_price_per_mtok: f.input_price_per_mtok,
    output_price_per_mtok: f.output_price_per_mtok,
    context_window: f.context_window,
    source_url: f.source_url,
  }));
}

function buildReport(candidates, bySource) {
  const L = [];
  L.push('# 新模型发现报告\n');
  L.push(`> 生成时间: ${new Date().toISOString().slice(0, 10)}`);
  L.push('> 来源：OpenRouter 全量模型 + LiteLLM 聚合库；仅列「站外有、站内没有」的候选。');
  L.push('> 候选需人工补定性字段（name / one_liner_cn / capabilities 等）后才能入库——客观字段已自动填好。\n');
  L.push('## 摘要');
  L.push(`- 候选总数: **${candidates.length}**`);
  for (const [src, n] of Object.entries(bySource)) L.push(`- ${src}: ${n}`);
  const byProv = {};
  for (const c of candidates) byProv[c.provider_id] = (byProv[c.provider_id] || 0) + 1;
  L.push('');
  for (const [p, n] of Object.entries(byProv).sort((a, b) => b[1] - a[1])) L.push(`  - ${p}: ${n}`);
  L.push('\n## 候选清单（按厂商分组）\n');
  for (const p of Object.keys(byProv).sort()) {
    L.push(`### ${p}\n`);
    L.push('| 建议 id | 展示名(初稿) | 输入 /Mtok | 输出 /Mtok | 上下文 | 来源 key |');
    L.push('|---|---|---|---|---|---|');
    for (const c of candidates.filter((x) => x.provider_id === p)) {
      L.push(`| \`${c.suggested_id}\` | ${c.name_guess} | ${c.input_price_per_mtok ?? '-'} | ${c.output_price_per_mtok ?? '-'} | ${c.context_window ?? '-'} | \`${c.source_key}\` |`);
    }
    L.push('');
  }
  L.push('---\n下一步: 人工在 `data/model_candidates.json` 补全定性字段，再执行 `node scripts/promote_candidates.cjs` 入库。');
  return L.join('\n');
}

async function main() {
  const { ids, byProvider } = loadCurrentIds();
  console.log('=== 新模型发现（Phase 5）===');
  console.log(`本站现有型号: ${ids.size} 个，涉及 ${Object.keys(byProvider).length} 个厂商`);

  const tasks = [];
  for (const p of Object.keys(OR_REVERSE)) {
    if (ONLY && p !== ONLY) continue;
    tasks.push({ p, via: 'openrouter' });
  }
  for (const p of LITELLM_PROVIDERS) {
    if (ONLY && p !== ONLY) continue;
    tasks.push({ p, via: 'litellm' });
  }

  const candidates = [];
  const bySource = { openrouter: 0, litellm: 0 };
  for (const { p, via } of tasks) {
    try {
      const found = via === 'openrouter'
        ? await discoverOpenRouter(p, ids)
        : await discoverLiteLLM(p, byProvider);
      bySource[via] += found.length;
      candidates.push(...found);
      console.log(`  ${p} (${via}): 发现 ${found.length} 个候选`);
    } catch (e) {
      console.log(`  ${p} (${via}): 失败 — ${e.message}`);
    }
  }

  // 同一 suggested_id 可能被多源重复发现，去重保留首个
  const seen = new Set();
  const uniq = candidates.filter((c) => {
    if (seen.has(c.suggested_id)) return false;
    seen.add(c.suggested_id);
    return true;
  });

  const staging = path.join(ROOT, 'data/.staging');
  fs.mkdirSync(staging, { recursive: true });
  fs.writeFileSync(
    path.join(staging, 'discovered.json'),
    JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), count: uniq.length, candidates: uniq }, null, 2)
  );
  fs.writeFileSync(path.join(staging, 'DISCOVERY_REPORT.md'), buildReport(uniq, bySource));

  console.log(`\n候选总数: ${uniq.length}（OpenRouter ${bySource.openrouter} / LiteLLM ${bySource.litellm}）`);
  console.log('已写入 data/.staging/discovered.json + DISCOVERY_REPORT.md');

  if (WRITE) {
    writeCandidates(uniq);
  }
}

// 合并写入候选中转区：已存在的条目保留（含人工填写的定性字段），只补新条目
// 返回本次新增的候选 id 列表（供 CI 判定是否开 Issue 提醒人工补录）
function writeCandidates(candidates) {
  const p = path.join(ROOT, 'data/model_candidates.json');
  let existing = [];
  if (fs.existsSync(p)) {
    try { existing = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { existing = []; }
  }
  const byId = new Map(existing.map((c) => [c.id, c]));
  const addedIds = [];
  for (const c of candidates) {
    const id = c.suggested_id;
    if (byId.has(id)) continue; // 已存在（可能人工正在填）-> 不动
    byId.set(id, {
      id,
      provider_id: c.provider_id,
      name: c.name_guess,
      name_cn: '',
      one_liner_cn: '',
      context_window: c.context_window,
      input_price_per_mtok: c.input_price_per_mtok,
      output_price_per_mtok: c.output_price_per_mtok,
      source: c.source,
      source_key: c.source_key,
      source_url: c.source_url,
      discovered_at: new Date().toISOString().slice(0, 10),
      status: 'pending', // pending -> ready(定性字段补齐) -> promoted(已入库)
    });
    addedIds.push(id);
  }
  fs.writeFileSync(p, JSON.stringify([...byId.values()], null, 2) + '\n');
  // 把本次新增 id 导出到 staging，供 CI 解析
  fs.writeFileSync(
    path.join(ROOT, 'data/.staging/new_candidates.json'),
    JSON.stringify({ date: new Date().toISOString().slice(0, 10), added: addedIds }, null, 2)
  );
  console.log(`候选中转区: 新增 ${addedIds.length} 条，现有 ${byId.size} 条 -> data/model_candidates.json`);
  return addedIds;
}

main().catch((e) => { console.error(e); process.exit(1); });
