import { BaseCollector } from './_base.js';

// Hugging Face Inference —— 真实源待接入：OpenRouter 未覆盖；HF 推理定价按模型浮动、无统一公开价表。
// 联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures（产出本站尚缺的 huggingface 候选）。
export default class HuggingFaceCollector extends BaseCollector {
  static id = 'huggingface';
  static label = 'Hugging Face Inference';
  static official = true;
  static requiresKey = false;
  static realSource = false;
  static sourceUrl = 'https://huggingface.co/models';
  static providerId = 'huggingface';

  async fetchRaw() {
    if (this.ctx.offline) { this._coverage = (this.ctx.fixture || []).map((f) => f.id); return this.ctx.fixture; }
    this.log('  ⚠ HuggingFace: 真实源待接入，联网模式跳过（不参与真实更新）');
    this._coverage = [];
    return [];
  }
  normalize(raw) { return Array.isArray(raw) ? raw : []; }
}
