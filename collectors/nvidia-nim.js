import { BaseCollector } from './_base.js';
import { collectFromOpenRouter } from './_openrouter.js';

// NVIDIA NIM —— 真实源：OpenRouter 聚合。
// 注意：本站 nvidia-nim-* 与 OpenRouter 现网 nemotron-3.x 存在版本漂移，当前精确匹配不上 -> 不产生更新；
// 版本对齐后自动生效。
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
