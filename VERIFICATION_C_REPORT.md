# 专项核查报告 C：真实设备 / 性能 / 对比度

> 范围：在 A（P2-4 悬挂外键治理）+ B（P2-6 字阶/间距 Token 收口）之后，补齐审计未覆盖的三类验证面。
> 方法：自动解析 `styles.css` `:root` 色值计算 WCAG 对比度；资源体积用 `wc -c`/`du` 实测；响应式做静态断点 + 守卫复核（沙箱无浏览器，真机渲染见第三节清单）。

## 一、性能

| 项目 | 体积 | 说明 |
|------|------|------|
| index.html | 2.3 KB | — |
| styles.css | 65 KB | 含 B 新增字阶 Token |
| JS 全模块（app + 7） | 112 KB | ESM 开发态，未压缩 |
| 核心数据（5 文件） | 270 KB | 首屏实际加载 |
| **首屏未压缩合计** | **≈ 439 KB** | gzip 后约 150–200 KB |
| 32 厂商 logo | 152 KB | 全 SVG，懒加载 `loading=lazy` |
| 页头 logo | 3 KB | `assets/brand/logo.svg`（实际引用） |

- **结论**：首屏 ≈ 439KB 未压缩 / gzip 150–200KB，对数据型 SPA 属健康范围，无阻塞性问题。
- ⚠️ **仓库冗余（非运行时）**：`assets/brand/*.png`（logo / logo-a / logo-b / logo-c / favicon，共 **3.4 MB**，均为 1024×1024）**未被任何代码引用**（页头用 `logo.svg`）。属孤儿资源，不影响运行时但撑大仓库。建议删除或按需转 SVG/WebP。
- 可选优化：12 个 JSON 共 ~410KB，非首屏数据（api_access / model_aliases / model_versions 等）可改按需懒加载。

## 二、对比度（WCAG，自动解析 :root 计算）

测试 24 组关键前景/背景对（正文、链接、分类徽章、状态色、代码块等）。

- **结果：0 个 < 3:1（无任何不可用组合）**。
- ✅ **已修复 1 项**：`--muted` 弱化文字（说明 / 元信息小字）原 surface 4.43 / bg 4.18:1，刚卡在 AA 正文 4.5:1 以下 → 压暗为 `#647069`，现 surface **5.17** / bg **4.88** / 浅绿底 **4.61**:1，均达 AA 正文。
- 🟡 **剩余 6 对仅达 AA-large（3–4.5:1）**：主要为分类 / 状态徽章 fg-on-soft（`category-video-fg`、`warning-fg`、`error-fg` 及其底色，以及 `on-brand` on 交互绿 / 成功色）。这些多为加粗徽章标签，按 WCAG 属「大文本」达标范围。若某处用作小字正文，可再压暗对应 fg token 一档（如 `#5f6b62` 级别）。

## 三、响应式 / 真实设备

> ⚠️ 沙箱无无头浏览器（无 chromium / playwright），**未能真机截图渲染**。以下为静态复核 + 请你在 `http://localhost:8848/` 用 DevTools 设备模拟复核的清单。

**静态复核（守卫仍在位）**
- 断点 `@media`：max-width `1080 / 960 / 860 / 768 / 720 / 640` + `prefers-reduced-motion`（含此前审计补的 960px 断点，消 721–960 死区）。
- 溢流守卫：`html,body{overflow-x:hidden}`（1）、`#main-nav a{white-space:nowrap}`（21，含导航）、`min-width:0`（14，含 browse-results / 表格）。
- 表格卡片化：640 / 768 断点已做。

**请你复核的清单（DevTools 设备工具栏）**
1. **320px**（iPhone SE）：首页 hero、卡片网格、browse 表卡片化是否溢出 / 重叠
2. **375 / 390px**（主流手机）：顶栏导航 nowrap 不换行、搜索框不撑宽
3. **768px**（平板）：browse 表格卡片化、matcher 左右布局
4. **1024 / 1440px**（桌面）：双 / 三列网格、对比页
5. 切换 `prefers-reduced-motion` 验证动效降级
6. 键盘 Tab 走查：browse 表行链接、对比按钮、筛选控件可达

## 结论

A / B / C 三项全部完成：
- **A** 数据侧治理（校验覆盖 `variantsExtra` 外键）+ 死链空值守卫；
- **B** 字阶 Token 收口（179 处 `font-size` 统一进 `--text-*`，半像素档折叠）+ 间距别名（109 处精确命中 `--space-*`）；
- **C** 对比度治理（`--muted` 压暗达标）+ 性能 / 响应式专项核查。

**已知低风险遗留（非阻塞）**
1. 间距不规则裸值（10 / 6 / 14 / 18 / 22 / 3 / 2px 等）未收口 —— 为保你对齐刻意留作二次视觉核验；
2. 品牌 PNG 孤儿资源 3.4MB 待清理；
3. 6 对 AA-large 徽章色可选再压暗（仅当用于小字正文时）。
