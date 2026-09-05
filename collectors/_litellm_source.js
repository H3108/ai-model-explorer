// LiteLLM 源适配器工厂（ESM）
// Groq / Together / Cloudflare / Replicate 四个源的数据获取逻辑完全一致，
// 唯一差别是 id / label / providerId，故用工厂生成，避免四份重复代码。
//
// 本文件导出的是「工厂函数」而非 Collector 类，_registry 的
// `C.prototype instanceof BaseCollector` 判定会自然跳过它（也已在 SKIP 中显式登记）。
//
// 两个可选行为：
//   discoveryOnly = true  只参与「新模型发现」，不产生更新 patch
//                         （用于本站尚无该 provider 任何型号时，避免 0 覆盖的噪音日志）
//   discoveryOnly = false 正常采集：更新本站已有型号的客观字段

import { BaseCollector } from './_base.js';
import { collectFromLiteLLM, readOurModelIds, PROVIDER_MAP } from './_litellm.js';

export function makeLiteLLMCollector({ id, label, providerId, sourceUrl, discoveryOnly = false }) {
  const C = class LiteLLMCollector extends BaseCollector {
    async fetchRaw() {
      if (this.ctx.offline) {
        this._coverage = (this.ctx.fixture || []).map((f) => f.id);
        return this.ctx.fixture;
      }
      if (!PROVIDER_MAP[providerId]) {
        this.log(`  ⚠ ${label}: LiteLLM 无该 provider 定价数据，跳过`);
        this._coverage = [];
        return { patches: [], coverage: [], unmapped: [], skipped: [] };
      }
      if (discoveryOnly) {
        // 本站无该 provider 型号 —— 仅作为发现源，不产生更新 patch（更新无从谈起）
        this._coverage = [];
        return { patches: [], coverage: [], unmapped: [], skipped: [] };
      }
      const ourIds = readOurModelIds(providerId);
      const r = await collectFromLiteLLM(providerId, ourIds);
      this._coverage = r.coverage;
      if (r.unmapped.length) {
        this.log(`  · ${label}: ${r.unmapped.length} 个本站型号在现网查不到（疑似下架/版本漂移，已跳过不猜测）— ${r.unmapped.join(', ')}`);
      }
      if (r.skipped.length) {
        this.log(`  · ${label}: ${r.skipped.length} 个型号因计费模式不匹配跳过 — ${r.skipped.map((s) => `${s.id}(${s.reason})`).join(', ')}`);
      }
      return r;
    }
    normalize(raw) { return (raw && raw.patches) ? raw.patches : (Array.isArray(raw) ? raw : []); }
  };
  C.id = id;
  C.label = label;
  C.official = true;
  C.requiresKey = false;
  C.realSource = true;
  C.sourceUrl = sourceUrl;
  C.providerId = providerId;
  C.discoveryOnly = discoveryOnly;
  return C;
}
