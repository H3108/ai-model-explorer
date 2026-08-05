# AI Model Navigator V2 项目审计报告

审计日期：2026-08-05  
审计范围：当前工作区全部前端、静态数据、入口页面与项目文档  
审计原则：本阶段只审计，不修改业务代码；后续重构前先创建可恢复 backup。

## 1. 审计结论

当前项目已经从“模型平铺列表”初步转向“厂商地图 + 推荐入口”，但仍不是一个完整、唯一数据源驱动的 AI 模型选择导航系统。

主要结论：

1. 页面主入口已具备厂商和推荐两个方向，但首页仍通过大量静态 HTML 文案表达产品信息，尚未围绕用户任务完成完整闭环。
2. 当前 `app.js` 已加载 6 份 JSON，但目标数据结构要求的 `categories.json` 缺失，`api_endpoints.json` 也需要迁移为目标命名和字段规范中的 `api.json`。
3. Registry 的主键关系基本可用：19 个模型分别关联价格和能力数据，12 个厂商关联 API 端点。
4. 数据真实性风险被正确控制：大量未经核验字段使用 `unknown`。但这也意味着当前不能可靠输出“最强”“性价比”排序，只能展示候选模型与“待验证”状态。
5. 中文信息严重不足：厂商缺少 `name_cn`、`description_cn`，模型缺少 `display_name_cn`、`description_cn`、`usage_example_cn`。
6. 页面仍存在硬编码数据：名称解释、推荐入口图标、部分页面固定文案、能力标签集合和推荐展示结构没有从 Registry 加载。
7. 项目文档包含旧版 `variants.json`、`tasks.json` 说明，与当前文件系统不一致。

## 2. 当前文件与职责

```text
AI_Model_Explorer.md                 产品需求原稿
README.md                            项目说明，但包含旧数据结构遗留
index.html                           首页、厂商地图、推荐区、名称解释、详情弹窗壳
app.js                               Registry 加载、渲染、推荐选择、详情弹窗逻辑
styles.css                           全局静态样式和响应式布局
providers/index.html                 厂商地图 hash 跳转壳页面
matcher/index.html                   任务选择器 hash 跳转壳页面
data/providers.json                  厂商数据
data/models.json                     模型数据
data/pricing.json                    价格数据
data/capabilities.json              能力和协议能力数据
data/api_endpoints.json              厂商 API 端点数据
data/recommendations.json            推荐候选和推荐理由
```

当前数据文件统计：

| 文件 | 条目数 | 当前作用 | 审计状态 |
|---|---:|---|---|
| `providers.json` | 12 | 厂商基础信息 | 可保留，需补字段 |
| `models.json` | 19 | 模型及 Model ID | 可保留，需重命名字段/补中文 |
| `pricing.json` | 19 | 独立价格 | 可保留，需规范 unknown 和历史价格 |
| `capabilities.json` | 19 | 能力与协议 | 可保留，需补评分/来源规范 |
| `api_endpoints.json` | 12 | 厂商 API 端点 | 重命名为目标 `api.json` 并迁移字段 |
| `recommendations.json` | 5 | 推荐候选 ID 和理由 | 可保留，需改成数据驱动策略 |
| `variants.json` | 不存在 | 旧版具体型号数据 | 已删除，不能恢复为第二数据源 |
| `tasks.json` | 不存在 | 旧版任务数据 | 已删除，任务应迁移到 `categories.json` |

## 3. 当前前端架构

### 3.1 页面结构

`index.html` 是一个单页静态应用，包含：

- Hero：固定文案“找到适合你的 AI 模型”
- 统计区：数量从 JSON 加载
- Provider Map：由 `providers.json` 和 `models.json` 渲染
- Matcher：由 `recommendations.json` 渲染候选模型
- Glossary：固定在 `app.js` 的名称解释数组中
- Modal：由 `app.js` 组合模型、价格、能力、API 展示

`providers/index.html` 与 `matcher/index.html` 不是独立页面，而是通过 meta refresh 跳回 `index.html#providers` / `index.html#matcher` 的入口壳。

### 3.2 数据加载流

```text
index.html
  └── app.js
      └── loadRegistry()
          ├── providers.json
          ├── models.json
          ├── pricing.json
          ├── capabilities.json
          ├── api_endpoints.json
          └── recommendations.json
      ├── renderStats()
      ├── renderProviders()
      ├── renderMatcher()
      ├── renderGlossary()
      └── showVariant()
          ├── providerFor()
          ├── pricingFor()
          ├── capabilityFor()
          └── endpointFor()
```

### 3.3 数据绑定评价

已绑定到数据层：

- 厂商列表
- 厂商下的模型列表
- 模型名称、模型族、模型类型、Model ID
- 输入/输出价格和货币
- 能力标签与协议字段
- API Base URL、兼容格式、认证方式
- 推荐候选模型 ID

仍然硬编码或半硬编码：

- 首页 Hero 的产品说明、统计说明、导航标题
- 推荐按钮的图标数组 `['✦','↗','♧','⚙','⌘']`
- 名称解释 `Mini / Pro / Flash / Reasoning / Vision`
- 能力展示集合 `Reasoning / Coding / Vision / Audio / Context...`
- 推荐策略的视觉标签和固定免责声明
- 厂商 logo 使用厂商名称首字符，没有 `logo` 字段消费
- 国家筛选按钮使用中文“美国/中国”，而 Registry 使用 `US/CN/EU`

## 4. 当前数据架构审计

### 4.1 优点 / KEEP 候选

- 价格已从模型主表拆出，符合独立更新要求。
- 能力已从模型主表拆出，避免模型对象无限膨胀。
- API Endpoint 已从模型主表拆出，适合按厂商维护。
- 模型与厂商、价格、能力使用稳定 ID 关联，当前外键可校验。
- 未确认值用 `unknown`，符合“不生成虚假数据”的约束。
- `source`、`lastVerified` 为未来官方资料更新保留了基础字段。

### 4.2 结构问题 / REFACTOR 候选

#### Provider

当前字段：`id`、`name`、`aliases`、`regions`、`focus`、`officialUrl`、`source`、`lastVerified`。

缺失目标字段：

- `name_cn`
- `logo`
- `country`（当前使用 `regions`，语义不一致）
- `website`
- `api_docs`
- `description_cn`

#### Model

当前字段：`id`、`providerId`、`modelName`、`modelFamily`、`modelType`、`modelId`。

缺失目标字段：

- `display_name_cn`
- `description_cn`
- `usage_example_cn`
- `best_for`
- `avoid_for`
- `performance_level`
- `cost_level`
- `multimodal`
- 统一的能力字段关联或分类关系

#### Pricing

当前字段已经有 `inputPrice`、`outputPrice`、`currency`、`unit`，但仍需：

- `cache_price`
- 价格类型 / 输入缓存类型
- `effective_from`、`effective_to`
- 价格来源和官方 URL
- 数值字段与 `unknown` 的 schema 约束

#### Capabilities

当前能力值大多为 `unknown`，并且 `vision`、`audio` 有时为 boolean，其他能力为 `unknown`，缺乏统一枚举或评分标准。

需要明确：

- 统一使用 `unknown | boolean | score` 的字段协议，不能让页面自行猜测
- `chat`、`embedding`、`agent` 等一级分类
- `context_length`、`max_output_tokens`
- `multimodal`
- `function_calling`、`json_mode`、`streaming`
- 推荐用途和避免用途的中文字段

#### API

当前文件名为 `api_endpoints.json`，目标命名为 `api.json`；字段为 camelCase，目标文档要求的字段包含：

- `provider`
- `base_url`
- `api_format`
- `authentication`
- `compatible_with_openai`

需要统一命名策略，避免同时出现 `providerId`、`provider`、`apiCompatibleFormat` 等多种表示。

#### Categories

当前不存在 `categories.json`。这是核心缺口，导致首页任务入口不能由数据驱动，也无法统一支持：

- Chat
- Reasoning
- Coding
- Vision
- Embedding
- Image
- Audio
- Agent

## 5. 模型覆盖审计

当前已覆盖：

- OpenAI
- Anthropic
- Google
- DeepSeek
- Alibaba Qwen
- Zhipu GLM
- Moonshot Kimi
- Baidu
- MiniMax
- Mistral
- xAI
- Meta

与目标相比缺少或不完整：

- `Gemma` 作为独立开源模型系列
- `Qwen Open` 的开源版本区分
- `Mistral Open` 的开源版本区分
- `Llama` 当前仅有一个模型条目，不能体现系列结构
- 各家 Embedding、Image、Audio 模型严重缺失
- 视频生成模型未纳入当前数据层

因此当前数据量不能证明覆盖主流 API 模型的 80%–90%，应标记为“初始化骨架”，而不是完整市场数据库。

## 6. KEEP / REFACTOR / REMOVE

### KEEP

- `index.html` 的单页静态壳和绿色极简视觉方向
- `styles.css` 的响应式布局基础和卡片组件语言
- `app.js` 的 Registry 异步加载思路
- `providers.json`、`models.json`、`pricing.json`、`capabilities.json` 的拆分方向
- `source` / `lastVerified` 审计字段
- 详情弹窗中的 API、价格、能力展示思路
- `README.md` 中关于零依赖、静态服务器和 unknown 约束的说明（需更新结构）

### REFACTOR

- 将 `api_endpoints.json` 迁移为统一命名的 `api.json`
- 新增 `categories.json`，让首页任务和模型分类成为唯一数据源
- 为所有厂商增加中文名、Logo、网站、API 文档、中文介绍
- 为所有模型增加中文显示名、中文介绍、使用示例、推荐/避免用途
- 统一 JSON 字段命名为 snake_case，或明确 schema 并全项目一致使用
- 将页面上的名称解释、能力标签、任务入口、推荐理由改为 JSON 驱动
- 将推荐系统改为基于类别、能力、成本状态的可解释规则
- 将国家/地区数据从 `US/CN/EU` 映射为数据字段，不在页面硬编码中文筛选值
- 统一详情页对 `unknown` 的视觉展示和排序行为
- 以模型为中心重新整理“厂商 → 模型 → 定位 → 场景 → 价格 → API”展示流程
- 更新 README，删除旧 `variants.json` / `tasks.json` 说明

### REMOVE

执行重构前不直接删除；先 backup，迁移确认后再移除：

- `providers/index.html` 和 `matcher/index.html` 的 meta refresh 壳（改为真正的数据驱动视图或保留明确路由入口）
- `data/api_endpoints.json` 原文件名（迁移完成后替换为 `data/api.json`）
- `app.js` 中硬编码的 `renderGlossary()` 数据
- `app.js` 中硬编码的推荐图标数组和固定分类标签
- 旧 README 中的 `variants.json`、`tasks.json` 结构描述
- 任何恢复旧版单层模型列表的数据文件

## 7. 建议的 V2 唯一数据源结构

```text
data/
├── providers.json
├── models.json
├── pricing.json
├── capabilities.json
├── api.json
└── categories.json
```

推荐关系：

```text
providers.id
  └── models.provider_id
      ├── pricing.model_id
      ├── capabilities.model_id
      ├── api.provider_id
      └── categories.model_types[] / categories.recommended_model_ids[]
```

## 8. 分阶段重构计划

### 阶段 0：可恢复准备

1. 创建 `backup/2026-08-05-v2-audit/`。
2. 保存当前前端、数据、入口和 README 的完整副本。
3. 记录 backup 清单和校验结果。

### 阶段 1：数据 schema

1. 创建 `categories.json`。
2. 创建 `api.json` 并迁移 `api_endpoints.json`。
3. 补齐 Provider 和 Model 字段，未知值使用 `unknown`。
4. 为所有 JSON 增加字段级校验脚本。

### 阶段 2：数据迁移

1. 保留旧文件到 backup，不在工作树中创建第二套业务数据源。
2. 迁移 19 个当前模型，不把 unknown 转换成猜测值。
3. 增加模型分类、中文描述和官方链接。
4. 建立模型 ID、厂商 ID、价格记录、能力记录和 API 记录的外键校验。

### 阶段 3：前端数据绑定

1. 页面只通过 Registry Loader 获取模型信息。
2. 首页任务入口读取 `categories.json`。
3. 厂商页读取 Provider 和关联 Model。
4. 模型详情读取 Model + Pricing + Capabilities + API。
5. 推荐结果读取分类和能力数据，价格 unknown 时不进行价格排序。

### 阶段 4：UI 和交互

1. 首页优先展示任务选择，不展示默认模型列表。
2. 增加搜索、分类筛选、厂商筛选和模型详情。
3. 用中文定位、适用场景、价格状态和 API 参数替代英文占位。
4. 对 unknown 使用一致的“待核验”状态。

### 阶段 5：验证

1. JSON 解析和 schema 校验。
2. 外键完整性校验。
3. 页面静态检查，确保无硬编码模型名和价格。
4. 搜索、筛选、厂商导航、详情和推荐交互检查。
5. 更新 README 和数据更新流程。

## 9. 本阶段结论

本报告完成后，业务代码和数据未被修改。下一步应先执行阶段 0 创建 backup，再进入 schema 设计和数据迁移；不建议直接在当前工作树上覆盖重写。
