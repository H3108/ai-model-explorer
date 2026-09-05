import { makeLiteLLMCollector } from './_litellm_source.js';

// Groq —— 真实源：LiteLLM 聚合（本站 provider_id=groq 下 10 个型号）
// 为什么用 LiteLLM 而非官方：Groq 官方 /openai/v1/models 需 API Key，定价页为 JS 渲染 HTML；
// OpenRouter 又不覆盖 Groq（其定价是 Groq 自己的，不等于 OpenRouter 同款模型价）。
// LiteLLM 的 groq provider 含 20 条（14 条 per-token 聊天 + 6 条音频），免密钥、静态 JSON。
// 本站 10 个型号中，7 个可精确匹配（见 _litellm.js ID_MAP）；
// groq-gemma-2-9b / groq-mixtral-8x7b / groq-deepseek-r1-distill-70b 在 Groq 现网已下架，
// 精确匹配不上 → 跳过不猜测，交由「疑似下架」机制提示人工核销。
export default makeLiteLLMCollector({
  id: 'groq',
  label: 'Groq',
  providerId: 'groq',
  sourceUrl: 'https://console.groq.com/docs/pricing',
  discoveryOnly: false,
});
