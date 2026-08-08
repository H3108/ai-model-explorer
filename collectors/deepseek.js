import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// DeepSeek —— 真实源：OpenRouter 聚合。
// 注意：本站 deepseek-v3 / r1 与 OpenRouter 现网 deepseek-v4 存在版本漂移，当前精确匹配不上 -> 不产生更新；
// 当本站型号升级到与 OpenRouter 对齐的版本时，本适配器会自动开始产出真实更新（无需改代码）。
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
