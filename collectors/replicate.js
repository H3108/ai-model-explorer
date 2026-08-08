import { BaseCollector, toNum, toInt } from './_base.js';

export default class ReplicateCollector extends BaseCollector {
  static id = 'replicate';
  static label = 'Replicate';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://replicate.com/pricing';
  static providerId = 'replicate';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：Replicate 模型/定价。HTML 结构化解析属后续阶段。
    return this.request(ReplicateCollector.sourceUrl, { timeoutMs: 15000 });
  }

  normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      id: m.id,
      input_price_per_mtok: toNum(m.input),
      output_price_per_mtok: toNum(m.output),
      context_window: toInt(m.context),
      max_output_tokens: toInt(m.max_output),
      release_date: m.release_date,
      status: m.status || 'active',
      source_url: m.source_url || ReplicateCollector.sourceUrl,
    }));
  }
}
