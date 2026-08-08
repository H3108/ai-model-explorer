import { BaseCollector } from './_base.js';

// Replicate —— 真实源待接入：OpenRouter 未覆盖 Replicate；官方 /v1/models 需 API Key。
// 联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures。
export default class ReplicateCollector extends BaseCollector {
  static id = 'replicate';
  static label = 'Replicate';
  static official = true;
  static requiresKey = false;
  static realSource = false;
  static sourceUrl = 'https://replicate.com/pricing';
  static providerId = 'replicate';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    this.log('  ⚠ Replicate: 真实源待接入，联网模式跳过（不参与真实更新）');
    this._coverage = [];
    return [];
  }
  normalize(raw) { return Array.isArray(raw) ? raw : []; }
}
