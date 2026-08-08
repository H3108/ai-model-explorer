# DATA_SYNC_PLAN.md — AI Model Explorer V4 数据维护能力升级方案

> 状态：**方案已定稿，未实施（暂不写代码）**
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
- [ ] `collectors/` 含 `_base` / `_registry` / `_config` + 4 个 Adapter；`loadCollectors()` 发现且仅发现这 4 个。
- [ ] `run_collectors` 只跑 `_config.enabled`；某源抛错时**其余源仍产出、报告标注失败源**。
- [ ] `normalize` 输出**仅含白名单客观字段**；定性字段在 `data/` 中原样保留（抽查 1 条确认）。
- [ ] `validate_schema` 通过；`data_source_type:"third_party_list"` 的记录**无法**置 `free:true`。
- [ ] `diff_data` 生成 `DATA_UPDATE_REPORT.md`，含新增 / 价格变动 / 弃用摘要。
- [ ] `data-sync.yml` 手动触发：有 diff → 推 `data-staging` 分支 + 建 Issue；**无自动 PR、无自动改主数据**；校验失败 → 建 Issue 告警。
- [ ] 人工确认后 `apply_staging.cjs` 合入，`data/` 更新、本地 `8848` 刷新可见新值。

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

## 6. GitHub Actions 设计（`data-sync.yml`，Phase 1）

```yaml
name: Data Sync
on:
  schedule:
    - cron: '23 3 * * 1'        # 每周一 03:23 UTC（避开整点，非每日）
  workflow_dispatch:            # 手动触发
permissions:
  contents: write
  issues: write
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4        # node 20
      - name: 运行 Collectors（仅启用源）
        run: node scripts/run_collectors.cjs --config collectors/_config.json
      - name: Schema 校验（失败即阻断）
        run: node scripts/validate_schema.cjs
      - name: 生成差异报告
        run: node scripts/diff_data.cjs --write-staging
      - name: 有变更 → 推 staging 分支 + 建 Issue 通知（不开 PR）
        if: success()
        env: { GH_TOKEN: ${{ github.token }} }
        run: |
          git config user.email "bot@github.com"; git config user.name "data-sync"
          git checkout -B data-staging
          git add data/.staging/
          git commit -m "chore: data staging $(date +%F)" || exit 0
          git push -f origin data-staging
          gh issue create --title "数据同步差异 $(date +%F)" \
            --body "$(cat data/.staging/DATA_UPDATE_REPORT.md)" || true
      - name: 异常告警
        if: failure()
        env: { GH_TOKEN: ${{ github.token }} }
        run: gh issue create --title "数据同步异常 $(date +%F)" --body "见 run log"
```

**关键约束（对应调整 #1/#3/#7）**
- **不开 PR、不自动改主数据**；Phase 1 只产出报告 + staging 分支 + Issue 通知。
- 合并后由现有 `deploy.sh`（手动 rsync）落地，自动部署留后续阶段。
- 单源失败被 `run_collectors` 捕获，不整 job 失败；仅 Schema 校验失败才阻断。
- 频率：**每周一 + 手动**，非每日。

---

## 7. 分层实施路线图

| 阶段 | 内容 | 自动化程度 | 厂商范围 |
|---|---|---|---|
| **Phase 0** | Schema 契约 + 溯源字段 + 校验 + 回归 | 无（纯地基） | — |
| **Phase 1** | Collector 插件闭环 + Diff 报告 + 人工确认 | 产出报告，**人合入** | OpenAI / Anthropic / Google Gemini / NVIDIA |
| **Phase 2** | 自动开 PR（不自动合并）+ 扩展 Cloudflare / HuggingFace | PR + 人审 | +2 |
| **Phase 3** | 安全自动合并（仅价格/辅助字段，默认关）+ 扩展 DeepSeek / Qwen / 智谱 / Groq / Together / Replicate / fal.ai | 受限自动合并 | +7 |
| **Phase 4** | 监控/告警/免费层监控/弃用检测 + 自动部署 job | 闭环 | 全量 |

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
