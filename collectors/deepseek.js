import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// DeepSeek —— 真实源：OpenRouter 聚合。
// 2026-08-23 修正：原 NORM 规则映射生成 `deepseek/v3` 等 OpenRouter 不存在的 id，导致 0 覆盖（曾被误判为版本漂移）。
// 现 _openrouter.js 改为查表精确对齐：deepseek-v3 / deepseek-v3-2 -> deepseek/deepseek-v3.2，deepseek-r1 -> deepseek/deepseek-r1，
// 可产出真实现价/上下文；deepseek-coder 在 OpenRouter 无独立模型 -> 自然跳过。
export default class DeepseekCollector extends BaseCollector {
  static id = 'deepseek';
  static label = 'DeepSeek';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://openrouter.ai/models';
  static providerId = 'deepseek';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    const r = await collectFromOpenRouter(this.constructor.providerId);
    this._coverage = r.coverage;
    return r;
  }
  normalize(raw) { return (raw && raw.patches) ? raw.patches : (Array.isArray(raw) ? raw : []); }
}
