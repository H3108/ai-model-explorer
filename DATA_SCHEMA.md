# 数据层规范（Phase 1 交付）

> 本文件定义「AI 模型选择导航系统」的目标数据层。所有数据均为 **2026-08-05 联网核实**，未编造。

## 1. 信息架构（目标）

```
Provider（厂商）
  └─ Model Family（模型系列）
       └─ Model Variant（具体型号）
            ├─ Capability（能力：客观字段 + 三档定性 + 依据）
            ├─ Use Case（适用场景 = tasks）
            └─ Recommendation（推荐关系，带 score）
```

## 2. 文件清单

| 文件 | 角色 | 状态 |
|---|---|---|
| `data/providers.json` | 厂商（已 enriched：open_weight / logo / last_verified） | 已上线（app 兼容） |
| `data/model_families.json` | 模型系列（NEW，规范化） | Phase 2 接入 |
| `data/model_variants.json` | 具体型号（NEW，规范化，**权威数据源**） | Phase 2 接入 |
| `data/tasks.json` | 任务/场景（NEW，取代 categories.tasks） | Phase 2 接入 |
| `data/recommendations.json` | 推荐 TOP3 + score + reason（已重写） | Phase 4 接入 |
| `data/naming_guide.json` | 命名解释系统（NEW，取代 categories.name_suffixes） | Phase 6 接入 |
| `data/models.json` `pricing.json` `capabilities.json` `api.json` `categories.json` | 旧扁平数据（Codex 骨架，**LEGACY**） | 仍被 app.js 读取，Phase 2 重写后退役 |

## 3. model_variants.json 字段规范

**客观字段（用于硬筛选/排序，可量化）：**
- `context_window`（int，token 数）
- `max_output_tokens`（int）
- `input_price_per_mtok` / `output_price_per_mtok`（number，USD/CNY；未知则 `null`，**不编造**）
- `currency`（`USD` | `CNY`）
- `vision_support`（bool，客观）
- `open_weight`（bool，客观）
- `speed_tier`（`fastest` | `faster` | `fast` | `medium` | `slower` | `slow`）

**三档定性能力（每维带 `basis` 依据，不编精确分数）：**
- `capabilities.{reasoning,coding,agent,knowledge,multilingual}.tier` ∈
  `low` | `low-medium` | `medium` | `medium-high` | `high` | `highest`
- 每个维度必须附 `basis`（中文短句，说明评级依据/来源）。

**定位与关系：**
- `one_liner_cn`：一句话定位（详情页必需）。
- `model_type`：标签数组（Chat/Vision/Reasoning/Coding/Agent…），供旧筛选器兼容。
- `best_for` / `avoid_for`：引用 `tasks.json` 的 id。
- `source_url` + `verified` + `verified_date`：可追溯来源。

## 4. 验证方法（已执行）

- 12 个厂商逐一对官网/官方文档核实：OpenAI、Anthropic、Google、DeepSeek、Qwen、智谱 GLM、Kimi、百度文心、MiniMax、Mistral、xAI、Meta。
- 价格以**官方定价页**为准（platform.openai.com/docs/pricing、docs.anthropic.com、ai.google.dev、deepseek.ai、mistral.ai、docs.x.ai、qwen-ai.com、llmcostcalc/百度千帆等）。
- 用户原举例的 `GPT-5 Pro/Mini`、`DeepSeek V4` **经核实不存在**（属举例格式）：实际当前线为 **GPT-5.5 / 5.4（mini/nano/pro）**、**DeepSeek V3 / V3.2 / R1**。已采用官方真实型号。
- 部分二级聚合站在对比表中出现 `DeepSeek V4`、`GPT-5` 等名称，属非权威占位/口径不一致，**未采信**。
- 价格未知项（如 `qwen-vl-max` 视觉模型的确切 CNY 数值）保留 `null` 并注明，不臆造。

## 5. 已知缺口（下一阶段补）

- **视频生成模型**：当前数据集无视频生成型号（Grok Imagine、Nano Banana 视频等），`video` 任务推荐暂为空，待补充。
- **图像生成**：`rec-image` 现指向「图像理解/视觉」模型；图像**生成**模型将在命名/生成系统阶段补充。
- `models.json` 等 LEGACY 文件仍为 19 条旧数据，Phase 2 重写 `app.js` 后将以 `model_variants.json` 派生并退役。

## 6. 校验

- `scripts/validate_normalized.js`：检查 JSON 合法 + 外键一致性（variant→family→provider、recommendation→variant、best_for→task）+ 价格/能力字段完整性。**当前：0 错误 0 警告。**
