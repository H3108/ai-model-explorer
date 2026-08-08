import { BaseCollector } from './_base.js';

// fal.ai —— 真实源待接入：OpenRouter 未覆盖 fal.ai；官方模型 API 需 API Key。
// 联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures。
export default class FalAiCollector extends BaseCollector {
  static id = 'fal-ai';
  static label = 'fal.ai';
  static official = true;
  static requiresKey = false;
  static realSource = false;
  static sourceUrl = 'https://fal.ai/models';
  static providerId = 'fal-ai';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    this.log('  ⚠ fal.ai: 真实源待接入，联网模式跳过（不参与真实更新）');
    this._coverage = [];
    return [];
  }
  normalize(raw) { return Array.isArray(raw) ? raw : []; }
}
