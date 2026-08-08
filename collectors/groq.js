import { BaseCollector } from './_base.js';

// Groq —— 真实源待接入：OpenRouter 未覆盖 Groq（无免密钥公开定价 API；官方定价页为 JS 渲染 HTML）。
// 联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures 供本地/CI 离线复现。
export default class GroqCollector extends BaseCollector {
  static id = 'groq';
  static label = 'Groq';
  static official = true;
  static requiresKey = false;
  static realSource = false;
  static sourceUrl = 'https://console.groq.com/docs/pricing';
  static providerId = 'groq';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    this.log('  ⚠ Groq: 真实源待接入，联网模式跳过（不参与真实更新）');
    this._coverage = [];
    return [];
  }
  normalize(raw) { return Array.isArray(raw) ? raw : []; }
}
