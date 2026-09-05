import { makeLiteLLMCollector } from './_litellm_source.js';

// Cloudflare Workers AI —— 真实源（发现模式）：LiteLLM 聚合，本站尚无 cloudflare 型号。
// Cloudflare 官方模型目录是 HTML（需结构化解析），模型列表 API 又需 Account ID + API Token。
// LiteLLM 的 cloudflare provider 有 32 条真实定价，免密钥即可拿到。
// 本站 provider_id=cloudflare 下暂无型号 → 设为 discoveryOnly，交由发现脚本补充候选
// （可发现 @cf/zai-org/glm-5.2、@cf/qwen/qwen3-30b-a3b-fp8、@cf/openai/gpt-oss-120b 等免费/低价托管）。
export default makeLiteLLMCollector({
  id: 'cloudflare',
  label: 'Cloudflare Workers AI',
  providerId: 'cloudflare',
  sourceUrl: 'https://developers.cloudflare.com/workers-ai/models/',
  discoveryOnly: true,
});
