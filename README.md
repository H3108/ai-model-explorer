# AI Model Explorer V2

## Model Registry 数据层

本版本已增加规范化 Registry，不再由页面直接写死模型信息：

```text
data/
├── providers.json        # 厂商、地区、定位、开放权重、官方来源
├── model_families.json   # 模型系列（归属厂商）
├── model_variants.json   # 具体型号：客观字段 + 三档能力(含依据) + 适合/不适合
├── tasks.json            # 任务与偏好维度
├── recommendations.json  # 每个任务的 TOP N 推荐(带 score 与 reason)
└── naming_guide.json     # Mini/Pro/Flash/Nano/Reasoning/Vision... 命名解释
```

Registry 覆盖：OpenAI、Anthropic、Google、DeepSeek、Alibaba Qwen、Zhipu GLM、Moonshot Kimi、Baidu、MiniMax、Mistral、xAI、Meta Llama。

所有模型都拥有统一字段：Provider、Model Name、Model Family、Model Type、Reasoning、Coding、Vision、Audio、Context Length、Input Price、Output Price、Currency、API Base URL、API Compatible Format、Streaming、Function Calling、JSON Mode、Tool Calling、Recommended Usage、Avoid Usage。

### 数据真实性约束

数据均已联网核实（2026-08-05），厂商官方未公开或无法确认的值保留 `null`（不编造、不估算）。每个型号带 `source_url` 与 `verified_date`，页面会明确标注未知项，不会用未知价格得出“最便宜”之类结论。

AI Model Explorer 已从“模型展示库”升级为“AI 模型选择导航系统”：用户不需要先懂模型名称，只需要描述任务，即可获得带理由的模型推荐。

## 产品信息架构

```text
厂商
└── 模型系列
    └── 具体型号
        ├── 使用场景
        ├── 能力标签
        └── 同系列型号对比
任务选择器
└── 任务 + 预算 + 速度/质量偏好
    └── 推荐模型 TOP 3 + 推荐理由
```

## 项目结构

```text
├── index.html
├── styles.css
├── app.js
├── data/
│   └── Registry JSON files  # 厂商、系列、型号、任务、推荐、命名
├── scripts/validate_normalized.js
├── AI_Model_Explorer.md
└── README.md
```

## 已完成重构

- 首页不再平铺模型卡片，改为“任务选择”和“浏览厂商”两个核心入口。
- 厂商地图：支持美国、中国、开源生态分类，展示厂商定位和模型系列。
- 三层导航：厂商 → 模型族 → 具体型号；详情页继续展示能力、价格、API 参数和推荐用途。
- 推荐系统：最强模型、性价比模型、最便宜模型、Agent 模型、Coding 模型；价格未知时不输出虚假最低价。
- 模型详情：发布时间、模型类型、一句话定位、七类能力标签、适合任务星级、不适合任务、同系列型号对比。
- 模型名称解释：Mini、Pro、Flash、Reasoning、Vision。
- 绿色极简卡片风格和移动端适配均已保留。

## 启动方法

项目是零依赖纯静态前端。由于页面通过 `fetch` 加载 JSON，建议使用本地静态服务器：

```bash
# 在仓库根目录下执行：
cd <REPO_ROOT>
python3 -m http.server 8000
```

打开 <http://localhost:8000>。

也可以使用：

```bash
npx serve .
```

不需要数据库、后端服务或构建步骤，也没有自动爬虫。

## 数据维护与 V2 Agent 接口

当前 `app.js` 通过 `loadData()` 并发加载 6 份规范化 JSON，推荐逻辑集中在 `renderRecommendation()`。后续接入 Agent 时可以：

1. 保留规范化 JSON 作为静态兜底数据。
2. 将 `loadData()` 替换为统一数据适配器。
3. 将 `renderRecommendation()` 替换为 Agent 的自然语言意图识别和多目标排序接口。
4. 让 `recommendations.json` 保存可解释的推荐规则、来源和更新时间。

运行 Registry 校验：

```bash
node scripts/validate_normalized.js
```

## 后续优化建议

- 继续扩充更多厂商、系列和具体型号，并增加官方来源链接、价格更新时间。
- 可进一步升级为独立页面路径（如 `/models/:id`），当前已实现 `#model/:id` hash 深链独立详情页，并保留零依赖。
- 加入模型横向对比表，支持最多 3 个型号同时比较性能、速度、价格和部署方式。
- 增加用户预算、地区、数据隐私、延迟和部署方式等更多推荐维度。
- 增加 JavaScript、curl、Python 多语言 API 示例。
- 未来可增加 localStorage 收藏和最近浏览，不需要数据库。

## 项目定位

本项目不是排行榜、专业 Benchmark 系统或自动爬虫平台，而是面向新用户的 AI 模型知识地图和选择助手。模型能力、价格和可用性会变化，生产使用前请核对厂商官方文档。
