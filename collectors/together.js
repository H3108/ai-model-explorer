import { BaseCollector } from './_base.js';

// Together AI —— 真实源待接入：OpenRouter 未覆盖 Together；官方 /v1/models 需 API Key。
// 联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures。
export default class TogetherCollector extends BaseCollector {
  static id = 'together';
  static label = 'Together AI';
  static official = true;
  static requiresKey = false;
  static realSource = false;
  static sourceUrl = 'https://api.together.xyz/pricing';
  static providerId = 'together';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    this.log('  ⚠ Together: 真实源待接入，联网模式跳过（不参与真实更新）');
    this._coverage = [];
    return [];
  }
  normalize(raw) { return Array.isArray(raw) ? raw : []; }
}
