import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// NVIDIA NIM —— 真实源：OpenRouter 聚合。
// 2026-08-23 核查：本站 9 个 nvidia-nim 型号（nemotron/llama/mistral/phi/gemma/qwen3-coder 旧系列）与 OpenRouter 现网 nemotron-3.x
// 整代漂移，无安全精确对应（llama/mistral/phi/gemma/qwen3-coder 等 OpenRouter 未收录 NIM 对应模型），保持规则映射 -> 自然 0 覆盖。
// 须将 data 中 nvidia-nim 型号升级到现网版本（如 nemotron-3.x）后才会自动对齐产出，本期不强行猜测映射。
export default class NvidiaNimCollector extends BaseCollector {
  static id = 'nvidia-nim';
  static label = 'NVIDIA NIM';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://openrouter.ai/models';
  static providerId = 'nvidia-nim';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    const r = await collectFromOpenRouter(this.constructor.providerId);
    this._coverage = r.coverage;
    return r;
  }
  normalize(raw) { return (raw && raw.patches) ? raw.patches : (Array.isArray(raw) ? raw : []); }
}
