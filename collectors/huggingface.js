import { BaseCollector, toNum, toInt } from './_base.js';

// Hugging Face Inference —— 官方源适配器（Phase 2 扩展）
// 站点内尚无 huggingface 型号，故本适配器产出「新增候选」patch（diff 中归入 news）。
export default class HuggingFaceCollector extends BaseCollector {
  static id = 'huggingface';
  static label = 'Hugging Face Inference';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://huggingface.co/models?pipeline_tag=text-generation&sort=likes';
  static providerId = 'huggingface';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：HF 模型库 text-generation 排行。结构化解析属后续阶段。
    return this.request('https://huggingface.co/api/models?pipeline_tag=text-generation&sort=likes&limit=50', { timeoutMs: 15000 });
  }

  normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      id: m.id || `huggingface-${m.slug}`,
      input_price_per_mtok: toNum(m.input),
      output_price_per_mtok: toNum(m.output),
      context_window: toInt(m.context),
      max_output_tokens: toInt(m.max_output),
      release_date: m.release_date,
      status: m.status || 'active',
      source_url: m.source_url || HuggingFaceCollector.sourceUrl,
    }));
  }
}
