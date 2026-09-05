import { makeLiteLLMCollector } from './_litellm_source.js';

// Together AI —— 真实源（发现模式）：LiteLLM 聚合，本站尚无 together 型号。
// Together 官方 /v1/models 需 API Key；OpenRouter 未覆盖；LiteLLM 的 together_ai provider 有 69 条真实定价。
// 本站 provider_id=together 下暂无型号 → 设为 discoveryOnly：不产生更新 patch，
// 改由 scripts/discover_models.cjs 把它作为「新模型发现源」用（可发现 GLM-5.3、Kimi-K3、Qwen3.8 等）。
export default makeLiteLLMCollector({
  id: 'together',
  label: 'Together AI',
  providerId: 'together',
  sourceUrl: 'https://api.together.xyz/pricing',
  discoveryOnly: true,
});
