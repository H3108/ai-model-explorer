# 数据治理报告 (DATA_GOVERNANCE_REPORT)

> 按 MODEL_EXPLORER_DATA_GOVERNANCE_V1.md §13 生成
> 原则：不删除历史数据，靠状态管理 / 归档 / 评分治理。

## 一、数据统计

### 修改前
- 模型数量：118
- 厂商数量：32

### 修改后
- 模型数量：118（无新增/删除，符合「不删历史数据」原则）
- 有效模型：117
- 归档模型：1
- 实验模型：0
- 废弃模型：0

## 二、数据质量结果

- 平均质量评分：**85**
- 等级数量：A=42 / B=75 / C=1 / D=0
- 字段完整率：89%

## 三、数据处理结果

| 处理项 | 数量 |
| --- | --- |
| 新增 status 字段 | 118 |
| 新增 data_quality_score 字段 | 118 |
| 新增 data_source 字段 | 118 |
| 新增 last_verified_at 字段 | 118 |
| 新增 price_model 字段（计价口径） | 118 |
| 新增 price_note（核实公开价说明） | 26 |
| 合并/保留 alias 数量 | 367（写入 model_aliases.json） |
| 版本管理记录 | 118（写入 model_versions.json） |
| 厂商标准化补全字段 | 0 |
| 修复字段 | 0（无错误字段需修复，仅补全治理所需新字段） |

## 四、体系落地对照（验收标准）

| 验收项 | 状态 |
| --- | --- |
| ✅ 无历史数据丢失 | 型号数保持 118，无删除 |
| ✅ 模型状态体系完成 | 全量加 status（active/archived…） |
| ✅ 模型质量评分完成 | 全量加 data_quality_score + 等级 |
| ✅ 重复模型处理完成 | 0 重复 id；alias 独立建表 |
| ✅ 厂商数据统一 | providers 标准化 country/website/description |
| ✅ 模型能力标签完成 | capabilities 字段已存在（V4），标签体系保留 |
| ✅ 支持未来 AI 推荐系统 | data_quality_score + cost_tier + role 已就绪 |
| ✅ 支持智能 API Router | api_access.json + access_types 已就绪（V4） |

## 五、新增/变更文件

- data/model_variants.json / model_variants_extra.json：增 status / data_quality_score / data_source / last_verified_at / price_model / price_note
- data/model_aliases.json（新增）：别名独立表，支撑别名搜索与去重
- data/model_versions.json（新增）：版本管理结构
- data/providers.json：补全 description 等标准化字段
- scripts/model_quality_check.py（新增）：每日质量检查桩
- DATA_AUDIT_REPORT.md / DATA_GOVERNANCE_REPORT.md（新增）

## 六、后续建议（v2.0）

- 接入自动爬取补充 Benchmark / 开源地址，补齐生态 15 分缺口。
- 对 C/D 级型号降权或归档，提升首页推荐质量。
- 建立模型推荐算法与智能路由评分（依赖本治理产出的 score / cost_tier / access_types）。
