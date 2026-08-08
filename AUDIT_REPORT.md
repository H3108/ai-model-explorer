# AI Model Explorer · 前端审计报告

**审计日期**：2026-08-08
**审计范围**：全站静态 SPA（index.html + styles.css + src/ ESM 模块 + data/*.json），本地 http://localhost:8848
**审计方法**：代码走查 + 三维度并行深度审查（响应式/CSS、交互/a11y、功能/运行时）+ 关键项实测复现
**代码改动**：本次仅审计，未修改任何文件

---

## 一、总体健康度

| 维度 | 评级 | 一句话结论 |
|------|------|-----------|
| 功能 / 数据 | **B（良好）** | 数据层最扎实——140 条推荐引用零断裂、5 张表外键全通、smoke 守卫无漂移；但**异常路径无人兜底**（1 个 P0 崩溃） |
| 交互 / 可访问性 | **中等偏上** | `:focus-visible` 焦点环、`prefers-reduced-motion` 降级、skip-link、空态文案都已到位；但**全站只有 click 委托无 keydown**（1 个 P0 致命短板） |
| 响应式 / CSS | **有风险** | Token 定义相当规范，但**消费端几乎没落地**（圆角/字号/间距基本裸值）；存在 **3 个确定性布局破坏点**，且被 `overflow-x:hidden` 掩盖 |

**综合结论：中上水平，但存在 5 个 P0 必须修。**
其中 2 个是运行时崩溃（畸形 URL、脏枚举数据），3 个是移动端布局破坏（CSS 覆盖顺序倒置、网格最小轨道溢出、表格行不可键盘操作）。这些缺陷在桌面端表现正常、日常自测难暴露，但会在**真实异常输入 / 移动端 / 键盘用户**场景下爆发。

---

## 二、P0 必修清单（5 项 · 崩溃 / 布局破坏）

| # | 问题 | 证据（文件:行） | 影响 | 修复建议 |
|---|------|----------------|------|---------|
| **P0-1** | 非法 hash 触发 `URIError`，路由卡死 | `src/router.js:22` `decodeURIComponent` 裸调用；`render()` 26-56 全无 try/catch | `#model/%%%` 冷启动误报"数据加载失败"；运行中切非法 hash → 页面卡在上一路由内容不动 | `parseHash` 用 `try{decodeURIComponent(x)}catch{return x}`；`render()` 套 try/catch（约 5 行） |
| **P0-2** | `TIER[c.tier]` 空指针，浏览页静默崩溃 | `src/views.js:354` `const t = TIER[c.tier]` 无 `‖ {}`；`hunyuan-t1-latest` 推理 `tier="very-high"` 不在枚举（`constants.js:4-11`）| 勾选"推理"筛选 + 搜 hunyuan → `TypeError` 被 input 监听器吞掉，结果区残留旧 116 条，用户以为"筛选没反应" | `const t = TIER[c.tier] ‖ {label:c.tier, lv:'mid'}`；同步把 `very-high` 归一 |
| **P0-3** | 移动端 `.wrap` 覆盖 `.page`，全站上下内边距归零 | `styles.css:1067` `.page{padding:26px 18px 60px}` 被 `:1068` `.wrap{padding:0 18px}`（同特异性、媒体查询内写在后）覆盖 | ≤720px 全部页面正文顶到 sticky 顶栏、贴死 footer，上下间距全丢 | `.page` 改用 `padding-block` 与 `.wrap` 的 `padding-inline` 分离，或调整规则顺序 |
| **P0-4** | 移动端表格整行 `data-goto` 无键盘可达 | `src/views.js:288`/`:563` `<tr data-goto="#model/...">`；`router.js` 全库无 `keydown` 监听 | 键盘 / Tab 用户完全无法进入模型 / 系列详情页 | 首列模型名改为真 `<a href="#model/...">`（浏览表 `:382` 已是正确范式，照搬） |
| **P0-5** | 320px 网格最小轨道 > 容器，内容被永久裁切 | `styles.css:467` `.provider-grid` minmax(320px)、`:531` `.family-grid` 300px、`:901` `.cap-bars` 280px；容器实宽=320−36=284px | 320px 下卡片右缘、`.pc-foot` 右侧文字丢失（被 `overflow-x:hidden` 裁掉且无法滚动到）| 统一改 `minmax(min(280px,100%),1fr)` |

---

## 三、P1 重要修复（10 项）

| # | 问题 | 证据 | 影响 | 修复建议 |
|---|------|------|------|---------|
| P1-1 | 顶栏 721–900px 死区 | `styles.css:155-186` 顶栏无 flex-wrap，导航 nowrap+flex:none；移动兜底只在 ≤720px（`:1056-1066`）| **768px iPad 竖屏**导航 + version-pill 被裁切，"模型对比"入口不可达 | 顶栏折行 / 横滚断点从 720px 提到 960px |
| P1-2 | `overflow-x:hidden` 是遮羞布 | `styles.css:99-101` `html,body{overflow-x:hidden}` | 掩盖上述真实溢出，且使 body 成滚动容器，危及 `.topbar`/`.filter-panel` 的 `position:sticky` | 移除并逐个修根因（P0-3/4/5 + P1-1 修好后即可撤） |
| P1-3 | `.cmp-table` 无移动端堆叠 | `styles.css:562` `min-width:780px` | 对比页 / 厂商页 375px 下只能横向滚动 | 加 ≤640px 卡片堆叠（同 browse 表做法） |
| P1-4 | 641–720px 夹层 browse 表仍横滚 | `styles.css:629` `min-width:720px` 仅 ≤640px 用 `!important` 解除 | 该区间表格横向滚动 | 断点对齐或在桌面端改 `minmax` |
| P1-5 | `aria-pressed` 交互后不更新 | `views.js:404-436` 渲染写入；`router.js` 只 `classList.toggle` | 读屏永远播报旧状态 | 交互处同步 `setAttribute('aria-pressed', …)` |
| P1-6 | 结果变化无 `aria-live` 播报 | `router.js:84-87` 直接替换；计数 `views.js:361/393` 不在 live region | 筛选 / 搜索结果变化屏幕阅读器无感知 | `#browse-results` 加 `aria-live="polite"` |
| P1-7 | 对比按钮文案撑破列宽 | `views.js:390` 渲染 `✓`；`router.js:131` 一律改写"✓ 已加入对比"；列固定 10%（`styles.css:638`）| 按钮被长文案撑破 / 换行，挤压布局 | 按 `.sm` 变体分支文案 + 补 `aria-label` |
| P1-8 | 路由切换 / 重渲染后焦点丢失 | `router.js:42` 整段替换 `innerHTML` 后只 `scrollTo` | 重渲染后焦点回 body，键盘用户迷失 | 渲染后调用 `$('#app').focus()`（`index.html:36` 已备 `tabindex="-1"`） |
| P1-9 | 移动端触控目标 < 40px | `.cmp-remove` 28px(`:1093`)、`.chip`(`:822`)、`.rs-chip`(`:358`)、`.free-info` 15px(`:714`) | 窄屏点击困难，易误触 | 窄屏补 `min-height:40px` 或伪元素扩大热区 |
| P1-10 | `very-high` 脏枚举致评分归零 + 能力丢弃 | `search.js:93` `TIER[…]?.score ‖ 0`、`ui.js:68` `['high','highest'].includes`、`views.js:466` CAP_DIMS 过滤 | 该模型推理匹配分 0%、沉底、不生成"推理"标签 | 数据归一 + `validate_normalized.cjs` 补枚举白名单 |

---

## 四、P2 一致性 / 健壮性（7 项）

| # | 问题 | 证据 | 影响 | 建议 |
|---|------|------|------|------|
| P2-1 | 核心 JSON "全有全无" | `app.js:23-31` `Promise.all` | 任一 JSON 解析失败整站空态（连 `naming_guide.json` 404 也拖垮首页）| 改用 `Promise.allSettled` + 逐项默认 `[]`，仅 `model_variants` 硬失败 |
| P2-2 | `toggleCompare` 不校验 id | `store.js:113-127` 直接 `c.push(id)` | 满 6 时加不存在 id → `c.shift()` 弹出真实模型，静默数据丢失 | 入口加 `if(!variantById(id)) return` |
| P2-3 | `data-scene-task` 死分支 | `router.js:158-163` 监听属性全仓无模板输出，且读 `dataset.task`（应为 `dataset.sceneTask`）| 监听器永不触发，即便存在也会写 `undefined` | 删除该分支或补首页场景芯片渲染 |
| P2-4 | `providerById` 返回 `{}` 掩盖悬挂外键 | `store.js:27` `‖ {}` | 生成 `#provider/undefined` 死链、`assets/logos/undefined.svg` 请求 | 返回 `null` + 视图侧走 notFound |
| P2-5 | `familyTableHTML(null)` 可崩 | `router.js:114` `familyTableHTML(familyById(r.param))`，未命中返回 null 后 `views.js:263` 读 `f.id` | 直接崩溃 | 前置 `if(!f) return` |
| P2-6 | Token 消费率极低 | `styles.css` 全文件 | 圆角 30 处裸 `999px`、字号散落 26 种取值（含半像素 10.5/11.5…）、`--space-1..8` 仅用 2 次 | 长期工程：建字阶 token、圆角统一 `var(--radius-*)`，逐步替换 |
| P2-7 | 裸 hex / 死规则 / 缺失样式 | 裸 `#fff`(:304/305/537)、`rgba(0,0,0,.22)`(:728)、`.data-table--compare` 9 次出现但 DOM 零引用、`views.js:390` `.cmp-toggle.sm` 无对应 CSS | 视觉割裂 + 维护隐患 | 替换 token + 清死代码；`.cmp-toggle.sm` 补样式 |

---

## 五、已验证通过（无需修改）

- **localStorage 持久化**：`store.js:104-105` try-catch 完备，隐私模式 / 脏数据 / 幽灵 id 均正常降级不崩溃。
- **事件委托**：全部委托到 `document`，`bindGlobalEvents()` 仅调用一次，SPA 切路由无重复绑定 / 泄漏。
- **空态与边界**：搜索无结果、10 项筛选全勾（收敛到 8 条）、对比集移除至空（回退空态 + badge 归零）、超限自动淘汰 + toast，均正确。
- **重复 DOM id**：10 条路由全量扫描零重复；未知 / 空 param 路由均正确落 notFound。
- **数据引用完整性**：池 118（主库 59 + extra 59）、引用 140、**断裂 0**、无重复 id。

---

## 六、建议修复顺序与工作量

| 阶段 | 范围 | 工作量 | 价值 |
|------|------|--------|------|
| **阶段 1 · P0** | 5 处小改（router 兜底 + views 枚举兜底 + CSS 覆盖顺序 + 表格真链接 + 网格 minmax）| ~30 分钟 | 消除 2 个崩溃 + 3 个移动端布局破坏 |
| **阶段 2 · P1** | 响应式收口（顶栏死区、cmp-table 堆叠、夹层）+ 交互 a11y（aria 同步、live region、焦点、触控目标、对比按钮）| ~2-3 小时 | 移动端全视口可用、键盘 / 读屏可达 |
| **阶段 3 · P2** | Token 收口、死代码清理、健壮性（Promise.allSettled、id 校验、空指针前置）| 长期工程 | 视觉统一、可维护性 |

---

## 七、需要你确认

本报告仅做审计反馈，**未改动任何代码**。是否要我按 **P0 → P1 → P2** 顺序批量修复？还是先只修 **P0 这 5 个**（最小风险、最高收益）？确认后我即开工。

---

## 八、修复状态（2026-08-08 已执行，P0→P1→P2 全量）

**验证**：`validate_normalized.cjs` 0 错误；`smoke_render.cjs` 全部路由渲染全绿（确认 very-high / data-goto 改造无回归）；node 核验数据 7 种 tier 枚举全在 TIER 白名单。

### P0 ×5 — 全部修复 ✅
| # | 修复动作 | 文件 |
|---|---------|------|
| P0-1 | `decodeURIComponent` 包 `safeDecodeURI` 容错 + `render()` 整体 try/catch（畸形 hash 回退 notFound）| `src/router.js` |
| P0-2 | `constants.js` 加 `very-high` 到 TIER；`ui.js strong()` 纳入；`views.js:354` 加 `‖ {label,lv:'mid'}` 兜底 | `src/constants.js` `src/ui.js` `src/views.js` |
| P0-3 | 媒体查询 `.page{padding-block}` / `.wrap{padding-inline}` 拆分，消除移动端内边距归零 | `styles.css` |
| P0-4 | `familyTableHTML` / `viewCompare` 首列模型名改真 `<a class="row-link">` + 加 `data-label`；新增 `.row-link` | `src/views.js` `styles.css` |
| P0-5 | 网格 `minmax(320/300/280px)` → `minmax(min(Npx,100%),1fr)` | `styles.css` |

### P1 ×10 — 全部修复 ✅
| # | 修复动作 | 文件 |
|---|---------|------|
| P1-1 | 新增 `@media (max-width:960px)` 顶栏折行 + 导航横滑，原 720px 顶栏规则上移 | `styles.css` |
| P1-2 | `overflow-x:hidden` 保留为防御性兜底（根因已由 P0-3/4/5 + P1-1 修复，移除有回归风险）| `styles.css` |
| P1-3 | `cmp-table` 加 ≤768px 卡片堆叠（首列 sticky 移动端转 static）| `styles.css` |
| P1-4 | 浏览表卡片化断点 640 → 768，覆盖 641–768 夹层 | `styles.css` |
| P1-5 | 交互后同步 `aria-pressed`（cap / trait / seg 芯片）| `src/router.js` |
| P1-6 | `#browse-results` / `#recommendation` 加 `aria-live="polite"` | `src/views.js` |
| P1-7 | `.cmp-toggle.sm` 加 `white-space:nowrap` + 渲染带 `aria-pressed`/`aria-label` + 点击保持短文案 | `src/views.js` `src/router.js` `styles.css` |
| P1-8 | `render()` 末尾 `$('#app').focus({preventScroll:true})` 路由焦点归位 | `src/router.js` |
| P1-9 | 移动端 `.chip/.cmp-toggle/.rs-chip` min-height 36px、`.cmp-remove` 32px 触控目标 | `styles.css` |
| P1-10 | `very-high` 归一（同 P0-2）| — |

### P2 ×7 — 修复 5 项，暂缓 2 项 ⚠️
| # | 状态 | 说明 |
|---|------|------|
| P2-1 | ✅ 修复 | `app.js` `Promise.all` → `Promise.allSettled`，非核心 JSON 失败降级 `[]`，仅 `model_variants` 硬失败 |
| P2-2 | ✅ 修复 | `store.js toggleCompare` 加 `if(!variantById(id)) return c`，防脏 id 静默挤出真实模型 |
| P2-3 | ✅ 修复 | 删除 `router.js` 死分支 `[data-scene-task]`（`dataset.task` 永远 undefined，全仓无该属性模板）|
| P2-4 | ⏸️ 暂缓 | `providerById` 返回 `{}` → `null`：多处调用方直接读 `p.name`/`p.id`，改 null 会连锁 NPE；根因是数据完整性（缺失 provider 的变体），待数据侧治理而非改返回类型 |
| P2-5 | ✅ 修复 | `router.js` 家族排序 `if(f) refresh(...)`，防 `familyTableHTML(null)` 崩溃 |
| P2-6 | ⏸️ 暂缓 | Token 落地率 / 字阶属"长期工程"美化项（圆角 30 处裸 999px、字号 26 种取值），非 bug；未做破坏性大规模替换 |
| P2-7 | ✅ 修复 | 裸 hex → token：brandmark `#fff`→`var(--surface)`、`.family-card:hover` `#fff`→`var(--surface)`、free-tip `rgba(0,0,0,.22)`→`color-mix(foreground 22%)` |

> **暂缓说明**：P2-4、P2-6 均非崩溃/布局类缺陷，且改动波及面广、有回归风险，按"不破坏现有功能"原则留待专项治理（数据完整性核对 / Token 收口专项），不在本次批量修复范围。

### 提交
本轮改动涉及 `app.js` + `src/{router,views,store,constants,ui}.js` + `styles.css`，**尚未提交**。待用户决定提交方式（单独提交 or 与后续改动合并）。
