import { BaseCollector } from './_base.js';

// Cloudflare Workers AI —— 真实源待接入：OpenRouter 未覆盖；官方模型目录为 HTML，需结构化解析。
// 联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures（产出本站尚缺的 cloudflare 候选）。
export default class CloudflareCollector extends BaseCollector {
  static id = 'cloudflare';
  static label = 'Cloudflare Workers AI';
  static official = true;
  static requiresKey = false;
  static realSource = false;
  static sourceUrl = 'https://developers.cloudflare.com/workers-ai/models/';
  static providerId = 'cloudflare';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    this.log('  ⚠ Cloudflare: 真实源待接入，联网模式跳过（不参与真实更新）');
    this._coverage = [];
    return [];
  }
  normalize(raw) { return Array.isArray(raw) ? raw : []; }
}
