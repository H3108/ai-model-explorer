import { BaseCollector, toNum, toInt } from './_base.js';

export default class OpenAICollector extends BaseCollector {
  static id = 'openai';
  static label = 'OpenAI';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://openai.com/pricing';
  static providerId = 'openai';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：OpenAI 定价 JSON。HTML 结构化解析属后续阶段（见 DATA_SYNC_PLAN.md）。
    return this.request('https://openai.com/api/pricing.json', { timeoutMs: 15000 });
  }

  normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      id: m.id || `openai-${m.slug}`,
      input_price_per_mtok: toNum(m.input),
      output_price_per_mtok: toNum(m.output),
      context_window: toInt(m.context),
      max_output_tokens: toInt(m.max_output),
      release_date: m.release_date,
      status: m.status || 'active',
      source_url: m.source_url || OpenAICollector.sourceUrl,
    }));
  }
}
