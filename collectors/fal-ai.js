import { BaseCollector } from './_base.js';

// fal.ai —— 保持桩源（2026-09-05 实测后刻意不做，非遗漏）
// 实测结论：LiteLLM 的 fal_ai provider 有 71 条，但 mode 100% 为 image_generation，
// 且 input_cost_per_token / output_cost_per_token 全部为空（fal 按「每张图」计费，
// 用 input_cost_per_image 之类的字段）。本站 price_model 为 per_token，字段模型不匹配，
// 强行换算只会写入假价格。加上本站 provider_id=fal-ai 下本身 0 个型号、且 fal 上的
// FLUX / SD / Ideogram 与本站已有 blackforest / stability / ideogram 厂商条目重叠。
// 接入前提（满足任一条再启用）：
//   ① 本站新增 media_pricing（按张/按秒）字段体系，能表达 image_generation 计费；
//   ② 拿到 fal.ai API Key 走官方 /models 端点，并约定以「单次生成均价」入库。
// 在此之前联网模式 coverage=[] 不产生 patch（避免假 diff）；离线模式仍用 fixtures。
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
