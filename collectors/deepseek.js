import { BaseCollector, toNum, toInt } from './_base.js';

export default class DeepseekCollector extends BaseCollector {
  static id = 'deepseek';
  static label = 'DeepSeek';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://platform.deepseek.com/api/v1/models';
  static providerId = 'deepseek';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：DeepSeek 模型/定价。HTML 结构化解析属后续阶段。
    return this.request(DeepseekCollector.sourceUrl, { timeoutMs: 15000 });
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
      source_url: m.source_url || DeepseekCollector.sourceUrl,
    }));
  }
}
