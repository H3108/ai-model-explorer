import { makeLiteLLMCollector } from './_litellm_source.js';

// Replicate —— 真实源（发现模式）：LiteLLM 聚合，本站尚无 replicate 型号。
// Replicate 官方 /v1/models 需 API Key；OpenRouter 未覆盖；LiteLLM 的 replicate provider 有 40 条真实定价。
// 注意：Replicate 托管的多为开源模型（llama-2/3、mistral、gpt-oss），与本站已有的
// meta / mistral / openai 厂商条目存在重叠，故仅作发现源，人工挑选后再入库，不自动合并。
export default makeLiteLLMCollector({
  id: 'replicate',
  label: 'Replicate',
  providerId: 'replicate',
  sourceUrl: 'https://replicate.com/pricing',
  discoveryOnly: true,
});
