# PROJECT_AUDIT_V4.md — AI Model Explorer V4 升级前审计

> 依据 `V4.md`（V4 架构升级与实施规范）第 15 节 Step 1 产出。
> **本步骤不修改任何代码**，仅审计现状、差距与风险，供后续 Step 2–4 执行参考。

---

## 1. 当前项目结构（V3）

```
Project_001_AI_Model_Explorer/
├── index.html              # 48 行：顶栏导航 + #app 挂载点（SPA 壳）
├── app.js                  # 1030 行：纯 vanilla JS + hash 路由 SPA（type="module"）
├── styles.css              # 789 行：主题变量 + 全部组件样式
├── data/                   # 规范化数据层（7 个 JSON）
│   ├── providers.json            # 34 厂商（含 9 网关、1 免费自运营）
│   ├── model_families.json       # 系列
│   ├── model_variants.json       # 权威型号（主体）
│   ├── model_variants_extra.json # 增量型号（免费/网关/补录，安全合并）
│   ├── tasks.json                # 14 个任务/场景
│   ├── recommendations.json      # 98 条推荐（task→model_ids+score+reason）
│   └── naming_guide.json         # 16 条命名词典
├── assets/logos/           # 厂商 SVG logo（官方优先，无官方手写字母标）
├── scripts/                # validate_normalized.js / smoke_render.js / gen_data_review.js
├── DATA_SCHEMA.md          # 现有数据层规范（Phase 1 交付）
├── DATA_REVIEW.md          # 全量数据评审稿（供外部 AI 评审）
└── backup/                 # 历史版本备份
```

**路由（hash）**：`#home #providers #provider/:id #family/:id #browse #matcher #gateways #model/:id #glossary`
**运行**：`python3 -m http.server 8848`（按磁盘实时读取，硬刷新生效）；已部署云端预览一次（已可删）。

---

## 2. 当前数据结构

### 2.1 Provider（`providers.json`，34 条）
字段：`id, name, name_cn, logo, country, website, api_docs, api_base_url, api_style, description_cn, open_weight, source, last_verified, brand_color, logo_file, category?`
- 网关用 `category:"gateway"`（9 个：groq/openrouter/nvidia-nim/anyapi/bazaarlink/requesty/opencode-zen/ovh-ai/freeai）
- 免费自运营用 `category:"free"`（agnes）
- **API 信息（base_url/style）直接内嵌在 provider 上**

### 2.2 Model（`model_variants.json` 3415 行 + `model_variants_extra.json` 3037 行，共 ~118 型号）
权威主体 `model_variants.json` 字段（务实口径，未编造）：
- 身份：`id, family_id, provider_id, name, name_cn, model_id, version(隐式)`
- 客观：`context_window, max_output_tokens, input_price_per_mtok, output_price_per_mtok, currency, vision_support, open_weight, speed_tier, params, media_type, max_resolution, media_pricing...`
- 三档定性能力：`capabilities.{reasoning,coding,agent,knowledge,multilingual}.{tier,basis}`
- 定位：`model_type[](Chat/Vision/Reasoning/Coding/Agent/Image/Video...)`、`one_liner_cn`
- 关系：`best_for[] / avoid_for[]`（引用 tasks.id）、`free?`、`free_note?`、`source_url, verified, verified_date`
- **无 `aliases`（中文名/简称/历史名搜索未做）；无独立 `cost_tier`；无 `role` 显式字段（用 model_type 近似）**

### 2.3 Family / Task / Recommendation / Naming
- `model_families.json`：系列（含 provider_id）
- `tasks.json`：14 任务，含 `model_types[]` 与 `prefer{}`（能力/成本/上下文偏好）
- `recommendations.json`：`task_id → model_ids[{id,score,reason}]`
- `naming_guide.json`：16 条命名术语解读

### 2.4 数据关系（当前）
```
Provider ──< Family ──< ModelVariant ──> Capability / best_for→Task / Recommendation
            (Gateway 也塞在 Provider 表里用 category 区分)
```

---

## 3. 当前功能清单

| 功能 | 位置 | 状态 |
|---|---|---|
| 厂商地图（卡片+点击进系列/型号） | `#providers #provider/:id` | ✅ |
| 系列→型号下钻 | `#family/:id` | ✅ |
| 能力筛选（硬筛选：能力 5 维 + 硬性条件 5 项） | `#browse` | ✅ |
| 任务选择器（14 任务→推荐+打分） | `#matcher` | ✅ |
| 托管网关页（复用厂商卡片） | `#gateways` | ✅ |
| 模型详情（参数速读/命名解读/API block/关联） | `#model/:id` | ✅ |
| 名称解释（16 条） | `#glossary` | ✅ |
| 首页搜索（模型/厂商名） | `#home` | ⚠️ 仅名称/厂商，无别名/中文名/场景搜索 |
| 首页 visual-core / proof 条 / 三条路径入口 | `#home` | ✅ |
| 免费模型标识（`free`+`free_note`） | 多处 | ✅（严格口径：免信用卡+API key） |

---

## 4. V4 差距分析（对照 V4.md 逐节）

### 4.1 数据架构（V4 §5 / §6 / §7–§11）
| V4 要求 | 现状 | 差距 |
|---|---|---|
| 独立 `gateways.json` | 网关塞在 `providers.json`（category） | **需拆分**：Gateway 不是厂商（V4 §11 强调） |
| 独立 `api_access.json` | API 字段内嵌 provider | **需独立**：同模型可有多 API（官方/网关/OpenAI兼容） |
| 独立 `pricing.json` | 价格内嵌 model | **需拆分或保留内嵌**（建议保留内嵌，pricing.json 仅作汇总视图，避免重复维护） |
| 独立 `scenarios.json` | `tasks.json` 近似 | 改名/补 Scene 语义即可，差距小 |
| Provider 加 `type:"model_provider"` | 无 type | 小改 |
| Model 加 `aliases`（中文/简称/历史名） | 无 | **需补**，支撑中文/别名搜索（V4 验收✅） |

### 4.2 成本体系（V4 §3）
- V4 三档：**Free / Cost Effective / Production**
- 现状：仅 `free:true` 布尔 + 价格数值
- **差距**：缺显式 `cost_tier` 字段；`free` 严格口径需与 V4「Free=免费体验模型」对齐（基本一致，但 Cost Effective/Production 未标注）

### 4.3 访问方式分类（V4 §4）
- V4 四类：**Official API / Free API / Open Source / Self Host**
- 现状：`open_weight` 布尔 + `free` 标志 + `api_style`
- **差距**：缺 `access_types[]` 多标签；Self Host 概念未显式

### 4.4 三层分类（V4 §9）
- Scene（用户场景）→ Role（模型定位）→ Capability（技术能力）
- 现状：tasks≈Scene、`model_type`≈Role、`capabilities`≈Capability
- **差距小**：需把 `model_type` 显式映射为 V4 的 `role`（general/reasoning/coding/agent/multimodal/low_cost），并确立三层引用关系

### 4.5 首页模块（V4 §12）
| V4 模块 | 现状 | 差距 |
|---|---|---|
| 搜索入口（核心，含中文/别名/能力/场景） | 仅名称/厂商搜索 | **需增强搜索** |
| Scene 推荐「你想用 AI 做什么？」 | matcher 是独立页，首页无 | **新增首页 Scene 模块** |
| 热门模型「当前主流模型」（非排行） | 无 | **新增模块** |
| 成本入口（免费/低成本/商业） | 无首页入口 | **新增模块** |
| API 快速入口 | 仅详情页有 | **首页可选轻量入口** |

### 4.6 详情页三层（V4 §13）
- 第一层（普通用户）：名称/厂商/一句话/标签/推荐用途 — **✅ 已基本具备**
- 第二层（开发者）：Context/Pricing/API方式/Model ID — **✅ 已基本具备**
- 第三层（工程）：Endpoint/Protocol/Tool Calling/Streaming/Structured Output — **⚠️ 仅 Endpoint/Protocol 有，Tool Calling/Streaming/Structured Output 未显式展示**

### 4.7 不开发内容（V4 §14）
排行榜 / Benchmark / 爬虫 / 在线聊天 / 用户系统 / 社区 / 自动 Agent 推荐 — 当前均未做，**一致，保持**。

### 4.8 待修已知问题（非 V4 但相关）
- 首页 `visual-core`「30s 秒级选型」文案与已拆分的多路径选型冲突（用户已知，待定方案）
- 版本标签显示 `V3`，升级后应改 `V4`

---

## 5. 风险点

1. **大文件编辑风险**：`model_variants.json` 3415 行，盲改易错。沿用既有 `model_variants_extra.json` 增量合并模式更安全；V4 重构建议用迁移脚本生成新文件，不手改大体量 JSON。
2. **数据迁移一致性**：~118 型号 + 98 推荐 + 14 任务外键关系，迁移后必须跑 `validate_normalized.js` 校验（外键/价格/能力完整性）。
3. **Gateway 拆分影响面**：`viewGateways()`、`catBadge()`、`filteredProviders()` 均依赖 `category:"gateway"`，拆分到 `gateways.json` 后需同步改读取逻辑，否则网关页/厂商地图过滤会断。
4. **API 独立化影响**：详情页 `apiBlockHTML()` 当前读 provider 的 `api_base_url/api_style`；改为 `api_access.json`（按 model 维度）后，需重写详情页第二/三层读取。
5. **SPA 单文件风险**：`app.js` 1030 行单文件，重构 `loadData`/`state`/路由需谨慎，建议增量追加函数而非大段重写，保留旧页面直到新模块稳定。
6. **免费口径措辞**：V4 把 Free 作为成本档之一，与现有严格「免信用卡+API key」口径基本一致，但需明确 `cost_tier:"free"` 与旧 `free:true` 的映射，避免重复/矛盾。
7. **搜索增强**：别名/中文搜索需 `aliases` 字段 + 搜索逻辑扩展，若字段缺失会搜不到，需先补数据再开功能。
8. **云端部署残留**：曾部署云端预览（agentos-app.net），非本地端口，可择机删除，不影响本地 8848。

---

## 6. 结论与建议执行顺序（供 Step 2–4 参考）

**建议（增量升级、不破坏现有资产）：**
- **数据层**：保留 `providers/model_variants` 命名习惯，新增 `gateways.json`、`api_access.json`、`scenarios.json`；在 model 上加 `aliases`/`cost_tier`/`role`/`access_types`；`pricing` 建议保留内嵌（不加独立文件以避免双源维护）。
- **前端**：`loadData` 增量 fetch 新文件并入 `state`；`providers.json` 网关项可保留 `category` 做过渡，或迁移时一并清空并改读 `gateways.json`。
- **模块**：先做首页 Scene 推荐 + 搜索增强（验收核心），再做成本入口/热门模型，最后补详情页第三层工程信息。
- **验收**：对照 V4 §16 逐条核对（搜索/中文别名/用途/定位/成本/API/Model ID/免费/低成本 + 开发者信息）。

> 本审计不修改任何代码。下一步进入 Step 2（数据层升级 + 迁移脚本 + 验证）。
