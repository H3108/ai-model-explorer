import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// Anthropic —— 真实源：OpenRouter 聚合（覆盖本站 anthropic-* 型号）
export default class AnthropicCollector extends BaseCollector {
  static id = 'anthropic';
  static label = 'Anthropic';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://openrouter.ai/models';
  static providerId = 'anthropic';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    const r = await collectFromOpenRouter(this.constructor.providerId);
    this._coverage = r.coverage;
    return r;
  }
  normalize(raw) { return (raw && raw.patches) ? raw.patches : (Array.isArray(raw) ? raw : []); }
}
