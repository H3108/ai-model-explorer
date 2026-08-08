import { BaseCollector, toNum, toInt } from './_base.js';

export default class TogetherCollector extends BaseCollector {
  static id = 'together';
  static label = 'Together AI';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://api.together.xyz/pricing';
  static providerId = 'together';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：Together 模型/定价。HTML 结构化解析属后续阶段。
    return this.request(TogetherCollector.sourceUrl, { timeoutMs: 15000 });
  }

  // 输出仅含白名单客观字段；站内暂无对应记录 → diff 阶段归为「新增候选」(news)
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
      source_url: m.source_url || TogetherCollector.sourceUrl,
    }));
  }
}
