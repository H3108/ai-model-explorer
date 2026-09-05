// LiteLLM 聚合源客户端（ESM，供官方源适配器与发现脚本复用）
//
// 为什么用 LiteLLM：OpenRouter 覆盖不到 Groq / Together / Cloudflare / Replicate 等「推理托管平台」
// （这些平台的定价是自己的，不等于 OpenRouter 上的同款模型定价）。LiteLLM 的
// model_prices_and_context_window.json 是一个社区维护的公开聚合库，免密钥、纯静态 JSON，
// 覆盖 3500+ 条目，含 input/output_cost_per_token 与 max_input_tokens，正好补上这块。
//
// 数据诚信（与 _openrouter.js 同一纪律）：
//   只做「本站 id ↔ LiteLLM 型号名」的【精确匹配】——查表优先，其次规则归一化后精确比对；
//   匹配不上就跳过并记录到 unmatched，绝不模糊猜测、绝不用相似度凑数。
//
// 本文件以下划线开头且不继承 BaseCollector，不会被 _registry 当作 Collector 加载（已加入 SKIP）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toNum, toInt } from './_base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// 读本站某 provider 现存的型号 id（主文件 + 增量文件）
export function readOurModelIds(providerId) {
  const ids = [];
  for (const f of ['data/model_variants.json', 'data/model_variants_extra.json']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const list = Array.isArray(data) ? data : (data.model_variants || data.variants || []);
    for (const m of list) if (m.provider_id === providerId) ids.push(m.id);
  }
  return ids;
}

const LITELLM_ENDPOINT =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// 本站 provider_id -> LiteLLM 的 litellm_provider 取值
// 未列入的 provider（如 huggingface）表示 LiteLLM 无对应定价数据，保持桩源。
export const PROVIDER_MAP = {
  groq: 'groq',
  together: 'together_ai',
  cloudflare: 'cloudflare',
  replicate: 'replicate',
  'zhipu-glm': 'zai',
};

// 精确映射表：本站 id -> LiteLLM 型号名（已去掉 provider 前缀、小写）
// 规则归一化搞不定的（版本后缀、组织前缀差异）在此手工登记，每条都是人工核对过的真实对应。
export const ID_MAP = {
  groq: {
    'groq-llama-3-3-70b': 'llama-3.3-70b-versatile',
    'groq-llama-3-1-8b-instant': 'llama-3.1-8b-instant',
    'groq-llama-4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
    'groq-llama-4-maverick': 'meta-llama/llama-4-maverick-17b-128e-instruct',
    'groq-qwen3-32b': 'qwen/qwen3-32b',
    'groq-kimi-k2': 'moonshotai/kimi-k2-instruct-0905',
    'groq-whisper-large-v3': 'whisper-large-v3',
  },
  together: {},
  cloudflare: {},
  replicate: {},
  'zhipu-glm': {},
};

// 仅这些 mode 有 per-token 定价；image_generation / audio_* 等按张/按秒计费，
// 与本站 price_model=per_token 字段不匹配，一律跳过（避免写入假价格）。
const TOKEN_MODES = new Set(['chat', 'completion', 'embedding']);

let _cache = null;
export async function getLiteLLMModels() {
  if (_cache) return _cache;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(LITELLM_ENDPOINT, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ai-model-explorer-collector/1.0' },
    });
    if (!res.ok) throw new Error(`LiteLLM HTTP ${res.status}`);
    const d = await res.json();
    _cache = d && typeof d === 'object' ? d : {};
    return _cache;
  } finally {
    clearTimeout(t);
  }
}

// 取某 provider 在 LiteLLM 上的全部条目，统一成 { key, name, entry } 形态
// name = key 去掉 provider 前缀后小写（用于与本站 id 比对）
export async function listProviderModels(providerId) {
  const llmProvider = PROVIDER_MAP[providerId];
  if (!llmProvider) return [];
  const all = await getLiteLLMModels();
  const out = [];
  for (const [key, entry] of Object.entries(all)) {
    if (!entry || entry.litellm_provider !== llmProvider) continue;
    if (entry.deprecated === true) continue;
    const name = (key.startsWith(llmProvider + '/') ? key.slice(llmProvider.length + 1) : key).toLowerCase();
    out.push({ key, name, entry });
  }
  return out;
}

// 规则归一化：本站 id -> 候选名（去 provider 前缀、数字连字符转点）
// 例：glm-5-3 -> glm-5.3 ；llama-3-3-70b -> llama-3.3-70b
export function normalizeOurId(ourId, providerId) {
  let s = String(ourId).toLowerCase();
  const prefix = providerId + '-';
  if (s.startsWith(prefix)) s = s.slice(prefix.length);
  return s.replace(/(\d)-(\d)/g, '$1.$2');
}

function perMtok(v) {
  const n = toNum(v);
  if (n === undefined) return undefined;
  return Math.round(n * 1e6 * 1e4) / 1e4; // per token -> per Mtok，保留 4 位小数
}

// 把 LiteLLM 条目转成本站 patch（仅白名单客观字段）
// 返回 { patch } 或 { reason } —— reason 区分「非 per-token 计费」与「无定价数据」，便于人工判断。
function toPatch(ourId, m) {
  const e = m.entry;
  if (!TOKEN_MODES.has(e.mode)) return { reason: `非 per-token 计费（mode=${e.mode}）` };
  const input = perMtok(e.input_cost_per_token);
  const output = perMtok(e.output_cost_per_token);
  if (input === undefined && output === undefined) return { reason: '无定价数据' }; // 不产生假数据
  const patch = {
    id: ourId,
    input_price_per_mtok: input,
    output_price_per_mtok: output,
    context_window: toInt(e.max_input_tokens),
  };
  if (e.max_output_tokens !== undefined) patch.max_output_tokens = toInt(e.max_output_tokens);
  patch.source_url = 'https://models.litellm.ai/';
  return { patch };
}

// ——能力一：更新本站已有型号的客观字段——
export async function collectFromLiteLLM(providerId, ourIds) {
  const models = await listProviderModels(providerId);
  if (!models.length) return { patches: [], coverage: [], unmatched: [] };
  const byName = new Map(models.map((m) => [m.name, m]));
  const exact = ID_MAP[providerId] || {};

  const patches = [];
  const coverage = [];
  const unmapped = []; // 查不到型号（版本漂移或已下架）
  const skipped = [];  // 型号在，但计费模式/定价不匹配本站字段

  for (const ourId of ourIds) {
    const mapped = exact[ourId];
    const cand = (mapped ? mapped : normalizeOurId(ourId, providerId)).toLowerCase();
    const m = byName.get(cand);
    if (!m) { unmapped.push(ourId); continue; } // 精确匹配不上 -> 跳过，绝不猜测
    const r = toPatch(ourId, m);
    if (!r.patch) { skipped.push({ id: ourId, reason: r.reason }); continue; }
    patches.push(r.patch);
    coverage.push(ourId);
  }
  return { patches, coverage, unmapped, skipped };
}

// ——能力二：发现 LiteLLM 上有、但本站没有的新型号——
export async function discoverFromLiteLLM(providerId, ourIds) {
  const models = await listProviderModels(providerId);
  const known = new Set();
  const exact = ID_MAP[providerId] || {};
  for (const ourId of ourIds) {
    known.add((exact[ourId] ? exact[ourId] : normalizeOurId(ourId, providerId)).toLowerCase());
  }
  const found = [];
  for (const m of models) {
    if (known.has(m.name)) continue;
    // 反查精确映射表，避免把已映射的型号又当成新模型报一遍
    if (Object.values(exact).some((v) => v.toLowerCase() === m.name)) continue;
    const r = toPatch(null, m);
    if (!r.patch) continue; // 无价格或非 per-token 计费 -> 不列为候选
    const p = r.patch;
    found.push({
      provider_id: providerId,
      suggested_id: suggestId(m.name, providerId),
      litellm_key: m.key,
      litellm_name: m.name,
      mode: m.entry.mode,
      input_price_per_mtok: p.input_price_per_mtok,
      output_price_per_mtok: p.output_price_per_mtok,
      context_window: p.context_window,
      max_output_tokens: p.max_output_tokens,
      source_url: 'https://models.litellm.ai/',
    });
  }
  return found;
}

// 由 LiteLLM 型号名生成「建议的本站 id」：小写、/ 与 . 统一转 -、去冗余字符
// 人工可在候选中转区改名后再入库，此处只提供一个可用的默认值。
export function suggestId(name, providerId) {
  const s = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${providerId}-${s}`;
}
