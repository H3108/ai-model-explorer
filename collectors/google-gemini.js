import { BaseCollector, toNum, toInt } from './_base.js';

export default class GoogleGeminiCollector extends BaseCollector {
  static id = 'google-gemini';
  static label = 'Google Gemini';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://ai.google.dev/gemini-api/docs/pricing';
  static providerId = 'google';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：Gemini API 定价页。结构化解析属后续阶段。
    return this.request('https://ai.google.dev/gemini-api/docs/pricing', { timeoutMs: 15000 });
  }

  normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      id: m.id || `google-${m.slug}`,
      input_price_per_mtok: toNum(m.input),
      output_price_per_mtok: toNum(m.output),
      context_window: toInt(m.context),
      max_output_tokens: toInt(m.max_output),
      release_date: m.release_date,
      status: m.status || 'active',
      source_url: m.source_url || GoogleGeminiCollector.sourceUrl,
    }));
  }
}
