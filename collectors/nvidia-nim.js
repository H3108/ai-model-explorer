import { BaseCollector, toNum, toInt } from './_base.js';

export default class NvidiaNimCollector extends BaseCollector {
  static id = 'nvidia-nim';
  static label = 'NVIDIA NIM';
  static official = true;
  static requiresKey = false;
  static sourceUrl = 'https://build.nvidia.com/';
  static providerId = 'nvidia-nim';

  async fetchRaw() {
    if (this.ctx.offline) return this.ctx.fixture;
    // 真实源（best-effort）：NVIDIA NIM 模型目录 API。结构化解析属后续阶段。
    return this.request('https://build.nvidia.com/api/catalog/models', { timeoutMs: 15000 });
  }

  normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      id: m.id || `nvidia-nim-${m.slug}`,
      input_price_per_mtok: toNum(m.input),
      output_price_per_mtok: toNum(m.output),
      context_window: toInt(m.context),
      max_output_tokens: toInt(m.max_output),
      release_date: m.release_date,
      status: m.status || 'active',
      source_url: m.source_url || NvidiaNimCollector.sourceUrl,
    }));
  }
}
