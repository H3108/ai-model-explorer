// OpenRouter 聚合源客户端（ESM，被各官方源适配器复用）
// 为什么用 OpenRouter：绝大多数厂商（OpenAI/Anthropic/Google/DeepSeek/Qwen/智谱/NVIDIA NIM）
// 的「每百万 token 定价 + 上下文长度」在 OpenRouter 公开 models API 中可一次性、免密钥获取，
// 且其定价与官方一致（OpenRouter 按官方费率聚合，不加价）。
// 数据诚信：只做「本站 id ↔ OpenRouter id」的【精确归一化匹配】，匹配不上就跳过，绝不模糊猜测。
//   版本漂移（如本站 deepseek-v3 / OpenRouter 现网 deepseek-v4）会自然匹配不上 → 不产生更新，安全。
// 注意：本文件以下划线开头但不继承 BaseCollector，不会被 _registry 当作 Collector 加载（已加入 SKIP）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toNum, toInt } from './_base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// 本站 provider_id -> OpenRouter id 归一化函数（仅精确映射，不猜测）
const NORM = {
  openai: (s) => 'openai/' + s.replace('openai-', '').replace(/(\d)-(\d)/g, '$1.$2'),
  anthropic: (s) => 'anthropic/claude-' + s.replace('anthropic-', '').replace(/(\d)-(\d)/g, '$1.$2'),
  google: (s) => 'google/' + s.replace('google-', '').replace(/(\d)-(\d)/g, '$1.$2'),
  'alibaba-qwen': (s) => 'qwen/' + s.replace(/^qwen-/, 'qwen-'),
  'zhipu-glm': (s) => 'z-ai/' + s.replace(/(\d)-(\d)/g, '$1.$2'),
  deepseek: (s) => 'deepseek/' + s.replace('deepseek-', ''),
  'nvidia-nim': (s) => 'nvidia/' + s.replace('nvidia-nim-', ''),
};

const OR_ENDPOINT = 'https://openrouter.ai/api/v1/models';

let _cache = null;
export async function getOpenRouterModels() {
  if (_cache) return _cache;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(OR_ENDPOINT, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ai-model-explorer-collector/1.0' },
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const d = await res.json();
    _cache = Array.isArray(d.data) ? d.data : [];
    return _cache;
  } finally {
    clearTimeout(t);
  }
}

function getOurModelIds(providerId) {
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

function perMtok(v) {
  const n = toNum(v);
  if (n === undefined) return undefined;
  const x = n * 1e6; // 每 token -> 每百万 token
  return Math.round(x * 1e4) / 1e4; // 消除浮点噪音，保留 4 位小数
}

// 返回「仅含白名单客观字段」的 patch 数组（已是 normalize 后的形态，run() 会再补 provider_id 等）
export async function collectFromOpenRouter(providerId) {
  const norm = NORM[providerId];
  if (!norm) return [];
  const models = await getOpenRouterModels();
  const byId = new Map(models.map((m) => [String(m.id).toLowerCase(), m]));
  const patches = [];
  for (const ourId of getOurModelIds(providerId)) {
    const orId = norm(ourId);
    const m = byId.get(orId.toLowerCase());
    if (!m) continue; // 精确匹配不上 -> 跳过（版本漂移/未覆盖），绝不猜测
    patches.push({
      id: ourId,
      input_price_per_mtok: perMtok(m.pricing && m.pricing.prompt),
      output_price_per_mtok: perMtok(m.pricing && m.pricing.completion),
      context_window: toInt(m.context_length),
      source_url: `https://openrouter.ai/models/${m.id}`,
    });
  }
  return { patches, coverage: patches.map((p) => p.id) };
}
