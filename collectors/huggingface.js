import { BaseCollector } from './_base.js';

// Hugging Face Inference —— 保持桩源（2026-09-05 实测后刻意不做，非遗漏）
// 实测结论：LiteLLM 全库 3561 条中 litellm_provider === 'huggingface' 的条目数为 0，
// OpenRouter 同样不覆盖，官方 /api/models 只给模型元信息、不给推理定价
// （HF Inference 按模型/实例浮动计费，无统一公开价表）。三个可用源均无定价数据。
// 接入前提：HF 推出公开定价 API，或本站接受「仅登记模型存在性、价格留空」的形态。
// 在此之前联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures
// （产出本站尚缺的 huggingface 候选）。
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
