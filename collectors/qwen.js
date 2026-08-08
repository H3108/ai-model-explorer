import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// Qwen —— 真实源：OpenRouter 聚合（覆盖本站 alibaba-qwen 下可精确匹配的型号）
export default class QwenCollector extends BaseCollector {
  static id = 'qwen';
  static label = 'Qwen';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://openrouter.ai/models';
  static providerId = 'alibaba-qwen';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    const r = await collectFromOpenRouter(this.constructor.providerId);
    this._coverage = r.coverage;
    return r;
  }
  normalize(raw) { return (raw && raw.patches) ? raw.patches : (Array.isArray(raw) ? raw : []); }
}
