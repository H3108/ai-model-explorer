import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// OpenAI —— 真实源：OpenRouter 聚合（覆盖本站 openai-* 型号的真实定价/上下文，免密钥）
export default class OpenAICollector extends BaseCollector {
  static id = 'openai';
  static label = 'OpenAI';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://openrouter.ai/models';
  static providerId = 'openai';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    const r = await collectFromOpenRouter(this.constructor.providerId);
    this._coverage = r.coverage;
    return r;
  }
  normalize(raw) { return (raw && raw.patches) ? raw.patches : (Array.isArray(raw) ? raw : []); }
}
