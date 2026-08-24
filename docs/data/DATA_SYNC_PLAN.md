# DATA_SYNC_PLAN.md — AI Model Explorer V4 数据维护能力升级方案

> 状态：**Phase 0 / 1 / 2 / 3 / 4 已实施**（Schema 契约 + 13 家 Collector 闭环 + 差异报告 + **自动开 PR（不自动合并）+ 受限安全自动合并（默认关）+ 健康监控/免费层监控/弃用检测 + 自动部署 job（闭环全量）** 已落地；详见各章节验收清单）。
> 目标：不是建设完整数据平台，而是为现有 AI Model Explorer V4 增加**可靠的数据维护能力**。
> 核心闭环（第一阶段）：`Collector → 数据差异报告 → 人工确认`
> 范围已收敛：不做全自动修改主数据；前端已完成，不做大规模重构。

---

## 0. 范围与原则

### 0.1 本次不做的事
- ❌ 不自动修改生产 `data/*.json`
- ❌ 不自动开 PR（稳定后再进入）
- ❌ 不自动部署（保持现有手动 rsync）
- ❌ 不覆盖前端渲染逻辑 / 不重构 Schema 主体
- ❌ 不一次性实现全部厂商 Collector

### 0.2 设计原则
1. **Git = 唯一真相源**；数据更新 = 一次部署（保持现状）。
2. **语义分离**：`verified_date`（人工确认时间）≠ `last_checked`（机器检查时间）。
3. **free 字段不被自动覆盖**；仅增加来源追踪字段，最终 free 状态必须由人工在 review 时确认。
4. **第三方列表仅作发现源**；最终 free / 价格状态必须来自官方源。
5. **所有自动化产出先给人看，再由人合入**（人工确认门）。
6. **字段兼容**：新增字段为"附加"，不删除/不重命名破坏前端的字段；现有 `data_source` / `last_verified_at` 保持并存，新字段为同步系统的权威来源。

---

## 1. 字段与 Schema 设计

### 1.1 现有 variant 真实字段（已核实，118 条全覆盖）
价格/上下文/状态类（**客观字段，可由 Collector 写**）：
`input_price_per_mtok` `output_price_per_mtok` `context_window` `max_output_tokens`
`release_date` `status` `price_model` `cost_tier` `media_pricing`(22/118) `media_type`(24/118)
`source_url`(118/118) `free`(56/118) `free_note`(81/118)

定性/人工字段（**Collector 一律不碰**）：
`one_liner_cn` `capabilities.*.tier/basis` `best_for` `avoid_for` `speed_tier` `model_type`
`role` `access_types` `data_quality_score` `price_note` `verified` `verified_date` `aliases`

已存在的相关字段（需与新字段对齐）：
`data_source: "official"`（118/118） → 新字段 `data_source_type` 的初值来源
`last_verified_at: "2026-08-05"`（118/118） → 新字段 `last_checked` 的初值来源

### 1.2 新增 / 回填字段（Phase 0）

| 字段 | 类型 | 写入方 | 说明 |
|---|---|---|---|
| `source_url` | string | 人工 / Collector | 数据出处链接，已 118/118 存在，**直接复用，不新增** |
| `data_source` | enum | 人工 / Collector | 现有字段（118/118，值 `official`/`community`），**直接复用，不新增 data_source_type** |
| `last_verified_at` | date | **人工** | 现有字段（118/118），**人工确认时间，直接复用**；绝不被机器覆盖 |
| `last_checked_at` | date | **机器** | **Phase 0 仅入 Schema（可选，不回填旧数据）**；Phase 1 Collector 写入，机器检查时间，与 `last_verified_at` 语义分离 |

> ⚠️ 语义分离红线（按用户最终约束）：`last_verified_at`（人工确认）≠ `last_checked_at`（机器检查）。
> 现有 `data_source` / `last_verified_at` / `source_url` **优先复用**，不重复增加类似字段；仅新增可选字段 `last_checked_at`（Phase 0 不回填，Phase 1 Collector 写入）。

### 1.3 `data/meta.json`（替代 MANIFEST.json）
前端不加载，仅校验 / CI / Collector 读取。结构（预留未来字段）：

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-08-08",
  "sources": {
    "openai":        { "enabled": true, "last_sync": null, "status": "pending" },
    "anthropic":     { "enabled": true, "last_sync": null, "status": "pending" },
    "google-gemini": { "enabled": true, "last_sync": null, "status": "pending" },
    "nvidia-nim":    { "enabled": true, "last_sync": null, "status": "pending" }
  },
  "sync_status": "idle"
}
```

- `sync_status` ∈ `idle` / `running` / `success` / `failed`
- Phase 1 仅启用上述 4 个 source；扩展时只加 key。

### 1.4 JSON Schema 契约
新增 `data/schema/variant.schema.json` + `provider.schema.json`（Draft 2020-12），覆盖现有全部字段 + 1.2 新字段。新增 `scripts/validate_schema.cjs` 基于它校验。

**业务规则（在 schema 之外的校验脚本里强制）**：
- `data_source_type === "third_party_list"` 的记录**禁止** `free: true`；
- 若 `free: true`，必须存在 `free_source_url` 且 `data_source_type` 为 `official_*`。

### 1.5 free 字段保护（对应调整 #6）
- Collector **不写** `free`。
- 仅追加来源追踪字段：`free_source_url`（出处）、`free_verified_via`（`official` / `third_party`）。
- 最终 `free` 状态变更必须由人工在 review 时确认；第三方列表只产出"候选清单"进报告。

---

## 2. 数据目录结构（兼容前端）

```
data/                              # 前端运行时读取（文件名/数组结构不变 → 无重构）
  meta.json                        # [新增] schema_version / sources / sync_status
  model_variants.json              # 数组，已含 source_url / last_checked / data_source_type
  model_variants_extra.json
  providers.json  api_access.json  gateways.json
  model_aliases.json  model_versions.json  model_families.json
  naming_guide.json  recommendations.json  scenarios.json  tasks.json
  schema/                          # [新增]
    variant.schema.json
    provider.schema.json
  .staging/                        # [新增, gitignored] Collector 输出 + 差异报告，合入前暂存
    model_variants.json
    DATA_UPDATE_REPORT.md
collectors/                        # [新增] 插件化采集器（Phase 1 = 4 家）
  _base.js  _registry.js  _config.json
  openai.js  anthropic.js  google-gemini.js  nvidia-nim.js
  # 后续：cloudflare.js  huggingface.js
  # 更远：deepseek.js  qwen.js  zhipu.js  groq.js  together.js  replicate.js  fal.js
scripts/
  run_collectors.cjs  validate_schema.cjs  diff_data.cjs   # [新增]
  bump_verified.cjs  validate_normalized.cjs  model_quality_check.py
  crosscheck_free.cjs  deploy.sh  smoke_render.cjs         # 保留
.github/workflows/
  ci.yml                           # 保留（push/PR: syntax + validate）
  data-sync.yml                    # [新增] 每周 + 手动触发
```

> 前端继续 `fetch('./data/*.json')`，文件结构不变 → **零重构**。

---

## 3. Phase 0 详细任务（契约地基，零行为变化）

目标：补 Schema 契约 + 溯源字段，**前端零改动、4 门回归不变绿**。

1. **新增 `data/meta.json`**（按 1.3 结构，4 个 source 启用，其余 pending）。
2. **字段约定（不改动数据）**：复用现有 `data_source` / `last_verified_at` / `source_url`；仅在 Schema 中声明可选新字段 `last_checked_at`（机器检查时间）。**Phase 0 不回填、不清理任何数据**。
3. **新增 `data/schema/variant.schema.json` + `provider.schema.json`**，覆盖现有字段 + 新字段。
4. **新增 `scripts/validate_schema.cjs`**：基于 JSON Schema 校验 `data/*.json`；CI 增加此步（与 `validate_normalized.cjs` 并存）。
5. **回归保护**：`node --check` + `validate_normalized` + `smoke_render` + `model_quality_check` 仍全绿；前端渲染完全一致（新增字段被忽略）。
6. **`node --check` 全模块、4 门回归写入 CI 作为合并门槛**（已具备，确认无遗漏）。

**Phase 0 验收**
- [ ] `data/meta.json` 存在且 `schema_version: "1.0"`；`validate_schema.cjs` 读取它。
- [ ] 118 条 variant 均有 `last_checked` + `data_source_type`（初值正确映射）。
- [ ] `data/schema/*.schema.json` 对当前全部数据校验 **0 错误**。
- [ ] 现有 4 门回归全绿。
- [ ] 前端渲染与改动前一致（新增字段被忽略，无重构）。

---

## 4. Phase 1 详细任务（Collector 试点：4 家 + 报告 + 人工确认）

目标：建标准 Adapter + 闭环，**只开 4 家**，产出差异报告供人工确认，**不自动开 PR、不自动改主数据**。

1. **`collectors/_base.js`**：抽象 `BaseCollector`（`meta` / `fetchRaw` / `normalize` / `discover` / 限流 `request`）。
2. **`collectors/_registry.js`**：扫描 `collectors/*.js`，自动发现导出 `BaseCollector` 子类的模块 → `id → class` 映射（无需手工登记）。
3. **`collectors/_config.json`**：`{ "enabled": ["openai","anthropic","google-gemini","nvidia-nim"] }`。
4. **4 个 Adapter**：`openai.js` / `anthropic.js` / `google-gemini.js` / `nvidia-nim.js`，各自实现 `fetchRaw`（官方定价页 / API）+ `normalize`（产出**仅客观字段的 patch**）。
5. **`scripts/run_collectors.cjs`**：按 `_config.enabled` 跑 Adapter → `normalize` → 合并进 `.staging/model_variants.json`（按 `id` 匹配）。**单源失败隔离**，不阻断其他源。
6. **`scripts/diff_data.cjs`**：将 `.staging/` patch 与 `data/` 当前记录做字段级 diff，**只比对白名单客观字段**（价格 / 上下文 / 输出上限 / release_date / status / media_pricing 等），保留全部人工/定性字段。产出 `.staging/DATA_UPDATE_REPORT.md`（新增 / 价格变动 / 弃用 / 字段缺失）。**Phase 1 不写回 `data/`**。
7. **免费口径强制**（沿用 1.5）：校验规则——`data_source_type === "third_party_list"` 的记录禁止 `free:true`；最终 `free` 由人工确认。
8. **`data-sync.yml`**：每周 + 手动触发，跑上述流程；有 diff → 把 `.staging/` 推到 `data-staging` 分支并建 **Issue 通知**（**不开 PR**）；无 diff → 结束；异常 → 建 Issue 告警。
9. **人工确认路径**：人 review `DATA_UPDATE_REPORT.md` / `data-staging` 分支 → 若认可，本地运行 `node scripts/apply_staging.cjs`（把 `.staging/` patch 合入 `data/`，仅客观字段）→ `git commit` → `git push` → `npm run deploy`。

**Phase 1 验收**
- [x] `collectors/` 含 `_base` / `_registry` / `_config` + 4 个 Adapter；`loadCollectors()` 自动发现且仅发现这 4 个（无需手工登记）。
- [x] `run_collectors` 只跑 `_config.enabled`；某源抛错时**其余源仍产出、报告标注失败源**（已用 `--simulate-failure` 验证）。
- [x] `normalize` 输出**仅含白名单客观字段**；定性字段在 `data/` 中原样保留（适配器只映射 `OBJECTIVE_FIELDS`；`apply_staging` 非白名单字段一律拒绝）。
- [x] `validate_schema` 通过；`apply_staging` 对非白名单 / `free` / `free_note` 字段一律 `BLOCKED`（free 不会被自动覆盖）。
- [x] `diff_data` 生成 `DATA_UPDATE_REPORT.md`，含新增候选 / 价格变动 / 疑似下架 / 失败源摘要。
- [x] `data-sync.yml` 已建：每周一 + 手动触发；有 diff → 推 `data-staging` 分支 + 建 Issue；**无自动 PR、无自动改主数据**；校验失败 → 建 Issue 告警。
- [x] 人工确认后 `apply_staging.cjs --apply` 合入（dry-run 已验证仅动客观字段）；后续 `npm run bump -- --all && git commit && npm run deploy`。

> **Phase 1 实施记录**
> - **模块系统**：`package.json` 为 `"type":"module"`，故 `collectors/*.js` 用 ESM（`export default class`）；编排脚本 `scripts/run_collectors.cjs` 等为 `.cjs`（CommonJS），通过 `await import(pathToFileURL(...))` 动态加载 adapters。无需改前端。
> - **离线可复现**：真实官方定价页多为 HTML / 需 Key，结构化解析留待后续阶段。故每个 adapter 支持离线模式（`--offline` 读 `collectors/_fixtures/<id>.json`），CI 与本地回归可稳定跑通「采集 → 差异报告」全链路，不依赖外网。
> - **失败隔离**：`BaseCollector.run()` 内部 try/catch，单源失败仅标记 `failed` 并进入报告，不阻断其他源。
> - **人工确认门**：`run_collectors` 只写 `data/.staging/`（已 gitignore）；`diff_data` 生成报告；真正写回 `data/` 必须由人执行 `apply_staging.cjs --apply`。
> - **本地跑法**：`npm run collect:offline` → `npm run diff` → 审阅 `data/.staging/DATA_UPDATE_REPORT.md` → `npm run staging:apply:do`。

**Phase 2 验收**
- [x] `collectors/` 新增 `cloudflare.js` + `huggingface.js`（ESM 适配器）；`loadCollectors()` 自动发现 6 个（无需手工登记），`_config.enabled` 与 `data/meta.json.sources` 同步加入这 2 家。
- [x] 新源产出「新增候选」patch（站点内无对应记录 → diff 归入 `news`），`apply_staging` 不自动入库（需人工补定性字段）。
- [x] 新增 `scripts/stage_pr.cjs`：**默认 `--dry-run`** 预览 PR/Issue 标题+正文；`--create` 在有字段变动时自动开 PR（`data-sync/<date>` → master，**不自动 merge**），仅字段变动才 PR、纯发现则退化建 Issue。
- [x] `data-sync.yml` 改为自动开 PR：`pull-requests: write` + `issues: write` 权限；`workflow_dispatch` 增加 `dry_run` 输入（走 `--issue-only` 不开 PR）；保留失败 Issue 告警。
- [x] `apply_staging` 的 free / 定性字段拦截在 PR 路径同样生效（`stage_pr.cjs` 复用 `apply_staging --apply`）。
- [x] `package.json` 增加 `stage:pr` / `stage:pr:create` 脚本；`npm run stage:pr` 即本地预演。

> **Phase 2 实施记录**
> - **自动开 PR（不开合并）**：`stage_pr.cjs` 读 `diff.json` 决策——`changes.length>0` 走 PR 路径（切 `data-sync/<date>` 分支 → `apply_staging --apply` 写 data/ → 提交 data 文件 → push → `gh pr create --base master`）；否则走 Issue 路径（`gh issue create`）。全程不碰 master，merge 由人执行。
> - **issue-only 模式**：CI 的 `dry_run` 输入 → `stage_pr.cjs --create --issue-only`，即使有字段变动也只建 Issue、不开 PR（安全开关）。
> - **新源即"发现"**：Cloudflare / HuggingFace 适配器产出的型号在 `data/` 中无对应记录，diff 归入 `news`（新增候选），不会写入主数据；待人工补 `one_liner_cn` / `capabilities` 等定性字段后才正式入库，符合"第三方/新源仅作发现、最终状态人工确认"原则。
> - **未动数据/前端**：6 家适配器 + fixtures + meta.json(配置) + 新脚本 + CI 改动，全部不触碰 `data/*.json` 业务数据与前端渲染；5 门回归保持不变绿。
> - **本地预演**：`npm run collect:offline && npm run diff && npm run stage:pr`（dry-run 打印分支/标题/正文）；`npm run stage:pr:create` 需 gh + 远端才会真正开 PR。

**Phase 3 验收**
- [x] `collectors/` 新增 `deepseek.js` / `qwen.js` / `zhipu.js` / `groq.js` / `together.js` / `replicate.js` / `fal-ai.js`（ESM 适配器）；`loadCollectors()` 自动发现 13 个；`_config.enabled` 与 `data/meta.json.sources` 同步加入这 7 家（共 13 家）。
- [x] `data/providers.json` 新增 `together` / `replicate` / `fal-ai` 三个网关厂商（带官方彩色 logo：`assets/logos/{together,replicate,fal-ai}.svg` 取自 lobehub）。
- [x] 安全自动合并（`stage_pr.cjs --auto-merge-safe`）：`isSafeDiff()` 判定仅含白名单「价格/辅助」字段变动、无新增/弃用/失败源、且价格变动幅度 ≤ ±50% 时，判定为纯安全变动。
- [x] 默认关：CI 不传 `--auto-merge-safe`，仍走 PR 人审；仅当 `workflow_dispatch` 显式开启 `auto_merge_safe` 且 diff 纯安全时才直接合入 master（绕过 PR）。
- [x] 非安全 diff（含新增候选/弃用/失败源/超阈值价格变动/非安全字段）绝不自动合并，一律走 PR/Issue 人审。
- [x] `free` / 定性字段仍由 `apply_staging` 拦截；自动合并路径复用 `apply_staging --apply`（仅客观字段）。
- [x] `run_collectors.cjs` 新增 `--only <id>` 聚焦单源；`package.json` 增加 `stage:pr:auto` / `stage:pr:auto:do`。
- [x] 5 门回归全绿；offline 13 源跑通；`--only deepseek` 验证"纯安全变动 → 安全自动合并"路径；全量含 news 验证"含新增候选 → 转 PR/Issue"路径。

> **Phase 3 实施记录**
> - **扩展 7 家**：DeepSeek / Qwen(=alibaba-qwen) / 智谱(=zhipu-glm) / Groq 复用既有数据，产出"字段变动"；Together / Replicate / fal.ai 为新网关厂商，产出"新增候选"(news)，符合"新源仅作发现"原则。
> - **安全自动合并**（受限、默认关）：`stage_pr.cjs` 新增 `isSafeDiff()` 安全判定（SAFE_FIELDS={input/output_price_per_mtok, context_window, max_output_tokens}；价格变动阈值 PRICE_THRESHOLD=0.5）。仅当 `--auto-merge-safe` 且 diff 纯安全时，跳过 PR 直接 `apply → commit master → push master`；否则走原 PR/Issue 人审路径。CI 默认不传该标志，行为不变。
> - **3 个新厂商官方 logo**：together-color.svg / replicate-brand.svg / fal-color.svg 复制自 `@lobehub/icons-static-svg/icons/`（用户约定"有官方用官方"）。
> - **新增 `--only`**：`run_collectors.cjs` 支持 `--only <id>` 只跑单源，便于聚焦验证安全自动合并路径。
> - **未动数据/前端**：仅新增适配器 + fixtures + 3 个 provider + 配置/CI/脚本；`data/*.json` 业务数据与前端渲染零改动；5 门回归保持全绿。
> - **本地预演**：`npm run collect:offline && npm run diff && npm run stage:pr:auto`（dry-run 显示安全判定 + 将直接合 master 预览）；`npm run stage:pr:auto:do` 需 gh + 远端 + 显式开启才会真合 master。

**Phase 4 验收**
- [x] `scripts/monitor.cjs`（CommonJS）：只读 `data/` + `data/.staging/collected.json`，产出 `HEALTH_REPORT.md` + `health.json` + `health_state.json`（连续失败计数）。
- [x] **免费层监控**：`free:true` 但官方源价格>0 → error（数据诚信冲突）；`free:true` 但 `free_note` 缺失 → warn；非 free 但官方源价格=0（非网关源）→ info（疑似漏标免费）。
- [x] **弃用检测**：官方源 `status=deprecated/retired/archived` 而站内仍活跃 → warn；站内型号官方源本次未返回 → warn（疑似下架）。
- [x] **价格/数据异常**：价格倍数 ≥5x / ≤0.2x → error（疑似解析错误）；≥2x / ≤0.5x → warn；曾付费→0 → info；曾免费→付费 → warn；客观字段回退为 null → warn。
- [x] **采集健康**：单源失败 → warn；同源连续失败 ≥2 次 → error。
- [x] 监控为**只读**，绝不写回 `data/*.json`；默认不阻断流水线（exit 0）；`--fail-on=error` 可选阻断（CI 默认不开）。
- [x] `data-sync.yml` 新增 `deploy` job：push 到 master 或 `workflow_dispatch.deploy=true` 时，经 `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_KEY` secret 执行 `deploy.sh` rsync 到海外服务器（未配置 secret 则跳过）；`collect` 的 PR 步骤已限定仅 `schedule`/`workflow_dispatch` 触发，避免 push 后误开 PR。
- [x] `health.json` 出现 error 级告警时，CI 自动建「数据健康告警」Issue（不自动修数据）。
- [x] `package.json` 增加 `monitor` / `monitor:check`；5 门回归全绿；offline 跑通监控（自然触发 1 疑似下架 warn + 2 免费候选 info）。

> **Phase 4 实施记录**
> - **健康监控 `scripts/monitor.cjs`**（新增，CommonJS）：完全自包含，从 `collected.json` + `data/` 推导四类告警（免费层监控 / 弃用检测 / 价格数据异常 / 采集健康），分 error/warn/info 三级，输出 `HEALTH_REPORT.md` + `health.json` + `health_state.json`（跨运行连续失败计数，gitignored）。阈值可调：`PRICE_EXTREME=5`、`PRICE_LARGE=2`、`CONSEC_FAIL_ERROR=2`。**只读，不碰业务数据**。
> - **免费层监控**特别处理：网关/聚合类 provider（openrouter/groq/nvidia-nim/together/…/agnes）返回价格 0 是常态，不触发「疑似漏标免费」；仅官方源价格=0 才提示。free 与官方定价冲突判为 error（需人工核销）。
> - **弃用检测**：复用 diff 的"疑似下架"思路 + 新增 status 维度（官方源标 archived 而站内 active 即告警）。
> - **自动部署 job**：`data-sync.yml` 新增 `deploy`（needs: collect），触发条件 `push→master`（PR 合并/安全自动合并后）或 `workflow_dispatch.deploy=true`，经 secret 跑 `deploy.sh`（rsync 到海外服务器）；无 `DEPLOY_HOST` secret 则跳过并打印提示。**闭环形成**：采集 → 差异 →（PR 人审 / 安全自动合并）→ 推 master → 自动部署。
> - **CI 防误开 PR**：`collect` 的 stage_pr 步骤 `if` 改为仅 `schedule`/`workflow_dispatch` 触发，push 到 master 时只采集+监控+部署，不再开 PR（避免循环/重复 PR）。
> - **健康告警 Issue**：`collect` 末尾新增步骤读 `health.json`，error 级 >0 时 `gh issue create` 通知（不自动改数据）。
> - **未动数据/前端**：仅新增 `scripts/monitor.cjs` + CI 调整 + package 脚本；`data/*.json` 业务数据与前端渲染零改动；5 门回归保持全绿。
> - **本地预演**：`npm run collect:offline && npm run diff && npm run monitor`（看 HEALTH_REPORT）；`npm run monitor:check` 开启 error 级阻断（仅校验用，默认不开）。

---

## 5. Collector 接口设计（插件契约）

```js
// collectors/_base.js
export class BaseCollector {
  static id = ''               // 'openai' 唯一，需与 provider_id 对齐
  static label = ''
  static official = true       // true=官方源；false=第三方发现源（只能 discover）
  static requiresKey = false
  constructor(ctx) { this.ctx = ctx }   // { secrets, http, cache, log, rate }

  async fetchRaw() { throw new Error('not implemented') }   // 拉官方原始数据
  normalize(raw) { throw new Error('not implemented') }     // → 客观字段 patch[]
  async discover() { return [] }                            // 仅第三方源用，返回候选
  async request(url, opts) { return this.ctx.http.get(url, opts) } // 限流 + 退避
}
```

```js
// collectors/openai.js
import { BaseCollector } from './_base.js'
export class OpenAICollector extends BaseCollector {
  static id = 'openai'; static label = 'OpenAI'; static official = true; static requiresKey = false
  async fetchRaw() { return this.request('https://openai.com/api/pricing.json') }
  normalize(raw) {
    return raw.map((m) => ({
      id: `openai-${m.slug}`, provider_id: 'openai',
      input_price_per_mtok: m.input, output_price_per_mtok: m.output,
      context_window: m.context, max_output_tokens: m.max_output,
      source_url: 'https://openai.com/pricing',
      last_checked: new Date().toISOString().slice(0, 10),
      data_source_type: 'official_docs',
    }))
  }
}
```

```js
// collectors/_registry.js —— 自动发现，无需手工登记
import fs from 'fs'; import path from 'path'
const skip = new Set(['_base.js', '_registry.js', '_config.js'])
export function loadCollectors() {
  return fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && !skip.has(f))
    .map((f) => require(path.join(__dirname, f)).default)
    .filter((C) => C && C.prototype instanceof BaseCollector)
}
```

**白名单客观字段（Collector 只能写这些）**：
`input_price_per_mtok` `output_price_per_mtok` `context_window` `max_output_tokens`
`release_date` `status` `media_pricing` `media_type` `source_url` `last_checked_at`

**定性字段（一律不碰）**：
`one_liner_cn` `capabilities` `best_for` `avoid_for` `speed_tier` `model_type` `role`
`access_types` `data_quality_score` `price_note` `free` `free_note` `verified` `verified_date` `aliases`

---

## 6. GitHub Actions 设计（`data-sync.yml`，Phase 2）

> 完整 workflow 见 `.github/workflows/data-sync.yml`（Phase 2 版，唯一真相源）。要点：

```yaml
on:
  schedule:
    - cron: '23 3 * * 1'          # 每周一 03:23 UTC（避开整点，非每日）
  workflow_dispatch:
    inputs:
      dry_run: { description: '仅生成报告 + 建 Issue，不开 PR', type: boolean, default: false }
permissions:
  contents: write
  pull-requests: write            # 自动开 PR 需要
  issues: write
jobs:
  collect:
    steps:
      - run: node scripts/run_collectors.cjs
      - run: node scripts/validate_schema.cjs
      - run: node scripts/diff_data.cjs
      - name: 自动开 PR（不自动合并）
        if: ${{ !inputs.dry_run && success() }}
        run: node scripts/stage_pr.cjs --create        # 有字段变动→开 PR；否则→建 Issue
      - name: 仅报告模式（dry_run，不开 PR）
        if: ${{ inputs.dry_run && success() }}
        run: node scripts/stage_pr.cjs --create --issue-only
      - name: 异常告警
        if: failure()
        run: gh issue create --title "数据同步异常 ..." --body "见 run log"
```

**关键约束（Phase 2）**
- **自动开 PR、不自动合并**：有「字段变动」→ 切 `data-sync/<date>` 分支 → `apply_staging --apply`（仅客观字段）→ 提交 `data/` → push → `gh pr create --base master`；**人审后手动 merge**，绝不自动合入。
- **仅发现（无字段变动）**：只有新增候选 / 失败源时退化建 **Issue 通知**（新候选需人工补定性字段，无法自动入库），不开空 PR。
- `free` / 定性字段始终不碰（`apply_staging` 已拦截）；合并后由现有 `deploy.sh`（手动 rsync）落地，自动部署留 Phase 4。
- 单源失败被 `run_collectors` 捕获，不整 job 失败；仅 Schema 校验失败才阻断。
- 频率：**每周一 + 手动**，非每日。`workflow_dispatch` 的 `dry_run` 输入可临时只出报告不开 PR。
- 真实官方源多为 HTML / 需 Key，结构化解析留待后续阶段；CI 默认走网络 best-effort（失败源被隔离），本地回归用 `--offline` fixtures 稳定复现全链路。

---

## 7. 分层实施路线图

| 阶段 | 内容 | 自动化程度 | 厂商范围 |
|---|---|---|---|
| **Phase 0** | Schema 契约 + 溯源字段 + 校验 + 回归 | 无（纯地基） | — |
| **Phase 1** | Collector 插件闭环 + Diff 报告 + 人工确认 | 产出报告，**人合入** | OpenAI / Anthropic / Google Gemini / NVIDIA |
| **Phase 2** | 自动开 PR（不自动合并）+ 扩展 Cloudflare / HuggingFace | PR + 人审 | +2 |✅ 已实施 |
| **Phase 3** | 安全自动合并（仅价格/辅助字段，默认关）+ 扩展 DeepSeek / Qwen / 智谱 / Groq / Together / Replicate / fal.ai | 受限自动合并 | +7 | ✅ 已实施 |
| **Phase 4** | 监控/告警/免费层监控/弃用检测 + 自动部署 job | 闭环 | 全量 | ✅ 已实施 |

> 免费数据卫生：第三方列表仅作发现源；最终状态必须来自官方源（贯穿 Phase 1–4）。

---

## 8. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| 自动解析错 → 错价上线 | 高 | Phase 1 不自动合入；先报告 + 人审；价格变更走人工确认 |
| 爬页违反 ToS / 封 IP | 中 | 优先官方 API / 定价页；限流退避；非 API 源走白名单 |
| Schema 漂移弄崩站点 | 中 | JSON Schema 契约 + CI 校验拦截合入 |
| "核实"虚假信任 | 中 | `verified_date` / `last_checked` 语义分离，前端可明示来源 |
| 密钥泄露 | 中 | GitHub Secrets；最小权限 token；不打印 Key |
| CI 依赖外部源 flaky | 低 | 采集器超时隔离、失败不致命、仅报告 |
| free 被误覆盖 | 中 | Collector 不写 free；仅追加追踪字段；校验规则拦截 |

---

## 9. 落地前待确认（仅影响 Phase 1 实现细节，不改变方案）

1. **厂商源选择**：Phase 1 用"公开无需 Key"的价格源（官方定价页 / Azure Retail Prices）优先；API Key 类延后。
2. **Provider id 对齐**：实现时校验 `collector.id` 与 `data/providers.json` 的 `provider_id` 一致（建议 openai / anthropic / google / nvidia-nim）。
3. **部署**：暂保持手动 `deploy.sh`，自动部署作为 Phase 4。

---

## 10. 生产上线验证与数据真相源对齐（2026-08-24）

**线上已生效（独立核验，WebFetch 实测 `models.hush7.online/data/model_variants.json`）**：
- `deepseek-v3`：`output_price_per_mtok=0.38` / `input_price_per_mtok=0.26` / `context_window=163840`（= 新价 ✅）
- GLM 系列当前 **3 条**：`glm-5-2` / `glm-5` / `glm-5-turbo`

**✅ 数据真相源未对齐 —— 已修复（2026-08-24）**：
- 根因：deepseek OpenRouter 归一化修复（`fix/collectors-deepseek-openrouter-norm`）只停留在分支、未合 master；且那次手动部署 `collect+apply` 出新价后从未提交，导致 git 真相源停在旧价、下次干净部署会静默回退。
- 已执行：
  1. `git merge fix/collectors-deepseek-openrouter-norm` → master（fast-forward，带入 collector 修复 + CI git 身份修复，防止 data-sync PR 静默丢弃）；
  2. `npm run collect` + `npm run staging:apply:do` 把 7 条真实价（deepseek-v3 / v3-2 / r1 / glm-5 / glm-5-2 / glm-4-7-flash / glm-5-1）落进主数据并提交，使「仓库 == 当前真实价」；
  3. `scripts/deploy.sh` 加固：上线前校验 `data/model_variants.json` 存在且合法 JSON，否则中止；检测到 `data/` 有未提交改动时中止（设 `DEPLOY_UNCOMMITTED=1` 可显式绕过）——从根上拦截「collect+apply 后没提交就 deploy」的故障模式；
  4. `ci.yml` / `data-sync.yml` 的 `node-version` 由 `20` 升 `22`，消除 Node 20 deprecated 告警。
- 状态：本地 master 已领先 origin/master 2 个提交（数据对齐 + 加固），**待 push 到 origin/master 后**：origin/master == 生产真实价，且后续 data-sync 在 master 用修正后的 collector 跑，不会再开 PR 把 deepseek 打回 1.1。push 会触发 CI 自动部署（rsync 同值，生产无感），按部署红线需用户确认后再 push。
