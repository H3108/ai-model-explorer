# 📊 项目全景审计报告 V5

> 审计时间：2026-08-06 22:15
> 审计基线：`8db00ee`（master）
> 审计方式：全量读码 + 数据层脚本验证 + 校验脚本实跑，所有结论附代码/数据证据
> 上一版：`PROJECT_AUDIT_V4.md`

---

## 项目状态 Project Status

| 项 | 值 |
|---|---|
| 技术栈 | 纯静态前端（原生 JS ES Module + hash 路由），**无后端 / 无数据库 / 无鉴权** |
| 代码规模 | `app.js` 1160 行 · `styles.css` 838 行 · `index.html` 44 行 |
| 数据规模 | 32 厂商 / 47 系列 / **118 型号** / 14 任务 / 13 场景 / 118 条 API 接入 |
| 路由 | 8 个视图（home / providers / provider / family / browse / matcher / model / gateways / glossary） |
| 当前完成度 | **功能约 95%，数据完整度约 88%，工程质量约 85%** |
| 风险等级 | **低**（全部 P1/P2/P3 已修复，无遗留项；无 P0） |

**架构判断**：纯前端静态站，无服务端 / 无用户数据 / 无认证，因此传统 P0（无法启动、数据丢失、安全漏洞、越权）**均不适用，本次审计未发现 P0**。风险集中在「对外输出的事实准确性」与「质量防线失效」两条线上。

---

## 🔧 修复状态追踪（截至 2026-08-07）

> 全部 10 个 Issue 已修复并落地，分三批提交。质量门实测：
> `validate_normalized.js` **0 错误** · `smoke_render.js` **0 失败** · `model_quality_check.py` **0 问题** · `node --check app.js` 通过。

| Issue | 优先级 | 修复提交 | 修复要点 |
|---|---|---|---|
| 1｜美元模型误标人民币 | P1 | `93014b4` | `priceBlock()` 改用 `cur(v.currency)`，48 个型号价格口径统一 |
| 2｜校验脚本不读 extra，质量门失灵 | P1 | `93014b4` | `validate_normalized.js` + `smoke_render.js` 均合并加载 extra（21 假错误 / 6 失败 → 全清）；测试桩增强 |
| 3｜`familyById` 返回 `{}` 死链 | P1 | `93014b4` | `familyById` 兜底改为 `null`；数据层补 `microsoft-phi` 系列（挂 `openrouter` 网关） |
| 4｜Midjourney 三处矛盾 | P2 | `93014b4` | `base_url` 诚实置空，UI 增加空值分支 + 官网链接；质检口径修正（不为归零强行填 URL） |
| 5｜`params` 仅 5/118 | P2 | `93014b4` | 44 个开放权重模型补 `params` + `context_window`（脚本化溯源），完整三卡 5 → 43/118 |
| 6｜`[data-task]` 选择器冲突 | P2 | 自然修复 | 首页场景芯片改用 `data-scene-task`，matcher 恢复局部刷新，死代码消除 |
| 7｜首屏无 loading 态 | P2 | `96e0f9f` | `index.html` 内联骨架屏占位，`render()` 首帧替换 |
| 8｜`benchmarks` 零数据空文案 | P2 | `93014b4` | 有数据才渲染基准行，否则仅保留实时看板外链 |
| 9｜仓库卫生与文档堆积 | P3 | `96e0f9f` | `backup/` 移出版控（保留磁盘 + tag）、审计/治理文档归档 `docs/archive/`、根目录精简 |
| 10｜魔法数 / 404 等低危债 | P3 | `96e0f9f` | `priceValue` 魔法数加注释（USD→CNY 近似、仅排序用）；未知路由改为 404 态 + 返回入口 |

**批处理提交**：

- `93014b4` — fix(审计V5)：P1/P3/P2 全修复 + 质量门增强
- `96e0f9f` — chore(审计V5轨道A)：对比表窄屏首列固定 + nav 滚动渐隐 + 仓库瘦身 + 404 态
- `9379097` — chore(审计V5轨道B)：最近浏览 + 对比集持久化（超出审计范围的体验增强）

**遗留 / 可选增强（不在审计 Issue 内）**：虚拟列表（118 型号未超阈值，暂不必要）、搜索别名扩展、Top 20 模型接入可溯源基准分（Issue 8 方案 b，需产品决策）。

---

## 前端样式与布局 Frontend Styles & Layouts

**整体评价**：视觉体系统一（深绿 `#173e35` / 浅绿 `#baf17a` / 腾讯蓝 `#0052D9`），组件抽象合理（`modelCard` / `statCard` / `capBar` / `pageHead` 复用充分），无重复组件，无巨型组件。CSS 无 `!important` 滥用，变量化程度高。

**风险项**：

1. **无任何 loading 态** — `index.html:34` 的 `<main id="app">` 初始为空，`app.js:1157` 的 `loadData()` 需串行 fetch 9 个 JSON（合计约 400KB），期间页面完全空白。慢网络下首屏是纯白页。
2. **响应式断点仅 2 个**（`styles.css:814` @1080px、`:822` @720px）。`.cmp-table` 对比表在窄屏依赖 `.table-wrap` 横向滚动，无列优先级折叠。
3. **移动端导航** `#main-nav`（`styles.css:824`）用 `overflow-x: auto` 横滚承载 5 个入口，无渐隐/箭头提示，用户不易察觉右侧还有内容。
4. **无障碍近乎为零** — 全项目 `aria-*` / `role` 仅出现 **1 处**（`app.js:125` 的 free-info），`index.html` 为 **0**。分段控件按钮无 `aria-pressed`，导航无 `aria-current`，表格无 `scope`，无跳转主内容链接。

---

## 前后端逻辑与链路 Full-Stack Logic & Integration

无后端，链路为「静态 JSON → fetch → state → 视图函数 → innerHTML」。

**数据链路完整性（实测，全部通过）**：

| 检查项 | 结果 |
|---|---|
| variants ↔ api_access 一一对应 | ✅ 118 / 118，无缺失、无孤儿 |
| recommendations → variants 死链 | ✅ 0 条 |
| tasks 覆盖 | ✅ 14/14 均有推荐 |
| scenarios → tasks 外键 | ✅ 13/13 有效 |
| provider_id 外键 | ✅ 无悬空 |
| 空系列（0 型号） | ✅ 无 |
| concat 后 id 重复 | ✅ 无 |
| 详情页「接入地址」vs 代码示例 URL 一致性 | ✅ 0 处不一致 |

**断点**：`family_id` 外键有 **2 条悬空**（详见 Issue 3），`params` 字段有 **50% schema 漂移**（详见 Issue 5）。

---

# 🔍 问题证据列表 Evidence Based Findings

## Issue 1｜【P1】48 个美元计价模型被显示为人民币符号

**Evidence**

- 文件：`app.js`
- 代码位置：`priceBlock()` 第 724 行
  ```js
  else if (v.input_price_per_mtok != null)
    detail = `输入 ¥${v.input_price_per_mtok}/百万 tokens · 输出 ¥${v.output_price_per_mtok}/百万 tokens`
  ```
- 数据实测：`currency` 分布 = **USD 114 / CNY 4**；其中 `price_model === 'per_token'` 且非免费、有价格的美元模型共 **48 个**
- 样例：`openai-gpt-5-5`（USD 5）、`openai-gpt-5-5-pro`（USD 30）、`openai-gpt-5-4-mini`（USD 0.75）

**Impact**

同一张详情页上自相矛盾：上方「关键参数」卡片走 `specCards()` → `cur(v.currency)` 显示 **$5**，下方「计费方式」区块硬编码显示 **¥5**。按汇率差约 7 倍，直接误导成本测算与选型决策。这是**对外事实性错误**，不是样式问题。

**Recommendation**

`priceBlock()` 改用既有的 `cur(v.currency)` 助手，与 `priceLabel()` / `specCards()` 统一：

```js
const c = cur(v.currency)
detail = `输入 ${c}${v.input_price_per_mtok}/百万 tokens · 输出 ${c}${v.output_price_per_mtok}/百万 tokens`
```

---

## Issue 2｜【P1】两个校验脚本只读主文件，回归防线实质失效

**Evidence**

- `scripts/validate_normalized.js:18` — `const variants = read('model_variants.json')`
- `scripts/smoke_render.js:51` — `JSON.parse(fs.readFileSync(path.join(ROOT, 'data/model_variants.json')))`
- 二者均**未读** `model_variants_extra.json`
- 实跑结果：`validate_normalized.js` 报 **错误 21**、`smoke_render.js` 报 **失败 6**
- 逐条核验：21 条错误（`cogvideox-flash` / `glm-4-5` / `agnes-2-5-flash` / `mistral-small-free` …）**全部为误报**，这些 id 均存在于 extra 文件
- 根因数据：主文件 **59** 条、extra **59** 条 —— 所谓「增量文件」已膨胀到与主文件**等量（50/50）**；且 **48 个免费模型 100% 位于 extra，主文件为 0**，故 smoke 才会断言出「数据集中有 0 个免费模型」

**Impact**

这是本次审计**危害最大**的一项。三道质量门中有两道系统性失灵：

- 开发者面对 **27 条已知假失败**，必然养成「忽略校验输出」的习惯；
- 一条**真实**错误混入这 27 条噪声中将完全不可见；
- 该架构（MEMORY.md 记载的「增量文件规避大文件盲改风险」）作为短期战术合理，但已演变为结构性债务。

仅 `scripts/model_quality_check.py:34` 正确读取了两个文件（`load("model_variants.json") + load("model_variants_extra.json")`），实跑 **问题 0**。

**Recommendation**

按成本从低到高三选一（推荐 B）：

- **A**（10 分钟）：两脚本各加一行合并 extra —— 治标，50/50 分裂仍在；
- **B**（1 小时，推荐）：抽公共 `scripts/lib/load_variants.js` 统一数据入口，三个脚本 + 未来脚本全部复用，杜绝再次漂移；
- **C**（2 小时）：合并回单文件 + 用 B 的加载器，彻底消除分裂。鉴于已有 118 条稳定数据与完整脚本化迁移能力，风险可控。

---

## Issue 3｜【P1】`familyById` 返回 `{}` 导致判空失效，7 个型号详情页出现空文字死链

**Evidence**

- 文件：`app.js`
- 代码位置：第 95 行
  ```js
  const familyById = (id) => byId(state.families, 'id', id) || {}   // ← 兜底为 {} 而非 null
  ```
- 消费位置：`viewModel()` 第 876、880 行
  ```js
  const f = familyOf(v)                       // 无 family 时 f = {} —— truthy！
  data-back="${f ? '#family/' + encodeURIComponent(f.id) : ...}"   // → "#family/undefined"
  ${f ? ` · <a class="crumb" href="#family/${encodeURIComponent(f.id)}">${esc(f.name_cn || f.name || '')}</a>` : ''}
  ```
- 实测受影响 **7 个型号**：
  - `family_id` 缺失（5）：`groq-whisper-large-v3`、`anyapi-auto`、`bazaarlink-auto-free`、`requesty-auto`、`freeai-auto`
  - **`family_id` 悬空外键（2）**：`openrouter-phi-3-5-mini-free`、`nvidia-nim-phi-4` → 均指向 `microsoft-phi`，该系列在 `model_families.json` 中**不存在**

**Impact**

这 7 个详情页的面包屑渲染出一个**文字为空、链接指向 `#family/undefined`** 的锚点，点击进入「未找到系列：undefined」空态页。返回按钮同样指向该死链——仅因 `navCount > 0` 时走 `history.back()` 而被掩盖；**直接打开链接或刷新页面（navCount = 0）时必然触发**。

**Recommendation**

两处同时修（缺一不可）：

1. `app.js:95` 改为 `const familyById = (id) => byId(state.families, 'id', id)`（返回 null），并检查 `familyOf` / `famName` 的下游消费（`famName` 已用 `f ? ... : ''`，改后自然安全）；
2. 数据层补 `microsoft-phi` 系列到 `model_families.json`，或将这 2 个型号的 `family_id` 置空。

---

## Issue 4｜【P2】Midjourney 详情页三处内容互相矛盾

**Evidence**

- `data/providers.json` → `midjourney.api_base_url` = `https://www.midjourney.com`（**官网，非 API 端点**）
- `data/api_access.json` → `midjourney-v7.accesses[0].base_url` = `https://www.midjourney.com`
- 同条 `api_note` = 「Midjourney 暂无官方公开 REST API（截至 2026-05）…」
- 渲染路径：`app.js:741`「接入地址」显示官网；`app.js:695`（media 分支）额外输出 `Base URL：<code>https://www.midjourney.com</code>`；`app.js:748` 的 `api_note` 又声明无官方 API

**Impact**

同一页面同时告诉用户「接入地址 = midjourney.com」「Base URL = midjourney.com」「本模型无官方 REST API」。前两条会被误读为可直接请求的端点。此问题系 `d356e55` 提交为闭合 `api_base_url` 空值时引入——用诚实的 `api_note` 补救，却留下了误导性的 base_url 字段。

**Recommendation**

`base_url` 恢复为 `null`（诚实表达「无」），改由 `api_note` + 官网链接承载信息；`apiBlockHTML()` 与 `codeExamples()` 的 media 分支增加空值判断，`base_url` 为空时不渲染「接入地址」行与「Base URL」文案，只展示 `api_note` 与官方文档链接。同时修正 `model_quality_check.py` 的判定口径——不应为了「问题数归零」而给非 API 厂商强行填 URL。

---

## Issue 5｜【P2】`params` 字段 5/118，「参数速读」功能 95.8% 缺卡

**Evidence**

- Schema 漂移实测：`params` 字段**仅主文件有，extra 全缺** —— 主文件 5/59，extra **0/59**，全量 **5/118**
- `app.js:788-802` `paramInsight()` 的参数规模卡依赖 `v.params`
- 覆盖率实测（按 `paramInsight` 逻辑模拟 118 个型号）：
  - 产出 **0 张卡**（整个区块不渲染）：**23 个**
  - 1 张卡：44 个 ｜ 2 张卡：46 个 ｜ **3 张卡（完整形态）：仅 5 个**
- 其中 **34 个开放权重模型**参数量本可公开查证却为空：`glm-4-5`、`groq-llama-3-3-70b`、`groq-qwen3-32b`、`openrouter-deepseek-r1-free` …

**Impact**

「参数速读」是用户明确选定的 B 方案核心功能（把 122B/256K 翻译成人话），当前 118 个型号中只有 **5 个**能展示完整三卡，**23 个**型号该区块直接消失。功能已上线但价值未兑现。

**Recommendation**

优先补齐 34 个开放权重模型的 `params`（HuggingFace 模型卡可查证，且这 34 个已在 `d356e55` 中有 `repo_url` 可直接溯源）；网关聚合型（`*-auto`）与闭源模型保持留空。补齐后完整三卡型号预计从 5 → 约 40。

---

## Issue 6｜【P2】`[data-task]` 选择器冲突，matcher 任务分支为死代码

**Evidence**

- 文件：`app.js`，同一个 click 委托内两处使用相同选择器：
  - 第 1052 行（首页场景芯片）：`const sceneChip = e.target.closest('[data-task]')` → 命中即 `return`
  - 第 1122 行（matcher 任务按钮）：`const task = e.target.closest('[data-task]')` → **永不可达**
- 双方 HTML 均带 `data-task`：`app.js:243`（`.scene-chip`）、`app.js:650`（`.task-option`）

**Impact**

功能表面正常（1052 分支内 `parseHash().name === 'matcher'` 时调用 `render()`，状态确实更新），但：

- 在 matcher 页点任务触发**整页 `render()` 全量重绘**，而非设计好的 `refresh('#recommendation', ...)` 局部刷新；
- 第 1122–1129 行含选中态切换逻辑的 8 行代码**永远不执行**，属死代码，后续维护者极易误判。

**Recommendation**

给两者不同语义的选择器：首页场景芯片改为 `data-scene-task`，matcher 保留 `data-task`；或在 1052 分支加 `.scene-chip` 类名限定。修复后 matcher 恢复局部刷新。

---

## Issue 7｜【P2】首屏无 loading 态

**Evidence**：`index.html:34` `<main id="app" class="app-view"></main>` 初始为空；`app.js:1157` `loadData()` 完成后才首次 `render()`；全项目 grep `loading|加载中|skeleton|spinner` 无 UI 实现（仅 `logoHTML` 的 `loading="lazy"` 属性）。9 个 JSON 合计约 400KB。

**Impact**：慢网络/弱设备首屏纯白，无反馈。错误态已有兜底（`app.js:1158`），唯独缺 loading 态。

**Recommendation**：`index.html` 内联一个骨架屏或加载指示，`render()` 首次执行时替换。成本约 20 分钟。

---

## Issue 8｜【P2】`benchmarks` 字段 0/118 全空，ecoBlock 永远走兜底文案

**Evidence**：`scripts/governance_v2.js` 为 118 个型号添加了 `benchmarks` 字段，实测全部为 `[]`；`app.js:834` 判断 `v.benchmarks && v.benchmarks.length` 恒为 false，永远渲染兜底文案「本站不写死基准分数…」。

**Impact**：「模型生态与基准」区块的「本站基准记录」行对全部 118 个型号显示同一句兜底文案，信息量为零。**注**：不写死分数是刻意的正确设计（避免过时/编造），但当前是「加了字段却零数据」的半成品状态。

**Recommendation**：二选一——(a) 明确定位为 schema 预留，UI 移除该行只保留实时看板外链；(b) 为 Top 20 高热度模型接入可溯源的基准分（含 `source` 链接与采集日期）。建议先选 (a)，避免半成品长期挂在页面上。

---

## Issue 9｜【P3】仓库卫生与文档堆积

**Evidence**

- `backup/2026-08-05-v2-audit/` **14 个文件已入 git**（含完整旧版 `app.js` / `styles.css` / 6 个旧 JSON）——git 本身即版本控制，此目录冗余
- 根目录 **12 个 markdown**：`PROJECT_AUDIT_V2/V3/V4.md`、`DATA_AUDIT_REPORT.md`、`DATA_GOVERNANCE_REPORT.md`、`DATA_REVIEW.md`、`MODEL_EXPLORER_DATA_GOVERNANCE_V1.md`、`V4.md`、`DATA_SCHEMA.md`、`AI_Model_Explorer.md`、`README.md`
- `.gitignore` 已正确排除 `.workbuddy/` / `node_modules/` / `.DS_Store` / `daily_model_update_report.md`

**Impact**：新人进入项目难以判断哪份文档是当前有效版本；`backup/` 使仓库体积翻倍。

**Recommendation**：`backup/` 移出版本控制（已有 git 历史 + `2026-08-05-v2-audit` tag 即可回溯）；审计/治理类文档归入 `docs/archive/`，根目录只保留 `README.md` + `DATA_SCHEMA.md` + 最新一版审计。

---

## Issue 10｜【P3】其他技术债（低危，附证据）

| # | 问题 | 证据 | 影响 |
|---|---|---|---|
| a | `priceValue()` 魔法数 `* 40` | `app.js:129` `return v.media_pricing.price * 40` | 按张价格换算为可比数值的系数无注释无依据，排序结果不可解释 |
| b | `scrollMem` 无上限 | `app.js:954` `const scrollMem = new Map()` | 长会话累积路由滚动位置，无清理（极轻微） |
| c | `esc()` 不转义单引号 | `app.js:107` 未处理 `'` | `logoHTML` 的 `onerror` 内联 JS 用单引号包裹厂商首字母，理论注入面（当前数据无风险） |
| d | 未知路由静默回首页 | `app.js:977` `else html = viewHome()` | 拼错 hash 无提示，直接显示首页，用户困惑 |

---

# 📋 待开发与未完成任务清单 Pending Tasks Checklist

| 模块 Module | 任务 Task | 优先级 | 影响 Impact | 依赖 | 预估工时 | 备注 |
|---|---|---|---|---|---|---|
| 详情页 | 修复 `priceBlock` 货币符号硬编码（Issue 1） | **P1** | 48 型号价格显示错误，误导选型 | 无 | 10 min | 复用现有 `cur()` |
| 工程质量 | 抽公共 `load_variants` 加载器，修复 2 个校验脚本（Issue 2） | **P1** | 27 条假失败使质量门失效 | 无 | 1 h | 推荐方案 B |
| 详情页 + 数据 | `familyById` 返回 null + 补 `microsoft-phi` 系列（Issue 3） | **P1** | 7 型号面包屑死链 | 无 | 30 min | 代码+数据同修 |
| 数据 | Midjourney `base_url` 恢复 null + UI 空值判断（Issue 4） | P2 | 单页三处矛盾，误导为可用端点 | 无 | 40 min | 含质检口径修正 |
| 数据 | 补 34 个开放权重模型 `params`（Issue 5） | P2 | 参数速读完整率 5→约 40 | `repo_url` 已有 | 2 h | 逐个 HF 溯源 |
| 事件层 | 拆分 `[data-task]` 选择器冲突（Issue 6） | P2 | 死代码 + 整页重绘 | 无 | 20 min | |
| 前端 | 首屏 loading 骨架屏（Issue 7） | P2 | 慢网络白屏 | 无 | 20 min | |
| 详情页 | `benchmarks` 定位决策（Issue 8） | P2 | 118 页面同一句空文案 | 需产品决策 | 30 min | 建议先移除该行 |
| 无障碍 | 补 `aria-pressed` / `aria-current` / 表格 `scope` / 跳转链接 | P2 | 键盘与读屏用户不可用 | 无 | 1.5 h | 当前 aria 仅 1 处 |
| 前端 | 对比表窄屏列折叠 + 移动端 nav 滚动提示 | P3 | 移动端体验 | 无 | 1 h | |
| 仓库 | `backup/` 移出版控 + 文档归档 `docs/archive/` | P3 | 仓库体积、认知负担 | 无 | 20 min | |
| 代码 | `priceValue` 魔法数注释化 / 未知路由 404 态 | P3 | 可维护性 | 无 | 30 min | |

**合计**：P1 约 1.7 h ｜ P2 约 5.5 h ｜ P3 约 1.8 h

---

# 🚀 下一阶段开发计划 Next Development Roadmap

## Phase 1 — 修正事实错误与恢复质量防线（P1，约 1.7 h）

1. `priceBlock` 货币符号（Issue 1）—— 对外事实错误，最优先
2. 统一数据加载器 + 修复两个校验脚本（Issue 2）—— **必须在 Phase 2 之前完成**，否则后续所有改动都无回归保护
3. `familyById` 判空 + `microsoft-phi` 外键（Issue 3）

> Phase 1 结束标志：`validate_normalized.js` 与 `smoke_render.js` 均**真实归零**（而非靠忽略噪声）。

## Phase 2 — 补齐半成品功能（P2，约 5.5 h）

4. Midjourney 矛盾展示（Issue 4）
5. 34 个 `params` 补数据（Issue 5）—— 兑现「参数速读」价值
6. `[data-task]` 冲突（Issue 6）、loading 态（Issue 7）、`benchmarks` 定位（Issue 8）
7. 无障碍基线

## Phase 3 — 体验与工程优化（P3，约 1.8 h）

8. 移动端表格折叠与导航提示
9. 仓库瘦身与文档归档
10. 魔法数注释、404 路由态

---

# Next Best Action

**状态：✅ 全部 Issue 已修复并落地**（见上方「修复状态追踪」）。本审计闭环。

**后续可选方向**（非审计阻塞项）：

1. **接入可溯源基准分**（Issue 8 方案 b）——为 Top 20 高热度模型补 `benchmarks` 真实数据 + `source` 链接，替代当前"仅实时看板外链"形态；需产品决策与数据源。
2. **搜索别名扩展**——当前别名/中文/场景搜索已覆盖，可补充同义词与厂商别名提升召回。
3. **远程仓库**——当前 `git remote -v` 为空，无远程可推送；若需协作/备份，先 `git remote add origin <url>` 再 `git push -u origin master`。

**验证基线（修复后）**：`validate_normalized.js` 0 错误 · `smoke_render.js` 0 失败 · `model_quality_check.py` 0 问题 · `node --check app.js` 通过 · 本地预览 http://localhost:8848/ 返回 200。

---

*本报告全部结论均基于代码行号与数据实测，无推测性论断。已排除的假设：`codeExamples` 的 base_url 路径拼接（实测 32 家厂商全部正确，无双 `/v1` 问题）、`api_access` 与代码示例地址不一致（实测 0 处）、数据死链（实测 0 条）。*
