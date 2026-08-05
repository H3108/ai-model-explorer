# AI Model Explorer 项目审计报告 V3（接手审计）

审计日期：2026-08-05
审计范围：全部前端代码、静态数据层、入口页面、校验脚本、项目文档
审计方式：静态代码走查 + JSON 外键校验 + 本地静态服务器运行时验证
本阶段约束：**未修改任何业务代码与数据**

---

## 0. 一句话结论

**骨架站得住，数据是空的。**

项目的架构方向（Registry 数据层 / 厂商→模型→详情三层导航 / 任务选择器）是对的，19 个模型的外键关系完整、校验脚本通过、页面能正常跑起来。

但是：**19 个模型 × 全部关键指标（价格、上下文、推理分、编码分）= 100% `unknown`**。

直接后果是——当前的"推荐 TOP 3"并不是推荐，而是**按 JSON 文件里的物理顺序取前 3 条**。

> 实测：选择"AI 聊天" → 命中 16 个模型 → 输出 GPT-4o / GPT-4o mini / Claude Sonnet 4（正好是 models.json 的第 1、2、4 行）。没有任何排序逻辑参与。

所以升级为「AI 模型选择导航系统」的瓶颈**不在前端，在数据**。第四阶段（数据库重设计）必须先于第二、三阶段落地，否则页面再漂亮也只是在展示 unknown。

---

## 1. 当前技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端框架 | **无** | 原生 HTML + ES Module JS，零依赖 |
| 构建工具 | **无** | 无 npm / package.json / bundler，改完直接刷新 |
| 样式 | 原生 CSS + CSS 变量 | 163 条规则，9 个主题变量，含 2 个响应式断点（820px / 550px） |
| 数据层 | 7 个静态 JSON | `fetch()` 并行加载，无数据库 |
| 后端 | **无** | 纯静态托管即可 |
| 校验 | `scripts/validate_registry.py` | Python 标准库，仅做外键与必填字段断言 |
| 外部依赖 | Google Fonts CDN | DM Sans + Noto Sans SC |
| 版本管理 | **无 git** | 只有手工 `backup/2026-08-05-v2-audit/` 目录 |
| 运行方式 | `python3 -m http.server` | 因为用 fetch 加载 JSON，不能 file:// 直接打开 |

### 需要注意的两个技术债

1. **源码被压缩成单行**。`app.js` 只有 33 行，但第 25 行（`renderRecommendation`）和第 28 行（`showVariant`）单行长度都超过 1500 字符；`styles.css` 是 12KB 的**一整行**。这不是编译产物，是手写成这样的 —— 后续多人/多轮迭代时 diff 完全不可读，改动风险极高。
2. **没有 git**。目前唯一的回滚手段是 `backup/` 目录快照。开始 Phase 1 之前建议先 `git init`。

---

## 2. 当前页面结构

实际是**单页应用（非路由式）**，全部内容在 `index.html`，靠 hash 锚点切换视觉焦点。

```
index.html  (26 行，全部内容压缩在单行标签里)
├── header.topbar          品牌 + 导航(厂商地图/任务选择器/名称解释) + 版本徽章
├── #home     .hero        主视觉：标题 + 双 CTA + 装饰性轨道动画卡片
├── .proof                 统计条：厂商数 / 系列数 / 型号数 / "30s"  ← 前 3 个由 JS 填充
├── #providers .section    01 PROVIDER MAP：4 个筛选 tab + 厂商卡片网格
├── #matcher   .matcher    02 TASK MATCHER：任务选项 + 预算 + 速度 + 推荐结果面板
├── #glossary  .section    03 NAME GLOSSARY：模型名称后缀解释卡片
├── footer.footer
└── #modal    .modal       模型详情弹窗（默认 .hidden）
```

### 路由现状

| 路径 | 实际行为 | 状态 |
|---|---|---|
| `/` | 真实页面 | ✅ |
| `/providers/` | `<meta http-equiv="refresh">` 跳回 `../index.html#providers` | ⚠️ 空壳 |
| `/matcher/` | `<meta http-equiv="refresh">` 跳回 `../index.html#matcher` | ⚠️ 空壳 |
| `/models/:id` | **不存在**，模型详情只有弹窗，无独立 URL | ❌ |

**运行时验证**：全部 12 个资源路径（页面 / CSS / JS / 7 个 JSON / 2 个壳页）均返回 HTTP 200，无 404，无控制台加载错误。

### 渲染函数映射

```
loadRegistry()  ── 并行 fetch 7 个 JSON
   ├── renderStats()          → .proof 的 3 个数字
   ├── renderProviders()      → #provider-grid
   ├── renderMatcher()        → #task-options（并默认选中第 1 个任务）
   │     └── renderRecommendation() → #recommendation
   ├── renderGlossary()       → #glossary-grid
   └── renderRegistryNotice() → 动态插入 unknown 免责提示
showVariant(id)               → #detail-content + 打开 modal
```

---

## 3. 当前数据结构

### 3.1 文件清单（实测）

| 文件 | 条目 | 主键 | 作用 |
|---|---:|---|---|
| `providers.json` | 12 | `id` | 厂商基础信息 |
| `models.json` | 19 | `id` | 模型主表（含 `model_family` 字符串字段） |
| `pricing.json` | 19 | `model_id` | 价格表（1:1） |
| `capabilities.json` | 19 | `model_id` | 能力表（1:1） |
| `api.json` | 12 | `provider` | 厂商 API 端点（1:1） |
| `categories.json` | 对象 | — | 模型类型枚举 + 7 个任务 + 5 条名称解释 |
| `recommendations.json` | 5 | `id` | 预设推荐策略（**当前页面无入口，见问题 P1-2**） |

### 3.2 关系图

```
providers.id (12)
   └─< models.provider_id (19)
          ├── pricing.model_id      1:1 ✅ 全覆盖
          ├── capabilities.model_id 1:1 ✅ 全覆盖
          └── models.model_family   ← 只是字符串，没有独立实体表
providers.id ──── api.provider      1:1 ✅ 全覆盖
categories.tasks[].model_types[] ──弱匹配──> models.model_type[]
recommendations[].model_ids[] ────> models.id （数据存在，UI 不可达）
```

`python3 scripts/validate_registry.py` 输出：
`REGISTRY_VALID {'providers': 12, 'models': 19, 'pricing': 19, 'capabilities': 19, 'api': 12, 'categories': 'object', 'recommendations': 5}` ✅

**外键完整性没有问题。问题在字段值。**

### 3.3 字段填充率（核心问题）

| 表 | 字段 | 有效值占比 |
|---|---|---:|
| pricing | `input_price` / `output_price` / `cache_price` | **0 / 19** |
| pricing | `effective_from` / `source` / `last_verified` | **0 / 19** |
| capabilities | `reasoning` / `coding` | **0 / 19** |
| capabilities | `context_length` / `streaming` / `function_calling` / `json_mode` / `tool_calling` | **0 / 19** |
| capabilities | `vision` / `audio` | 5 / 19（仅 GPT-4o 系列 + Gemini 系列为 true，其余 unknown） |
| models | `performance_level` / `cost_level` | **0 / 19** |
| models | `avoid_for` | 1 / 19（仅 Claude Opus 4 有真实值） |
| providers | `logo` / `last_verified` | **0 / 12** |
| api | `base_url` | 7 / 12（Google、Qwen、GLM、百度、MiniMax、Meta 为 unknown） |

> 这个设计本身是**诚实的**——不编造数据是对的，`unknown` 约定应当保留。但也意味着当前系统在事实上**无法回答"哪个更便宜/更强"**这类问题，而这恰恰是导航系统的核心价值。

### 3.4 与目标 Schema 的差距

你要求的目标结构 vs 现状：

| 目标表 | 现状 | 差距 |
|---|---|---|
| `providers` | ✅ 存在 | 缺 `logo`（字段有但全 unknown） |
| `model_families` | ❌ **不存在** | 只有 models 表上的一个字符串字段，无法挂描述/排序/系列级说明 |
| `model_variants` | ⚠️ 即 models.json | 缺 `context_window`、`input_price`(在另表)、`speed`、`reasoning_score`、`coding_score`、`vision_support` **全部 6 个评分/规格字段** |
| `tasks` | ⚠️ 埋在 categories.json 里 | 无独立文件，无 `description` 之外的权重定义 |
| `recommendations` | ⚠️ 存在但结构不对 | 现在是 `{策略, model_ids[]}`，目标要求 `{model_id, task_id, score, reason}` —— **缺 score，缺任务维度** |

---

## 4. 当前已有功能

实测可用的功能（在本地服务器逐项点过）：

| 功能 | 状态 | 说明 |
|---|---|---|
| 统计数字 | ✅ | 12 厂商 / 14 系列 / 19 型号，从 JSON 实时算 |
| 厂商卡片列表 | ✅ | 展示中文名、定位、模型数、旗下模型行 |
| 厂商筛选（全部/美国/中国/开源） | ⚠️ 部分 | 见 P1-3，Mistral(FR) 会被漏掉 |
| 任务选择器（7 个任务） | ⚠️ 能点 | 但输出的不是推荐，见 P0-2 |
| 预算倾向（省钱/平衡/质量优先） | ❌ **点了没反应** | 见 P1-1 |
| 速度偏好（平衡/速度/质量） | ❌ **点了没反应** | 见 P1-1 |
| 模型详情弹窗 | ✅ | 能力标签 / 价格 / API 参数 / 推荐用途，ESC 和点遮罩可关闭 |
| 名称解释（Mini/Pro/Flash/Reasoning/Vision） | ✅ | 已由 `categories.json` 驱动 |
| unknown 兜底显示 | ✅ | 统一显示为 `unknown`，不编造 |
| 响应式布局 | ✅ | 820px / 550px 两个断点 |

---

## 5. 已完成部分

1. **Registry 数据层已建立** —— 价格、能力、API 从模型主表拆出，可独立更新。方向正确，应保留。
2. **外键关系完整可校验** —— 19 模型 / 12 厂商全覆盖，校验脚本可用。
3. **数据真实性纪律** —— 未核验字段一律 `unknown`，且"最便宜模型"策略主动返回空并说明原因，没有编造。这一点做得好，**必须继续保持**。
4. **视觉系统成型** —— 9 个 CSS 变量的浅绿极简风格（`--green:#baf17a` / `--deep:#173e35` / `--paper:#f7f9f4`），163 条规则覆盖卡片、标签、弹窗、分段控件，组件语言统一。**这是最值得复用的资产。**
5. **三层导航骨架** —— 厂商 → 旗下模型 → 详情弹窗的路径已跑通。
6. **中文化完成** —— 厂商和模型都有 `name_cn` / `description_cn` / `usage_example_cn`。
7. **备份机制** —— `backup/2026-08-05-v2-audit/` 保留了改造前完整快照。

---

## 6. 未完成部分

对照你提出的六个阶段：

| 阶段 | 完成度 | 缺口 |
|---|---:|---|
| **二｜信息架构升级** | 40% | Provider→Family 这一层是**假的**：14 个"系列"里 10 个只有 1 个型号（GLM、Kimi、ERNIE、abab、Grok、Llama、Codestral、o系列…）。Family 页面现在没有内容可展示。Capability / Use Case / Recommendation 三层未建模。 |
| **三｜数据库重设计** | 25% | 缺 `model_families`、`tasks`、`recommendations(score)` 三张表；缺 `context_window` / `speed` / `reasoning_score` / `coding_score` / `vision_support` 五个关键字段；价格字段全空。 |
| **四｜页面重构** | 20% | Provider 页面是 meta refresh 空壳；Model Family 页面**完全不存在**；Model Detail 缺"一句话定位 + 适合✓/不适合✗"的结构化呈现（现在 `avoid_for` 18/19 是 unknown，展示出来就是一行 "unknown"）。 |
| **五｜模型选择助手 /matcher** | 15% | `/matcher` 是空壳；7 个任务选项已有，但"视频生成"匹配 0 个模型、"图片生成"匹配到的是视觉**理解**模型；无打分、无 TOP3 排序、无推荐理由生成。 |
| **六｜命名解释系统** | 70% | 5 条已有且数据驱动。缺 Turbo / Air / Max / Lite / Instruct / Preview 等常见后缀；未与模型详情页联动（详情页看到 "Flash" 不能点开解释）。 |

另外整体缺失：
- Embedding / Image / Video 类模型**一个都没有**（categories 声明了 `Embedding` 和 `Image` 类型，但 0 个模型使用）
- 模型横向对比表
- 搜索功能
- 独立 URL 路由（分享链接无法定位到具体模型）

---

## 7. 存在的问题

按严重度分级，**每条都附实测证据**。

### 🔴 P0（阻塞核心价值，必须先解决）

**P0-1｜关键数据 100% 为空，推荐系统在数学上不可能成立**
价格、上下文长度、推理/编码能力全部 `unknown`。目标 schema 里的 `speed` / `reasoning_score` / `coding_score` 三个排序依据**字段都还不存在**。
→ 影响：Phase 4 推荐系统无法在数据补齐前开发。

**P0-2｜"推荐 TOP 3" 实为"文件前 3 行"**
`app.js:25` 逻辑：`state.models.filter(类型匹配).slice(0, 3)` —— **无任何排序**。
实测："AI 聊天"命中 16 个模型，输出 GPT-4o / GPT-4o mini / Claude Sonnet 4，正是 models.json 的物理前 3 条。
→ 这是**误导性输出**：用户以为得到了推荐，实际得到的是录入顺序。

**P0-3｜任务匹配规则失效（实测数据）**

| 任务 | 命中数 | 问题 |
|---|---:|---|
| 本地部署 | **19/19** | `model_types:["Chat","Coding","Vision"]` 匹配了所有模型。实际只有 Llama 4 Scout 是开放权重。**结论完全错误** |
| 低成本 API | **19/19** | 同上，且无价格数据可筛 |
| 视频生成 | **0** | `model_types:["unknown"]`，页面显示空结果 |
| 图片生成 | 6 | 命中的是 GPT-4o / Gemini 等**视觉理解**模型，不是图像**生成**模型。Vision ≠ Image Generation，**语义错误** |

**P0-4｜数据模型撑不起目标信息架构**
`model_family` 只是模型表上的一个字符串，无独立实体 → Family 页面没有描述、没有排序、没有系列级对比基准可挂。

---

### 🟠 P1（功能性 Bug，明确可修）

**P1-1｜预算 / 速度选择器是死控件**
静态检查：`data-value` 在 HTML 中出现 **6 次**，`app.js` 的全局 click 委托中处理 `data-value` 的分支 **0 个**。
→ 用户点"尽量省钱"，视觉上按钮甚至不会切换选中态（选中态由 `.selected` 类控制，无 JS 添加），推荐结果也不变。**这是承诺了但没实现的功能。**

**P1-2｜`recommendations.json` 的 5 条策略无 UI 入口**
静态检查：`app.js` 中有 2 处 `[data-recommendation]` 处理逻辑，但 HTML 和 JS 渲染出的 DOM 中该属性出现 **0 次**。
→ "最强模型 / 性价比 / 最便宜 / Agent / Coding" 5 条策略是**不可达的死数据**，`state.selectedRecommendation` 永远为空字符串。

**P1-3｜厂商筛选漏掉非美非中厂商**
筛选映射 `{'美国':'US','中国':'CN','开源':'open'}`，但 `providers.json` 的国家分布是 `{US:5, CN:6, FR:1}`。
→ Mistral AI（FR）只在"全部"下可见，三个筛选 tab 都会把它藏起来。

**P1-4｜详情弹窗读取不存在的字段**
`app.js:28` 读 `model.source` 和 `model.last_verified`，但 `models.json` 的模型对象**没有这两个字段**（它们在 providers/pricing/capabilities 上）。
→ "来源状态"永远显示 unknown，不是因为数据没核验，是因为**读错了对象**。

**P1-5｜筛选逻辑重复实现两份**
`renderProviders()`（app.js:21）和全局 click 委托（app.js:31）各写了一遍**相同**的厂商过滤 + 渲染逻辑。
→ 改一处忘另一处必然导致行为不一致。

---

### 🟡 P2（工程质量与一致性）

| # | 问题 | 说明 |
|---|---|---|
| P2-1 | 模型族退化 | 14 个 family 中 10 个只含 1 个型号，"系列→型号"层级形同虚设 |
| P2-2 | 无 git | 唯一回滚手段是 backup 目录快照 |
| P2-3 | 源码单行化 | `styles.css` 12KB 单行、`app.js` 多个 1500+ 字符长行，不可 review、不可 diff |
| P2-4 | **`PROJECT_AUDIT_V2.md` 已过期** | 报告称 "`categories.json` 缺失"、"`api_endpoints.json` 需重命名"、"glossary 硬编码在 app.js"——这三项**都已完成**。该文档会误导后续接手者 |
| P2-5 | `/providers` `/matcher` 空壳 | meta refresh，无独立内容，SEO 与分享价值为 0 |
| P2-6 | 死 HTML | `index.html:19` 的 `.recommendation-empty` 空状态在加载完成后立即被 `renderRecommendation()` 覆盖，永远不可见 |
| P2-7 | 类型枚举与数据不符 | `categories.model_types` 声明了 `Embedding` 和 `Image`，实际 0 个模型使用 |
| P2-8 | 无 XSS 防护 | 全部渲染用 `innerHTML` + 模板字符串拼接。当前数据源可信所以无实际风险，但一旦引入外部数据需要转义 |
| P2-9 | Logo 未消费 | `providers.logo` 字段存在但全为 unknown，页面用厂商名首字母代替 |

---

## 8. 后续改造建议

### 8.1 总原则（与你的要求对齐）

- ✅ 不删除已有有效代码 —— 现有 CSS 组件库和 Registry 拆分方向全部保留
- ✅ 保持当前 UI 风格 —— 复用 9 个 CSS 变量与既有卡片语言，只加不推翻
- ✅ 分阶段推进 —— 每阶段独立可验收、可回滚
- ⚠️ **建议调整顺序**：Phase 1 必须是数据，因为 Phase 2/3/4 全部依赖它

### 8.2 建议先做的两件准备工作

1. `git init` + 首次提交（当前状态存档），后续每个 Phase 一个 commit，比 backup 目录可靠得多
2. 把 `styles.css` 和 `app.js` 格式化展开（**纯格式化，不改逻辑**），否则后面每次改动都是在雷区跳舞

### 8.3 分阶段方案

#### **Phase 1 — 数据结构（地基）**

| 项 | 内容 |
|---|---|
| **新增文件** | `data/model_families.json`、`data/tasks.json`、`data/recommendations.json`（重构为 `{model_id, task_id, score, reason}`） |
| **修改文件** | `data/models.json`（+`family_id` `context_window` `speed` `reasoning_score` `coding_score` `vision_support` `one_liner`）、`data/pricing.json`（填真实价格）、`scripts/validate_registry.py`（+新表校验） |
| **兼容策略** | 保留 `model_family` 字符串字段一个版本周期，新增 `family_id` 并行，前端切换完成后再移除 |
| **影响范围** | `app.js` 的 `renderStats()` / `providerCard()` 需要跟着改（family 从字符串变引用） |
| **验收** | `validate_registry.py` 通过；关键字段填充率 ≥ 90%；页面功能与改造前一致（无回归） |
| **⚠️ 阻塞** | **数据从哪来必须先定**，见 §9 |

#### **Phase 2 — 厂商页面**

| 项 | 内容 |
|---|---|
| **改造** | `providers/index.html` 从 meta refresh 壳 → 真实页面；新增 `providers/family.html?id=xxx`（或 hash 路由）承载 Model Family 页 |
| **复用** | 直接复用 `.provider-card` / `.series-row` / `.provider-tabs` / `.compare-row` 现有样式，零新增视觉 |
| **顺带修** | P1-3（筛选改为读 `providers.country` 动态生成 tab，不再硬编码中英映射）、P1-5（抽出 `filterProviders()` 单一实现） |
| **验收** | 12 个厂商页可达；每个 Family 页展示同系列型号横向对比（能力/速度/价格/场景四列） |

#### **Phase 3 — 模型详情**

| 项 | 内容 |
|---|---|
| **改造** | 详情弹窗增加「一句话定位」区块（读新增的 `one_liner`）、「✓ 适合 / ✗ 不适合」双列结构 |
| **顺带修** | P1-4（`source`/`last_verified` 改从 pricing / capabilities 读）、P2-9（消费 logo 字段） |
| **可选** | 增加独立 URL `#/models/:id`，让详情可分享 |
| **验收** | 19 个模型全部有非 unknown 的一句话定位和至少 1 条"不适合"场景 |

#### **Phase 4 — 推荐系统**

| 项 | 内容 |
|---|---|
| **改造** | `/matcher` 独立页；`renderRecommendation()` 重写为**打分排序**：`score = w1·任务匹配 + w2·能力分 + w3·价格分 + w4·速度分`，权重由预算/速度选择器实时调节 |
| **必修** | P1-1（接上预算/速度事件）、P1-2（暴露 5 条预设策略入口）、P0-3（重写任务匹配规则：本地部署→按 open_weight 标记；低成本→按真实价格排序；图片生成→引入真正的 Image 模型或明确标注"暂无收录"） |
| **关键** | 每个推荐**必须输出可解释理由**，理由从数据字段生成而非写死文案 |
| **验收** | 7 个任务 × 3 档预算 × 3 档速度 = 63 种组合，全部返回非空 TOP3 且理由与数据一致；无数据支撑时明确显示"数据不足，不排序"而非给假结果 |

#### **Phase 5（建议追加）— 命名解释系统联动**

补齐 Turbo / Air / Max / Lite / Instruct / Preview 后缀；模型详情页的后缀词可点击弹出解释。成本很低，但对"用户不需要懂模型"这个目标贡献很大。

### 8.4 可直接复用的资产清单

| 资产 | 复用于 |
|---|---|
| `.provider-card` / `.series-row` | Provider 页、Family 页 |
| `.compare-box` / `.compare-row` | Family 页横向对比表 |
| `.task-options` / `.segmented` | Matcher 页 |
| `.result-row` / `.rank` / `.match-badge` | 推荐结果列表 |
| `.glossary-card` | 命名解释系统 |
| `.capabilities span` / `.capabilities span.on` | 能力标签（已支持 on/off 两态） |
| `.detail-grid` / `.positioning` | 模型详情页 |
| 9 个 CSS 变量 | 全站，无需新增配色 |

**结论：Phase 2-4 的 UI 几乎不需要写新样式，现有组件库已经覆盖。**

---

## 9. 需要你拍板的 3 个阻塞项

这三个问题不定，Phase 1 无法动手。

### ① 数据从哪来？

目标 schema 要求 `input_price` / `output_price` / `context_window` 等硬指标，当前 19 个模型全是 unknown。三种选择：

- **A. 我联网逐个核实**：从各厂商官方定价页和文档抓取，标注 `source` + `last_verified`。准确，但 19 个模型 × 12 家厂商需要相当多轮次
- **B. 你提供数据源**：你有现成表格 / 内部数据 / 指定参考站点，我负责结构化入库
- **C. 先建结构，数据留 unknown**：先把表结构和前端跑通，数据后续分批补

### ② 模型清单口径

你的需求文档里举例提到 **GPT-5 Pro / GPT-5 Mini / DeepSeek V4 / V4 Flash**。我需要说明：**这些型号我无法核实其存在与规格**，当前 Registry 里是 GPT-4o、o3、Claude 4、Gemini 2.5、DeepSeek V3/R1。

按你一贯要求（不能无凭无据瞎说），我**不会**凭示例文案就把 GPT-5 Pro 写进数据库。请确认：
- 是把这些当**举例说明格式**（那我按实际存在的型号建库），
- 还是这些型号**确实已发布**（那请给我官方链接，我去核实后入库）？

### ③ `reasoning_score` / `coding_score` 的分值从哪来？

厂商官方**不提供**这类统一评分。可选：
- **A. 第三方榜单**（LMArena / SWE-bench 等），需注明来源与快照日期
- **B. 分档而非打分**（高/中/低三档 + 判断依据），比假装精确的数字更诚实
- **C. 不做评分**，推荐只依据"模型类型 + 价格 + 上下文"等可核实的客观字段

**我的建议是 B+C 组合**：客观字段（价格、上下文、是否支持视觉）用于硬筛选，能力用三档定性 + 注明依据。这样既能排序，又不会输出无法追溯的假精度。

---

## 10. 本阶段声明

本次审计**未修改任何业务代码或数据文件**，仅新增本报告 `PROJECT_AUDIT_V3.md`。

`PROJECT_AUDIT_V2.md` 保留但已过期（其中 3 项结论与当前代码不符，详见 P2-4），建议在 Phase 1 完成后统一归档到 `backup/`。

等你对 §9 的三个问题给出方向，我再开始 Phase 1。
