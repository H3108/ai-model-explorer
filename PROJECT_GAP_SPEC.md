# AI_Model_Explorer.md 功能缺口核对

> 日期：2026-08-05
> 方法：逐条比对 `AI_Model_Explorer.md`（原始 V1.0 spec）与当前代码（`app.js` / `index.html` / `styles.css`）、数据（`data/*.json`）、校验器（`scripts/validate_normalized.js`）。
> 原则：只核对 spec 列出的功能，不引入 spec 之外的内容（视频/图像生成、命名解释等属于「交接任务」扩展项，不在本核对范围内）。

---

## 一、已完整实现（spec 要求已满足）

| Spec 章节 | 要求 | 实现位置 |
|---|---|---|
| 3.1 模型知识库 | 全球主流厂商 + 50–100 模型 | 21 厂商 / 59 型号（`data/providers.json` + `model_variants.json`）✅ 超额 |
| 3.2 基础信息 | 名称/厂商/国家/发布时间/开源闭源/类型 | 详情页 `modelCoreHTML`（`app.js:162`）含 Model ID、类型、`release_date`、`open_weight`、`provider.country` ✅ |
| 3.2 使用建议 | 适合 / 不适合 | 详情页 `best_for` / `avoid_for` 列表 ✅ |
| 4/5/8 架构与限制 | JSON 数据、无框架、不实现用户系统/数据库/爬虫/聊天/代理/评测 | 全部符合 ✅ |
| 3.4 场景推荐（部分） | 写代码/开发Agent/低成本API/本地部署 | `tasks.json` 已含 `coding`/`agent`/`low_cost`/`local` ✅ |

---

## 二、未实现 / 缺口（严格按 spec 列出）

### P0 — spec 明确「每个模型必须包含」，当前缺失

| Spec | 要求 | 现状（证据） | 缺口 |
|---|---|---|---|
| **3.3 API 调用信息** | **Base URL**（如 `https://api.openai.com/v1`） | `model_variants.json` 无 `base_url`（grep 命中 0）；`providers.json` 仅有 `api_docs`，无 `base_url` | 缺 Base URL 字段与展示 |
| **3.3 API 调用信息** | **示例代码**：Python / JavaScript / curl | `app.js:162` `modelCoreHTML` 无代码块；`index.html` 详情区无代码容器；grep `search/sort` 等无相关内容 | **完全未做**：每个模型详情页没有可调用的 API 示例代码 |
| **3.2 参数信息** | **参数规模**（如果公开） | `model_variants.json` 无 `params` 字段；校验器未要求 | 缺参数规模字段与展示（可选，公开才填） |

### P1 — spec 页面设计明确要求，当前缺失

| Spec | 要求 | 现状（证据） | 缺口 |
|---|---|---|---|
| **3.4 场景推荐** | 选项需含 **写文章 / 学习AI / 企业应用** | `tasks.json` 现有 11 项：缺 `写文章`、`学习AI`、`企业应用`（仅有 chat/knowledge 近似覆盖，但 spec 列名不符） | 缺 3 个场景选项及其推荐映射 |
| **7. 首页** | **搜索** | `index.html` 无 search 输入；`app.js` 无搜索处理（grep `search` 命中 0） | 首页缺搜索框 |
| **7. 首页** | **热门模型** | `index.html #home` 仅 hero + 统计数字，无热门模型区块 | 首页缺「热门模型」展示 |
| **7. 模型列表** | **搜索 + 排序** | `app.js:108` `renderProviders` 仅有 `filter`（全部/美国/中国/开源），无搜索输入、无排序控件 | 列表缺搜索与排序 |

### P2 — spec 能力标签未按指定清单呈现

| Spec | 要求 | 现状 | 缺口 |
|---|---|---|---|
| **3.2 能力标签** | 标签清单：Coding / Reasoning / Agent / **Long Context / Multimodal / Chinese / Low Cost** | 详情页 `cap-grid` 仅展示 `reasoning/coding/agent/knowledge/multilingual` 五维定性；`Long Context / Multimodal / Chinese / Low Cost` 未作为标签呈现 | 卡片/详情未以 spec 指定标签集合展示（可由 `context_window`/`vision_support`/`open_weight`/价格推导，但当前未做） |

---

## 三、不做（spec 第 8 节明确禁止）

用户系统、数据库、自动爬虫、在线聊天、API 代理、自动评测 —— 均不实现。

---

## 四、建议实施计划（Phase 5：补齐 spec 缺口，不新增 spec 外内容）

**数据层**
1. `data/model_variants.json`：新增可选 `base_url`（或提升到 provider 级 `api_base_url`）+ `params`（参数规模，公开才填）。
2. `data/tasks.json`：补齐 `写文章` / `学习AI` / `企业应用` 三个任务及其 `prefer` 规则。
3. `data/recommendations.json`：为新增 3 个任务补真实 TOP3 推荐（复用现有评分机制）。

**渲染层（app.js）**
4. `modelCoreHTML` 内新增「API 调用」区块：`Base URL` + `Model ID` + **三段可复制示例代码**（Python / JavaScript / curl，按 provider 的 base_url 与 model_id 模板生成）。
5. 首页 `#home` 新增**搜索框**（按名称/厂商/类型实时过滤跳转）+ **热门模型**区块（取评分最高或旗舰型号若干）。
6. 模型列表 `renderProviders` 增加**搜索输入**与**排序控件**（按价格/上下文/速度）。

**样式层（styles.css）**
7. 复用现有绿色系，新增 `code-block` / `hot-grid` / `search-bar` / `sort-bar` 等少量组件类；新增 P2 能力标签 `cap-tag` 渲染。

**校验（scripts/validate_normalized.js）**
8. 将 `base_url`、`params` 设为可选校验；为新增 3 个任务的推荐做外键校验。

---

## 五、核对结论

- 原始 spec 的**硬性缺口集中在「API 调用信息（Base URL + 示例代码）」「参数规模」「3 个场景选项」「首页搜索/热门」「列表搜索/排序」**。
- 之前已做的视频/图像生成、命名解释属于「交接任务」扩展项，与原始 spec 无冲突，可保留或在后续阶段处理。
- 当前服务器（端口 8848）运行正常，补齐后直接刷新即可生效。
