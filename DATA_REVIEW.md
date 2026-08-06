# AI Model Explorer —— 数据评审稿（自包含 · 供外部 AI 评审）

> **用途**：本文由项目脚本于生成时自动汇总全站数据，可整体复制粘贴给其它 AI，用于评审两件事：
> ① **模型覆盖度**——是否覆盖了主流/必要的模型与厂商；② **设计合理性**——筛选/匹配/推荐的数据结构与口径是否成立。
> 全文自包含，无外链依赖。

---

## 0. 产品定位与目标用户
- **是什么**：一个纯前端、零后端的「AI 模型选型的导航与对比工具」。收录可程序化调用的模型（重点：真·免费 API），帮助用户按厂商 / 能力 / 任务三步找到合适模型。
- **目标用户**：开发者、产品经理、研究者等需要在众多模型里做选型的人；尤其关注「免费/低成本可上手」的群体。
- **核心约束（非常重要，决定覆盖边界）**：只收录**可免费或低成本程序化调用**的模型；明确不收录「仅网页对话」「仅赠金」「仅开放权重自部署」「仅企业试用额度」的形态。

## 1. 数据总览（量化）
| 指标 | 数值 |
| --- | --- |
| 主要厂商（非网关） | 23 |
| 托管网关 | 9 |
| 厂商合计 | 32 |
| 模型系列 | 43 |
| 具体型号（主 + 增量） | 118（主 59 + 增量 59） |
| 免费型号 | 48 |
| 任务类型 | 14 |
| 推荐条目 | 98（每任务 7 条） |
| 命名词典 | 16 条 |

**模态分布**：text=94 · image=13 · video=11
**能力维度命中（具备 tier 的型号数）**：reasoning=116 · coding=109 · agent=104 · knowledge=107 · multilingual=113
**上下文窗口分布**：128K–256K=48 · 32K–128K=6 · <32K=7 · ≥256K=33 · 未知=24

## 2. 厂商清单与模型数
| 厂商 | 类别 | 型号数 | 系列数 | 免费数 |
| --- | --- | --- | --- | --- |
| 智谱 GLM | vendor | 14 | 3 | 5 |
| Groq | gateway | 10 | 6 | 10 |
| OpenRouter | gateway | 10 | 7 | 10 |
| NVIDIA NIM | gateway | 9 | 7 | 9 |
| Google Gemini | vendor | 8 | 3 | 0 |
| OpenAI | vendor | 7 | 3 | 0 |
| 阿里通义千问 | vendor | 6 | 4 | 0 |
| Mistral AI | vendor | 5 | 3 | 1 |
| 腾讯混元 | vendor | 5 | 3 | 0 |
| Anthropic | vendor | 4 | 1 | 0 |
| DeepSeek | vendor | 4 | 1 | 0 |
| xAI | vendor | 4 | 2 | 0 |
| Agnes AI | free | 4 | 3 | 4 |
| 月之暗面 Kimi | vendor | 3 | 1 | 0 |
| MiniMax | vendor | 3 | 1 | 0 |
| 百度文心 | vendor | 2 | 1 | 0 |
| Meta Llama | vendor | 2 | 1 | 0 |
| 快手可灵 | vendor | 2 | 2 | 1 |
| OpenCode Zen | gateway | 2 | 2 | 2 |
| OVHcloud AI | gateway | 2 | 2 | 2 |
| Runway | vendor | 1 | 1 | 0 |
| 字节 Seedance | vendor | 1 | 1 | 0 |
| Luma AI | vendor | 1 | 1 | 0 |
| Midjourney | vendor | 1 | 1 | 0 |
| Black Forest Labs | vendor | 1 | 1 | 0 |
| Stability AI | vendor | 1 | 1 | 0 |
| Adobe Firefly | vendor | 1 | 1 | 0 |
| Ideogram | vendor | 1 | 1 | 0 |
| AnyAPI | gateway | 1 | 0 | 1 |
| BazaarLink | gateway | 1 | 0 | 1 |
| Requesty | gateway | 1 | 0 | 1 |
| Free.ai | gateway | 1 | 0 | 1 |

**免费模型按厂商分布**：Groq=10 · OpenRouter=10 · NVIDIA NIM=9 · 智谱 GLM=5 · Agnes AI=4 · OpenCode Zen=2 · OVHcloud AI=2 · Mistral AI=1 · AnyAPI=1 · BazaarLink=1 · Requesty=1 · Free.ai=1 · 快手可灵=1

## 3. 完整型号清单（全量，供覆盖度核对）
> 列：ID | 厂商 | 系列 | 名称(中) | 模态 | 参数 | 上下文 | 价格 | 能力(首字母 R/C/A/K/M)
| ID | 厂商 | 系列 | 名称 | 模态 | 参数 | 上下文 | 价格 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| openai-gpt-5-5 | OpenAI | GPT-5 系列 | GPT-5.5 | text | — | 1000K | USD5/M | RCAKM |
| openai-gpt-5-4 | OpenAI | GPT-5 系列 | GPT-5.4 | text | — | 1000K | USD2.5/M | RCAKM |
| openai-gpt-5-4-mini | OpenAI | GPT-5 系列 | GPT-5.4 mini | text | — | 400K | USD0.75/M | RCAKM |
| openai-gpt-5-4-nano | OpenAI | GPT-5 系列 | GPT-5.4 nano | text | — | 400K | USD0.2/M | RCAKM |
| openai-gpt-5-5-pro | OpenAI | GPT-5 系列 | GPT-5.5 Pro | text | — | 1000K | USD30/M | RCAKM |
| anthropic-fable-5 | Anthropic | Claude 系列 | Claude Fable 5 | text | — | 1000K | USD10/M | RCAKM |
| anthropic-opus-5 | Anthropic | Claude 系列 | Claude Opus 5 | text | — | 1000K | USD5/M | RCAKM |
| anthropic-sonnet-5 | Anthropic | Claude 系列 | Claude Sonnet 5 | text | — | 1000K | USD3/M | RCAKM |
| anthropic-haiku-4-5 | Anthropic | Claude 系列 | Claude Haiku 4.5 | text | — | 200K | USD1/M | RCAKM |
| google-gemini-3-1-pro | Google Gemini | Gemini 系列 | Gemini 3.1 Pro | text | — | 1000K | USD2/M | RCAKM |
| google-gemini-3-5-flash | Google Gemini | Gemini 系列 | Gemini 3.5 Flash | text | — | 1000K | USD1.5/M | RCAKM |
| google-gemini-3-flash | Google Gemini | Gemini 系列 | Gemini 3 Flash | text | — | 1000K | USD0.5/M | RCAKM |
| google-gemini-3-1-flash-lite | Google Gemini | Gemini 系列 | Gemini 3.1 Flash-Lite | text | — | 1000K | USD0.25/M | RCAKM |
| google-gemini-2-5-pro | Google Gemini | Gemini 系列 | Gemini 2.5 Pro（旧版） | text | — | 2000K | USD1.25/M | RCAKM |
| deepseek-v3 | DeepSeek | DeepSeek 系列 | DeepSeek-V3 | text | 671B (37B 激活 / MoE) | 128K | USD0.27/M | RCAKM |
| deepseek-v3-2 | DeepSeek | DeepSeek 系列 | DeepSeek-V3.2（统一模型） | text | 671B (共享专家 / MoE) | 128K | USD0.28/M | RCAKM |
| deepseek-r1 | DeepSeek | DeepSeek 系列 | DeepSeek-R1 | text | 671B (37B 激活 / MoE) | 128K | USD0.55/M | RCAKM |
| deepseek-coder | DeepSeek | DeepSeek 系列 | DeepSeek Coder | text | — | 16K | USD0.14/M | RCAKM |
| qwen-plus | 阿里通义千问 | 通义千问系列 | 通义千问 Plus | text | — | 1000K | USD0.4/M | RCAKM |
| qwen-3-max | 阿里通义千问 | 通义千问系列 | 通义千问 3-Max | text | — | 262K | USD1.2/M | RCAKM |
| qwen-3-5-flash | 阿里通义千问 | 通义千问系列 | 通义千问 3.5-Flash | text | — | 1000K | USD0.1/M | RCAKM |
| qwen-vl-max | 阿里通义千问 | 通义千问视觉系列 | 通义千问 VL Max | text | — | 128K | 未公开 | RCAKM |
| glm-5-2 | 智谱 GLM | GLM 系列 | GLM-5.2 | text | — | 1000K | USD8/M | RCAKM |
| glm-5 | 智谱 GLM | GLM 系列 | GLM-5 | text | — | 205K | USD1/M | RCAKM |
| glm-5-turbo | 智谱 GLM | GLM 系列 | GLM-5-Turbo | text | — | 200K | USD1.2/M | RCAKM |
| kimi-k2 | 月之暗面 Kimi | Kimi 系列 | Kimi K2 | text | — | 128K | USD0.6/M | RCAKM |
| kimi-k2-5 | 月之暗面 Kimi | Kimi 系列 | Kimi K2.5 | text | — | 262K | USD0.6/M | RCAKM |
| kimi-k3 | 月之暗面 Kimi | Kimi 系列 | Kimi K3 | text | — | 1000K | USD3/M | RCAKM |
| baidu-ernie-5-1 | 百度文心 | 文心系列 | 文心 5.1 | text | — | 128K | CNY5/M | RCAKM |
| baidu-ernie-4-5-turbo | 百度文心 | 文心系列 | 文心 4.5 Turbo | text | — | 128K | CNY0.8/M | RCAKM |
| minimax-m2-5 | MiniMax | MiniMax 系列 | MiniMax M2.5 | text | — | 204.8K | USD0.3/M | RCAKM |
| minimax-m2-7 | MiniMax | MiniMax 系列 | MiniMax M2.7 | text | — | 204.8K | USD0.3/M | RCAKM |
| minimax-m3 | MiniMax | MiniMax 系列 | MiniMax M3 | text | — | 512K | USD0.6/M | RCAKM |
| mistral-large-3 | Mistral AI | Mistral 系列 | Mistral Large 3 | text | — | 256K | USD0.5/M | RCAKM |
| mistral-small-4 | Mistral AI | Mistral 系列 | Mistral Small 4 | text | — | 256K | USD0.15/M | RCAKM |
| mistral-codestral | Mistral AI | Codestral 系列 | Codestral | text | — | 256K | USD0.3/M | RCAKM |
| mistral-magistral-medium | Mistral AI | Magistral 系列 | Magistral Medium | text | — | 40K | USD2/M | RCAKM |
| xai-grok-4-3 | xAI | Grok 系列 | Grok 4.3 | text | — | 1000K | USD1.25/M | RCAKM |
| xai-grok-4 | xAI | Grok 系列 | Grok 4 | text | — | 256K | USD3/M | RCAKM |
| xai-grok-build-0-1 | xAI | Grok 系列 | Grok Build 0.1 | text | — | 256K | USD1/M | RCAKM |
| meta-llama-4-maverick | Meta Llama | Llama 系列 | Llama 4 Maverick | text | 400B (128 专家, 17B 激活 / MoE) | 1000K | USD0.17/M | RCAKM |
| meta-llama-4-scout | Meta Llama | Llama 系列 | Llama 4 Scout | text | 109B (16 专家, 17B 激活 / MoE) | 10000K | USD0.08/M | RCAKM |
| openai-gpt-image-2 | OpenAI | GPT 图像系列 | GPT-Image-2（DALL·E 4） | image | — | — | 未公开 | RCAKM |
| google-imagen-4 | Google Gemini | Imagen 系列 | Imagen 4 | image | — | — | 未公开 | RCAKM |
| midjourney-v7 | Midjourney | Midjourney 系列 | Midjourney V7 | image | — | — | 未公开 | RCAKM |
| blackforest-flux-2 | Black Forest Labs | Flux 系列 | Flux 2 Pro | image | — | — | 未公开 | RCAKM |
| stability-sd-4 | Stability AI | Stable Diffusion 系列 | Stable Diffusion 4 | image | — | — | 未公开 | RCAKM |
| adobe-firefly-4 | Adobe Firefly | Firefly 系列 | Firefly 4 | image | — | — | 未公开 | RCAKM |
| ideogram-3 | Ideogram | Ideogram 系列 | Ideogram 3 | image | — | — | 未公开 | RCAKM |
| alibaba-qwen-image | 阿里通义千问 | 通义千问图像系列 | 通义千问图像 Qwen-Image | image | — | — | 未公开 | RCAKM |
| openai-sora-2 | OpenAI | Sora 系列 | Sora 2 | video | — | — | 未公开 | RCAKM |
| google-veo-3-1 | Google Gemini | Veo 系列 | Veo 3.1 | video | — | — | 未公开 | RCAKM |
| google-veo-3-1-lite | Google Gemini | Veo 系列 | Veo 3.1 Lite | video | — | — | 未公开 | RCAKM |
| kuaishou-kling-3-0 | 快手可灵 | 可灵 Kling 系列 | 可灵 Kling 3.0 | video | — | — | 未公开 | RCAKM |
| runway-gen-4-5 | Runway | Runway Gen 系列 | Runway Gen-4.5 | video | — | — | 未公开 | RCAKM |
| bytedance-seedance-2 | 字节 Seedance | Seedance 系列 | Seedance 2.0 | video | — | — | 未公开 | RCAKM |
| xai-grok-imagine-video | xAI | Grok Imagine 系列 | Grok Imagine 视频 | video | — | — | 未公开 | RCAKM |
| luma-ray-2 | Luma AI | Luma Ray 系列 | Luma Ray 2 | video | — | — | 未公开 | RCAKM |
| alibaba-wan-2-1 | 阿里通义千问 | 通义万相系列 | 通义万相 Wan 2.1 | video | — | — | 未公开 | RCAKM |
| glm-4-7-flash | 智谱 GLM | GLM 系列 | GLM-4.7-Flash | text | — | 200K | 免费 | RCAKM |
| glm-4-flash-250414 | 智谱 GLM | GLM 系列 | GLM-4-Flash | text | — | 128K | 免费 | RCAKM |
| glm-4-6v-flash | 智谱 GLM | GLM 系列 | GLM-4.6V-Flash | text | — | 128K | 免费 | RCAKM |
| glm-5-1 | 智谱 GLM | GLM 系列 | GLM-5.1 | text | — | 200K | USD1.4/M | RCAKM |
| glm-4-7 | 智谱 GLM | GLM 系列 | GLM-4.7 | text | — | 200K | USD0.6/M | RCAKM |
| glm-4-6 | 智谱 GLM | GLM 系列 | GLM-4.6 | text | — | 200K | USD0.6/M | RCAKM |
| glm-4-5 | 智谱 GLM | GLM 系列 | GLM-4.5 | text | — | 205K | USD0.6/M | RCAKM |
| glm-4-5-air | 智谱 GLM | GLM 系列 | GLM-4.5-Air | text | — | 128K | USD0.2/M | RCAKM |
| cogview-3-flash | 智谱 GLM | CogView 图像系列 | CogView-3-Flash | image | — | — | 免费 | RCAKM |
| cogview-4 | 智谱 GLM | CogView 图像系列 | CogView-4 | image | — | — | 未公开 | RCAKM |
| cogvideox-flash | 智谱 GLM | CogVideoX 视频系列 | CogVideoX-Flash | video | — | — | 免费 | RCAKM |
| agnes-2-5-flash | Agnes AI | Agnes Flash 系列 | Agnes 2.5 Flash | text | — | 1000K | 免费 | RCAKM |
| agnes-2-0-flash | Agnes AI | Agnes Flash 系列 | Agnes 2.0 Flash | text | — | 1000K | 免费 | RCAKM |
| agnes-image-2-1-flash | Agnes AI | Agnes Image 系列 | Agnes Image 2.1 Flash | image | — | — | 免费 | RCAKM |
| agnes-video-2-0 | Agnes AI | Agnes Video 系列 | Agnes Video 2.0 | video | — | — | 免费 | RCAKM |
| groq-llama-3-3-70b | Groq | Llama 系列 | Llama 3.3 70B · Groq | text | — | 128K | 免费 | RCAKM |
| groq-qwen3-32b | Groq | 通义千问系列 | Qwen3-32B · Groq | text | — | 128K | 免费 | RCAKM |
| groq-llama-4-scout | Groq | Llama 系列 | Llama 4 Scout · Groq | text | — | 128K | 免费 | RCAKM |
| openrouter-llama-3-3-70b-free | OpenRouter | Llama 系列 | Llama 3.3 70B · OpenRouter | text | — | 128K | 免费 | RCAKM |
| openrouter-deepseek-r1-free | OpenRouter | DeepSeek 系列 | DeepSeek R1 · OpenRouter | text | — | 128K | 免费 | RCAKM |
| nvidia-nim-nemotron-70b | NVIDIA NIM | NVIDIA NIM 系列 | Nemotron-70B · NVIDIA NIM | text | — | 128K | 免费 | RCAKM |
| nvidia-nim-llama-3-3-70b | NVIDIA NIM | Llama 系列 | Llama 3.3 70B · NVIDIA NIM | text | — | 128K | 免费 | RCAKM |
| mistral-small-free | Mistral AI | Mistral 系列 | Mistral Small | text | — | 32K | 免费 | RCAKM |
| groq-llama-3-1-8b-instant | Groq | Llama 系列 | Llama 3.1 8B · Groq | text | — | 131.072K | 免费 | RCAKM |
| groq-gemma-2-9b | Groq | Gemma 系列 | Gemma 2 9B · Groq | text | — | 8.192K | 免费 | RCAKM |
| groq-mixtral-8x7b | Groq | Mixtral 系列 | Mixtral 8x7B · Groq | text | — | 32.768K | 免费 | RCAKM |
| groq-whisper-large-v3 | Groq | — | Whisper Large v3 · Groq | text | — | 131.072K | 免费 | RCAKM |
| groq-deepseek-r1-distill-70b | Groq | DeepSeek 系列 | DeepSeek-R1-Distill 70B · Groq | text | — | 131.072K | 免费 | RCAKM |
| groq-llama-4-maverick | Groq | Llama 系列 | Llama 4 Maverick · Groq | text | — | 131.072K | 免费 | RCAKM |
| groq-kimi-k2 | Groq | Kimi 系列 | Kimi K2 · Groq | text | — | 262.144K | 免费 | RCAKM |
| openrouter-llama-4-maverick-free | OpenRouter | Llama 系列 | Llama 4 Maverick · OpenRouter | text | — | 128K | 免费 | RCAKM |
| openrouter-llama-4-scout-free | OpenRouter | Llama 系列 | Llama 4 Scout · OpenRouter | text | — | 128K | 免费 | RCAKM |
| openrouter-gemma-2-9b-free | OpenRouter | Gemma 系列 | Gemma 2 9B · OpenRouter | text | — | 8.192K | 免费 | RCAKM |
| openrouter-mistral-7b-free | OpenRouter | Mixtral 系列 | Mistral 7B · OpenRouter | text | — | 32.768K | 免费 | RCAKM |
| openrouter-qwen-2-5-72b-free | OpenRouter | 通义千问系列 | Qwen2.5 72B · OpenRouter | text | — | 131.072K | 免费 | RCAKM |
| openrouter-llama-3-1-8b-free | OpenRouter | Llama 系列 | Llama 3.1 8B · OpenRouter | text | — | 131.072K | 免费 | RCAKM |
| openrouter-phi-3-5-mini-free | OpenRouter | — | Phi-3.5 Mini · OpenRouter | text | — | 131.072K | 免费 | RCAKM |
| openrouter-gemini-2-0-flash-free | OpenRouter | Gemini 系列 | Gemini 2.0 Flash · OpenRouter | text | — | 1000K | 免费 | RCAKM |
| nvidia-nim-llama-4-maverick | NVIDIA NIM | Llama 系列 | Llama 4 Maverick · NVIDIA NIM | text | — | 128K | 免费 | RCAKM |
| nvidia-nim-mistral-small-24b | NVIDIA NIM | Mistral 系列 | Mistral Small 24B · NVIDIA NIM | text | — | 32K | 免费 | RCAKM |
| nvidia-nim-deepseek-r1 | NVIDIA NIM | DeepSeek 系列 | DeepSeek R1 · NVIDIA NIM | text | — | 128K | 免费 | RCAKM |
| nvidia-nim-qwen3-coder-480b | NVIDIA NIM | 通义千问系列 | Qwen3 Coder 480B · NVIDIA NIM | text | — | 256K | 免费 | RCAKM |
| nvidia-nim-nemotron-nano-9b | NVIDIA NIM | NVIDIA NIM 系列 | Nemotron Nano 9B · NVIDIA NIM | text | — | 128K | 免费 | RCAKM |
| nvidia-nim-phi-4 | NVIDIA NIM | — | Phi-4 · NVIDIA NIM | text | — | 16.384K | 免费 | RCAKM |
| nvidia-nim-gemma-2-9b | NVIDIA NIM | Gemma 系列 | Gemma 2 9B · NVIDIA NIM | text | — | 8.192K | 免费 | RCAKM |
| anyapi-auto | AnyAPI | — | AnyAPI 自动路由 | text | — | 128K | 免费 | RM |
| bazaarlink-auto-free | BazaarLink | — | BazaarLink auto:free | text | — | 128K | 免费 | RM |
| requesty-auto | Requesty | — | Requesty 路由 | text | — | 200K | 免费 | RM |
| opencode-zen-llama33 | OpenCode Zen | Llama 系列 | Zen Llama 3.3 70B | text | — | 128K | 免费 | RCM |
| opencode-zen-qwen25 | OpenCode Zen | 通义千问系列 | Zen Qwen2.5 72B | text | — | 128K | 免费 | RCM |
| ovh-llama33 | OVHcloud AI | Llama 系列 | OVH Llama 3.3 70B | text | — | 131.072K | 免费 | RM |
| ovh-deepseek-r1 | OVHcloud AI | DeepSeek 系列 | OVH DeepSeek R1 蒸馏 | text | — | 128K | 免费 | RM |
| freeai-auto | Free.ai | — | Free.ai 自动路由 | text | — | 128K | 免费 | RM |
| hunyuan-turbos-latest | 腾讯混元 | 混元对话系列 | 混元 TurboS | text | — | 128K | USD0.11/M | RCK |
| hunyuan-t1-latest | 腾讯混元 | 混元对话系列 | 混元 T1 | text | — | 32K | USD0.5/M | RCK |
| hunyuan-standard | 腾讯混元 | 混元对话系列 | 混元 Standard | text | — | 30K | USD0.08/M | RCK |
| hunyuan-vision-1-5-instruct | 腾讯混元 | 混元视觉系列 | 混元视觉 1.5 | text | — | 24K | USD0.11/M | RM |
| hunyuan-image-3 | 腾讯混元 | 混元图像系列 | 混元图像 3.0 | image | — | — | USD0/M | — |
| kuaishou-kolors | 快手可灵 | Kolors 图像系列 | Kolors 文生图 | image | — | — | 免费 | — |

### 3.1 免费模型的「免费依据」（口径证据）
| 厂商 | 模型 | 免费说明(free_note) |
| --- | --- | --- |
| 智谱 GLM | GLM-4.7-Flash | 智谱开放平台永久免费 API（每模型 1 并发请求），200K 上下文。 |
| 智谱 GLM | GLM-4-Flash | 智谱开放平台永久免费 API，128K 上下文。 |
| 智谱 GLM | GLM-4.6V-Flash | 智谱开放平台永久免费视觉模型。 |
| 智谱 GLM | CogView-3-Flash | 智谱开放平台免费图像生成模型，ZhipuAI SDK / OpenAI 兼容接口零成本调用。 |
| 智谱 GLM | CogVideoX-Flash | 智谱开放平台免费视频生成模型，API key 零成本调用。 |
| Agnes AI | Agnes 2.5 Flash | Agnes AI 永久免费 API（OpenAI 兼容，1M 上下文，文本/图像/视频全模态）。 |
| Agnes AI | Agnes 2.0 Flash | Agnes AI 免费 API（2.0 兼容版）。 |
| Agnes AI | Agnes Image 2.1 Flash | Agnes AI 免费图像生成 API。 |
| Agnes AI | Agnes Video 2.0 | Agnes AI 免费视频生成 API。 |
| Groq | Llama 3.3 70B · Groq | Groq 免费开发者层（约 30 RPM），LPU 极速推理。 |
| Groq | Qwen3-32B · Groq | Groq 免费开发者层托管 Qwen3-32B。 |
| Groq | Llama 4 Scout · Groq | Groq 免费开发者层托管 Llama 4 Scout。 |
| OpenRouter | Llama 3.3 70B · OpenRouter | OpenRouter 免费路由模型（50 请求/日）。 |
| OpenRouter | DeepSeek R1 · OpenRouter | OpenRouter 免费路由 DeepSeek R1。 |
| NVIDIA NIM | Nemotron-70B · NVIDIA NIM | NVIDIA NIM 免费推理微服务（约 40 RPM）。 |
| NVIDIA NIM | Llama 3.3 70B · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Llama 3.3 70B。 |
| Mistral AI | Mistral Small | Mistral 免费 Experiment 层（Small 模型，需同意数据训练）。 |
| Groq | Llama 3.1 8B · Groq | Groq 免费开发者层托管 Llama 3.1 8B（14,400 RPD）。 |
| Groq | Gemma 2 9B · Groq | Groq 免费开发者层托管 Gemma 2 9B。 |
| Groq | Mixtral 8x7B · Groq | Groq 免费开发者层托管 Mixtral 8x7B。 |
| Groq | Whisper Large v3 · Groq | Groq 免费开发者层 Whisper 语音转文字（20 RPM）。 |
| Groq | DeepSeek-R1-Distill 70B · Groq | Groq 免费开发者层托管 DeepSeek R1 蒸馏版。 |
| Groq | Llama 4 Maverick · Groq | Groq 免费开发者层托管 Llama 4 Maverick。 |
| Groq | Kimi K2 · Groq | Groq 免费开发者层托管 Kimi K2（262K 上下文）。 |
| OpenRouter | Llama 4 Maverick · OpenRouter | OpenRouter 免费路由模型（约 20 RPM）。 |
| OpenRouter | Llama 4 Scout · OpenRouter | OpenRouter 免费路由模型（约 20 RPM）。 |
| OpenRouter | Gemma 2 9B · OpenRouter | OpenRouter 免费路由模型（约 30 RPM）。 |
| OpenRouter | Mistral 7B · OpenRouter | OpenRouter 免费路由模型（约 60 RPM）。 |
| OpenRouter | Qwen2.5 72B · OpenRouter | OpenRouter 免费路由模型（约 20 RPM）。 |
| OpenRouter | Llama 3.1 8B · OpenRouter | OpenRouter 免费路由模型（约 20 RPM）。 |
| OpenRouter | Phi-3.5 Mini · OpenRouter | OpenRouter 免费路由模型（约 20 RPM）。 |
| OpenRouter | Gemini 2.0 Flash · OpenRouter | OpenRouter 免费路由模型（约 15 RPM）。 |
| NVIDIA NIM | Llama 4 Maverick · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Llama 4 Maverick。 |
| NVIDIA NIM | Mistral Small 24B · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Mistral Small 24B。 |
| NVIDIA NIM | DeepSeek R1 · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 DeepSeek R1。 |
| NVIDIA NIM | Qwen3 Coder 480B · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Qwen3 Coder 480B。 |
| NVIDIA NIM | Nemotron Nano 9B · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Nemotron Nano 9B。 |
| NVIDIA NIM | Phi-4 · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Phi-4。 |
| NVIDIA NIM | Gemma 2 9B · NVIDIA NIM | NVIDIA NIM 免费推理微服务托管 Gemma 2 9B。 |
| AnyAPI | AnyAPI 自动路由 | 免费层 100K tok/天，auto 路由到 400+ 模型中最优的一个。 |
| BazaarLink | BazaarLink auto:free | 免费层 10 RPM / 130 req/天，auto:free 路由多模型。 |
| Requesty | Requesty 路由 | 免费试用 200 req/天，兼容 Claude Code 路由。 |
| OpenCode Zen | Zen Llama 3.3 70B | 网关免费模型之一（共 7 个），Llama 3.3 70B。 |
| OpenCode Zen | Zen Qwen2.5 72B | 网关免费模型之一（共 7 个），Qwen2.5 72B。 |
| OVHcloud AI | OVH Llama 3.3 70B | 匿名免费层 12 RPM，欧盟 GDPR 合规，无需注册即可调用。 |
| OVHcloud AI | OVH DeepSeek R1 蒸馏 | 匿名免费层含 DeepSeek R1 蒸馏版，欧盟合规。 |
| Free.ai | Free.ai 自动路由 | 免费层 30K tok/天，聚合 400+ 工具，OpenAI 兼容。 |
| 快手可灵 | Kolors 文生图 | 开放权重(Apache 2.0)；经硅基流动(SiliconFlow)免费 API 调用(Kwai-Kolors/Kolors)，中文 prompt 强。 |

## 4. 能力 / 任务 / 推荐 / 命名 体系
- **5 个能力维度（capabilities，用于浏览页硬筛选与匹配打分）**：reasoning 推理 / coding 编码 / agent 智能体 / knowledge 知识 / multilingual 多语。每项存 `{tier, basis}`，tier∈{high,medium,low}，basis 为定性依据（不编造分数）。
- **5 个硬性条件（traits，浏览页硬筛选）**：long_context 长上下文(≥128K) / vision 视觉输入 / open_weight 开放权重 / low_cost 低成本(输入≤$1/M) / fast 高速。
- **14 类任务（任务选择器 matcher）**：AI 聊天、写代码、Agent 开发、图片生成、图片理解、视频生成、本地部署、低成本 API、复杂推理、长文档处理、企业知识库、写文章、学习AI、企业应用。
- **推荐**：每任务 7 条，共 98 条；理由基于价格/上下文/能力 tier 等真实字段。
- **命名词典 16 条**：覆盖 Max/Ultra/Large、Turbo、Preview/Beta、MoE、VL/Omni、参数规模(7B/70B/671B)、Embedding/Rerank、Coder/Code、Mini、Instruct、Base、Flash、Lite、Pro、Nano 等。

## 5. 筛选与匹配逻辑（设计核心）
### 5.1 浏览页（#browse）硬筛选流程
1. 模态过滤（text/image/video）
2. 价格过滤（全部/免费/低成本/标准价）
3. **能力维度硬筛选（AND）**：选中 k 项能力 → 仅保留 `capabilities[k].tier` 全部存在的型号；缺任一即剔除
4. **硬性条件（AND）**：每项 trait 通过对应 test 函数判断
5. 排序：匹配度 / 价格 / 上下文 / 速度
> 注：能力维度为 AND 语义后，因多数型号具备全部 5 维，单独筛选收窄有限；硬切量主要靠硬性条件。

### 5.2 任务匹配（#matcher）打分
- 用户选任务 + 预算 + 速度偏好 → 取 recommendations 中该任务的候选 → 按 价格档 / 上下文 / 速度档 / 能力 tier 综合打分并排序，输出带理由的推荐列表。

## 6. 「免费」口径定义（关键设计决策）
**本站「免费」= 可免信用卡、可程序化调用、官方稳定免费层的 API key。** 明确**不算**免费：① 仅网页/Playground 免费 ② 网页免费+API 赠金 ③ 开放权重自部署（无授权费但需自备算力）④ 网页/额度免费。
此口径直接决定覆盖边界（见第 8 节盲区）。

## 7. 设计结构与导航
- 纯前端 vanilla JS SPA + hash 路由，无后端、无构建。
- 页面：首页 / 厂商(#providers) / 厂商详情 / 系列详情 / 浏览(#browse) / 任务匹配(#matcher) / 托管网关(#gateways) / 命名词典(#glossary) / 模型详情(#model)。
- 数据层：providers / model_families / model_variants(主) + model_variants_extra(增量，安全合并) / tasks / recommendations / naming_guide。
- 增量合并：extra 文件用 try/catch 加载，失败不影响主站。

## 8. 已知覆盖盲区与待评审问题
### 8.1 主要厂商覆盖判断
| 厂商 | 状态 |
| --- | --- |
| OpenAI | ✅ 已收录（含付费） |
| Anthropic (Claude) | ✅ 已收录（含付费） |
| Google (Gemini/Gemma) | ✅ 已收录（含付费） |
| Meta (Llama) | ✅ 已收录（含付费） |
| DeepSeek | ✅ 已收录（含付费） |
| Alibaba (Qwen) | ✅ 已收录（含付费） |
| Zhipu (GLM) | ✅ 已收录（含付费） |
| Mistral | ✅ 已收录（含付费） |
| Moonshot (Kimi) | ✅ 已收录（含付费） |
| Tencent (Hunyuan) | ✅ 已收录（含付费） |
| xAI (Grok) | ✅ 已收录（含付费） |
| Cohere | ❌ 未收录 |
| Amazon (Nova/Titan) | ❌ 未收录 |
| Perplexity | ❌ 未收录 |
| Apple | ❌ 未收录 |
| Stability (SD) | ✅ 已收录（含付费） |
| Black Forest (Flux) | ✅ 已收录（含付费） |
| Runway | ✅ 已收录（含付费） |
| ElevenLabs | ❌ 未收录 |

> 说明：未收录者主要因「无免费/可程序化 API key」或「仅网页/赠金」。评审者需判断这是合理聚焦还是过度收窄。

### 8.2 请评审者重点回答
Q1 覆盖度：免费模型集中在 Groq/OpenRouter/NVIDIA NIM 网关(各 9–10 个)、智谱 GLM、Agnes 等；而 Claude、GPT-5、Grok 等虽已收录为付费标杆，但**免费层缺失**(Anthropic 无免费 API、xAI 无免费层)。真正完全未收录的主流厂为 Cohere / Amazon / Perplexity / Apple / ElevenLabs。评审者需判断：是否应补充这些缺失主流厂(哪怕付费)以提升参考完整性，还是维持「免费优先」聚焦？
Q2 平衡：若补充付费标杆，是否破坏「免费优先」的产品定位？还是单列「标杆对照」区？
Q3 能力维度：5 维（推理/编码/智能体/知识/多语）是否足够刻画模型差异？是否缺「数学」「创意写作」「长文档」等专业维度？
Q4 硬筛选语义：能力维度改为 AND 硬筛选后，因 104/118 型号具备全部 5 维，单独筛选几乎不收窄；真正切量靠硬性条件（长上下文/视觉/开放权重/低成本/高速）。这是预期行为吗？
Q5 数据时效：verified_date 多在 2026-08-05，价格/能力以厂商官方为准。是否有明显的已过期或缺失字段？
Q6 命名解读：16 条术语是否覆盖用户最常见的困惑后缀？有无高频但遗漏的（如 Mini/Instruct/Instruct/Base/SFT/R1/V3）？
Q7 推荐系统：14 任务 × 7 推荐 = 98 条，理由均基于字段。是否存在「推荐了但被硬筛选/价格排除」导致用户看不到的矛盾？
Q8 设计结构：首页「30s 秒级选型」与现已被拆成「按厂商/按能力/任务选择器」三条路径的表述是否冲突？hero 数字是否应调整？

## 9. 数据 Schema 速览（variant 关键字段）
```json
{
  "id": "唯一ID",
  "model_id": "厂商 API 模型名",
  "name": "英文名", "name_cn": "中文名",
  "provider_id": "厂商ID", "family_id": "系列ID(可空)",
  "media_type": "text|image|video|audio",
  "params": "参数规模如 122B / 8x22B / 1.8T",
  "context_window": 256000,
  "max_output_tokens": 8192,
  "input_price_per_mtok": 0, "output_price_per_mtok": 0, "currency": "$",
  "free": true, "free_note": "免费依据",
  "open_weight": false, "vision_support": true, "speed_tier": "fast",
  "capabilities": { "reasoning": {"tier":"high","basis":"..."}, ... },
  "best_for": ["task_id"], "avoid_for": ["task_id"],
  "one_liner_cn": "一句话定位", "source_url": "...", "verified_date": "2026-08-05"
}
```

---
*本文件由 scripts/gen_data_review.js 自动生成，可随时重新生成以跟随数据更新。*
