import { BaseCollector, toNum, toInt } from './_base.js';

// Cloudflare Workers AI —— 官方源适配器（Phase 2 扩展）
// 站点内尚无 cloudflare 型号，故本适配器产出的是「新增候选」patch（diff 中归入 news），
// 不会触碰任何现有 data/ 记录；真正入库需人工补定性字段。
export default class CloudflareCollector extends BaseCollector {
  static id = 'cloudflare';
  static label = 'Cloudflare Workers AI';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://developers.cloudflare.com/workers-ai/models/';
  static providerId = 'cloudflare';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：Workers AI 模型目录。HTML 结构化解析属后续阶段（见 DATA_SYNC_PLAN.md）。
    return this.request('https://developers.cloudflare.com/workers-ai/models/', { timeoutMs: 15000 });
  }

  normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      id: m.id || `cloudflare-${m.slug}`,
      input_price_per_mtok: toNum(m.input),
      output_price_per_mtok: toNum(m.output),
      context_window: toInt(m.context),
      max_output_tokens: toInt(m.max_output),
      release_date: m.release_date,
      status: m.status || 'active',
      source_url: m.source_url || CloudflareCollector.sourceUrl,
    }));
  }
}
