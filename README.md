# AI Model Explorer V4 · AI 模型选择助手

> 不需要先懂模型名称，也能找到适合自己任务的 AI 模型。

**AI Model Explorer** 是一个面向开发者、产品经理与 AI 初学者的**大模型知识地图与选型助手**。它把分散在各厂商官网的模型能力、价格、上下文长度、API 接入方式与适用场景，整理成一套统一、可检索、带推荐理由的导航系统——而不是又一个排行榜或自动爬虫平台。

<!-- 徽标占位（按需启用）：构建状态 / 许可证 / 模型数量 -->
<!-- ![models](https://img.shields.io/badge/models-118-blue) -->

---

## 目录

- [功能特性](#功能特性)
- [导航与页面](#导航与页面)
- [数据来源与口径](#数据来源与口径)
- [技术栈](#技术栈)
- [本地运行](#本地运行)
- [项目结构](#项目结构)
- [数据校验](#数据校验)
- [项目定位与免责声明](#项目定位与免责声明)
- [贡献与许可证](#贡献与许可证)
- [English](#english)

---

## 功能特性

- **任务选择器（Matcher）**：用「你要做什么 + 预算 + 速度/质量偏好」描述需求，系统返回带**推荐理由**的 TOP 模型，并给出四维度加权适配评分 `fitScore`。
- **能力筛选（Browse）**：按模态（文本 / 视觉 / 视频 / 音频 / Agent）、上下文长度、厂商、价格等维度过滤；支持**自然语言结构化搜索**（自动提取「视频 + 长上下文」之类的条件）。
- **厂商地图（Providers）**：按美国 / 中国 / 开源生态分类，展示厂商定位、模型系列与开放权重情况。
- **托管网关（Gateways）**：汇总 Groq、OpenRouter、NVIDIA NIM、Mistral 等网关的免费 / 实验性接入层。
- **模型对比（Compare）**：把最多 6 个型号并排比较能力、速度、价格与部署方式（收藏夹驱动）。
- **名称解释（Glossary）**：解释 Mini / Pro / Flash / Nano / Reasoning / Vision 等命名后缀到底意味着什么。
- **免费 API 筛选**：只列出「真·免费 API key 调用」的模型（口径见下文），帮助用户零成本上手。
- **模型详情**：一句话定位、七类能力标签、适合 / 不适合任务、同系列型号对比、版本与别名、API 接入信息与 Playground 示例。
- **本地持久化**：收藏、最近搜索、筛选偏好通过 `localStorage` 记忆，无需后端或账号。

---

## 导航与页面

本项目是**纯前端单页应用（SPA）**，使用 hash 路由（如 `#matcher`），无需服务端渲染。主要路由：

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `#home` | 首页 | 决策入口：任务选择 + 浏览厂商 |
| `#providers` | 厂商地图 | 厂商分类与模型系列总览 |
| `#provider/:id` | 厂商详情 | 单个厂商的全部系列 |
| `#family/:id` | 系列详情 | 某模型系列下的全部型号 |
| `#browse` | 能力筛选 | 多维过滤 + 结构化搜索 |
| `#matcher` | 任务选择器 | 任务 + 预算 + 偏好 → 推荐 |
| `#gateways` | 托管网关 | 第三方网关接入层 |
| `#model/:id` | 模型详情 | 单型号完整信息与对比 |
| `#compare` | 模型对比 | 多型号并排比较 |
| `#glossary` | 名称解释 | 命名后缀词典 |

---

## 数据来源与口径

数据全部以规范化 JSON 形式存放在 `data/`，**已联网核实**，每个型号带 `source_url` 与 `verified_date`。

- **规模**：118 个型号（主表 59 + 增量表 59）、32 个厂商、44 个模型系列、14 个任务维度。
- **真实性约束**：厂商官方未公开或无法确认的值保留 `null`，**不编造、不估算**；价格未知时不会得出「最便宜」之类的虚假结论。
- **「免费」口径（重要）**：本站「免费」严格指「真·免费 API key 调用」——免信用卡、可程序化调用、官方稳定免费层。以下**不计入**「免费」：
  - 仅网页 / Playground 免费（无 API）
  - 网页免费 + API 赠金（如 DeepSeek / Qwen / Kimi 网页免费但 API 计费）
  - 开放权重自部署（无授权费但需自备算力）
  - 网页 / 额度免费（如 Grok / Runway）
  - 注：Gemini 虽存在免信用卡免费 API key 层，但按本口径**不计入**「免费」筛选。
  - 当前免费集合：智谱 Flash 家族 + Agnes + 网关托管（Groq / OpenRouter / NVIDIA NIM 免费层 + Mistral Experiment 层）。
- **统一字段**：每个型号包含 Provider、系列、类型、Reasoning / Coding / Vision / Audio 能力、上下文长度、输入 / 输出价格、币种、API Base URL、流式 / 函数调用 / JSON Mode / 工具调用、适合与不适合场景、发布时间、数据质量评分等。

### 数据文件清单（`data/`）

| 文件 | 内容 |
| --- | --- |
| `providers.json` | 厂商、地区、定位、开放权重、官方来源 |
| `model_families.json` | 模型系列（归属厂商） |
| `model_variants.json` | 主表：具体型号（客观字段 + 三档能力 + 适合/不适合） |
| `model_variants_extra.json` | 增量表：新增型号（不改动主表，加载时安全合并） |
| `model_aliases.json` | 别名（如「ChatGPT」→ OpenAI），用于搜索识别 |
| `model_versions.json` | 版本信息，用于详情页版本区块 |
| `tasks.json` | 任务与偏好维度 |
| `scenarios.json` | 场景定义 |
| `recommendations.json` | 每个任务的 TOP N 推荐（带 score 与 reason） |
| `naming_guide.json` | Mini / Pro / Flash / Reasoning / Vision 等命名解释 |
| `gateways.json` | 第三方托管网关接入层 |
| `api_access.json` | 各厂商**公开** API Base URL（仅端点，无密钥） |

---

## 技术栈

- **零依赖、零构建、零后端**：原生 HTML + CSS + ES Module，直接静态托管即可运行。
- **Hash 路由**：前端 SPA，无需服务端配置。
- **语义化 Design Token**：颜色 / 间距 / 圆角 / 阴影等统一在 `styles.css :root` 中以 CSS 变量定义，组件不写死色值。
- **字体**：Geist / Geist Mono（UI 与等宽）+ Noto Sans SC（中文），通过 Google Fonts 引入。
- **持久化**：`localStorage`（收藏、最近搜索、筛选记忆）。
- **数据治理**：`data/` 下所有 JSON 经本地校验脚本与质量检查，保证可被页面安全加载。

---

## 本地运行

由于页面通过 `fetch` 加载 JSON，需使用本地静态服务器（直接 `file://` 打开会因 CORS 失败）。

```bash
# 方式一：Python 内置服务器（推荐，零安装）
cd <REPO_ROOT>
python3 -m http.server 8000
# 打开 http://localhost:8000

# 方式二：Node 静态服务器
npx serve .
```

无需数据库、后端服务或构建步骤，也没有自动爬虫。

---

## 项目结构

```text
ai-model-explorer/
├── index.html              # 入口（含顶部导航与版本标识）
├── app.js                  # 全部前端逻辑：路由 / 渲染 / 搜索 / 评分 / 持久化
├── styles.css              # 语义化 Design Token + 组件样式
├── assets/
│   ├── brand/              # logo 等品牌资源
│   └── logos/              # 厂商 logo（优先官方图标，缺失时字母兜底）
├── data/                   # 规范化 Registry JSON（全部经联网核实）
│   ├── providers.json
│   ├── model_families.json
│   ├── model_variants.json
│   ├── model_variants_extra.json
│   ├── model_aliases.json
│   ├── model_versions.json
│   ├── tasks.json
│   ├── scenarios.json
│   ├── recommendations.json
│   ├── naming_guide.json
│   ├── gateways.json
│   └── api_access.json
├── scripts/                # 数据校验 / 治理 / 质量检查（本地开发用）
│   ├── validate_normalized.js
│   ├── smoke_render.js
│   ├── model_quality_check.py
│   ├── governance_v1.js / governance_v2.js
│   └── gen_data_review.js
└── docs/                   # 内部文档（设计稿 / 审计 / 走查）
                          # 不推送 GitHub，见 .gitignore
```

> 说明：`docs/` 为团队内部过程文档，已通过 `.gitignore` 排除在版本库之外，不会出现在 GitHub 仓库中；本 `README.md` 位于仓库根目录，会随仓库发布。

---

## 数据校验

提交前可运行以下本地校验（保证数据可被页面安全加载、无结构错误）：

```bash
# 1) 规范化数据校验（Node，无需依赖）
node scripts/validate_normalized.cjs

# 2) 渲染冒烟测试（需 jsdom；通过 NODE_PATH 指定依赖目录）
NODE_PATH=<node_modules 路径> node scripts/smoke_render.cjs

# 3) 数据质量检查（Python）
python3 scripts/model_quality_check.py
```

### 核验日期

页面上的「数据于 YYYY-MM-DD 联网核实」不是写死的文案，而是从 `data/*.json` 中所有型号的
`verified_date` 取最新值推导出来的（实现见 `src/store.js` 的 `dataMeta()`）。因此**更新数据时
只需更新 `verified_date`，站点上所有日期会自动跟随**，无需改代码。

```bash
# 查看当前核验日期分布与站点将显示的日期
node scripts/bump_verified.cjs --check

# 核实完成后更新日期（支持按厂商 / 按 ID / 全量，--dry-run 可预演）
node scripts/bump_verified.cjs --provider openai
node scripts/bump_verified.cjs --id glm-4-7-flash,cogview-3-flash
node scripts/bump_verified.cjs --all --date 2026-08-10
```

`validate_normalized.cjs` 会扫描源码，一旦发现有人把日期写回视图或 HTML 就直接报错，
防止代码里的日期与真实数据脱节。

---

## 项目定位与免责声明

- 本项目**不是**大模型排行榜、专业评测平台或自动 Benchmark 系统。
- 它是一个面向新用户的 **AI 模型知识地图与选择助手**。
- 模型能力、价格与可用性会随时间变化；**生产使用前请核对厂商官方文档**。
- 本仓库不含任何 API 密钥或用户隐私数据（`api_access.json` 仅存公开端点）。

---

## 贡献与许可证

- 欢迎通过 Issue / Pull Request 补充厂商、系列与型号数据，或修正已核实的信息。
- 新增型号请走增量文件 `data/model_variants_extra.json`，避免直接改动主表 `model_variants.json`。
- **许可证**：本仓库目前未附带许可证文件。如需以开源协议发布，请在根目录自行添加 `LICENSE`（建议 MIT 或 Apache-2.0）。

---

## English

**AI Model Explorer V4** is a static, dependency-free single-page web app that helps developers, PMs, and AI beginners **find the right AI model for their task** — without needing to already know model names.

- **What it does**: browse models by provider / capability / gateway, describe your task in natural language to get ranked recommendations with transparent `fitScore` reasoning, compare models side-by-side, and learn what naming suffixes (Mini / Pro / Flash / Reasoning / Vision) actually mean.
- **Stack**: plain HTML + CSS + native ES Modules, hash-router SPA, no build step, no backend. Data lives in `data/*.json` (verified against vendor sources; unknowns kept as `null`, never fabricated).
- **Privacy**: no API keys, no user PII. `api_access.json` stores only public API base URLs.
- **Run locally**: `python3 -m http.server 8000` then open `http://localhost:8000` (a static server is required because the app `fetch`es JSON).
- **License**: not yet specified — add a `LICENSE` file if you intend to publish under an open-source license.
