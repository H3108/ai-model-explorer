# Model Explorer 数据治理与质量提升方案 v1.0

## 项目目标

对当前 Model Explorer AI 模型数据库进行全面治理。

目标：

- 保留已有数据资产
- 清理低质量数据
- 建立统一模型数据结构
- 建立模型生命周期管理
- 建立数据质量评分体系
- 为未来 AI 模型推荐、智能路由、API 聚合系统提供可靠数据基础

核心原则：

> 不删除历史数据，通过状态管理、归档、评分方式治理数据。

---

# 1. 数据治理原则

## 禁止操作

禁止：

- 直接删除模型记录
- 删除历史版本
- 覆盖原始数据
- 合并后丢失 alias 信息


## 推荐方式

采用：

```

active
deprecated
experimental
archived
unknown

```

生命周期管理。


---

# 2. 数据审计

## 创建数据审计流程

扫描当前数据库：

检查：

- 模型总数量
- 厂商数量
- 重复模型
- 缺失字段
- 无来源模型
- 废弃模型
- 错误数据


生成：

```

DATA_AUDIT_REPORT.md

````


报告内容：

```text
模型总数量:

有效模型:

重复模型:

待归档模型:

字段完整率:

数据质量平均分:
````

---

# 3. 模型状态管理

新增字段：

```sql
status
```

状态：

| 状态           | 说明          |
| ------------ | ----------- |
| active       | 正常使用模型      |
| deprecated   | 官方停止推荐但仍可查询 |
| experimental | 实验测试模型      |
| archived     | 历史归档模型      |
| unknown      | 信息不足模型      |

示例：

```
GPT-5
status:
active


Claude 2
status:
deprecated
```

---

# 4. 数据质量评分系统

新增字段：

```sql
data_quality_score
```

范围：

```
0-100
```

## 评分规则

### 基础信息 30分

| 项目   | 分值 |
| ---- | -: |
| 模型名称 | 10 |
| 厂商信息 | 10 |
| 官方链接 | 10 |

### 技术参数 30分

| 项目     | 分值 |
| ------ | -: |
| 参数规模   |  5 |
| 上下文长度  | 10 |
| 输入输出能力 |  5 |
| 支持能力   | 10 |

### API信息 25分

| 项目    | 分值 |
| ----- | -: |
| API地址 | 10 |
| 价格信息  | 10 |
| 调用方式  |  5 |

### 生态信息 15分

| 项目        | 分值 |
| --------- | -: |
| Benchmark |  5 |
| 开源地址      |  5 |
| 更新时间      |  5 |

---

## 数据等级

| 分数     | 等级 | 处理    |
| ------ | -- | ----- |
| 90-100 | A  | 优先展示  |
| 70-89  | B  | 正常展示  |
| 50-69  | C  | 降低权重  |
| <50    | D  | 隐藏或归档 |

---

# 5. 模型去重系统

创建：

```
model_aliases
```

结构：

```sql
id

model_id

alias

source
```

示例：

合并：

```
qwen2.5-72b

Qwen2.5 72B

Alibaba Qwen2.5 72B
```

统一：

```
Qwen2.5-72B-Instruct
```

保留：

```
alias搜索能力
```

---

# 6. 模型版本管理

创建：

```
model_versions
```

字段：

```sql
id

model_id

version

release_date

status

context_length

notes
```

示例：

```
GPT-5

 ├── GPT-5-2026-08-01
 |
 └── GPT-5-mini-2026-08-01
```

不同版本不要混合。

---

# 7. 厂商数据标准化

统一：

```
providers
```

字段：

```sql
id

name

country

website

api_url

logo

description
```

重点覆盖：

* OpenAI
* Anthropic
* Google
* Microsoft
* Meta
* Alibaba
* DeepSeek
* Zhipu AI
* Moonshot
* MiniMax
* ByteDance
* Baidu

---

# 8. 模型能力标签系统

新增：

```
capabilities
```

标签：

```
text_generation

reasoning

coding

vision

audio

embedding

rerank

image_generation

video_generation

agent

multimodal
```

示例：

GPT-5：

```
reasoning

coding

text_generation

multimodal
```

BGE-Reranker：

```
rerank
```

---

# 9. 数据来源管理

新增：

```
data_source
```

来源：

```
official

huggingface

github

community

manual
```

新增：

```
last_verified_at
```

记录：

最后验证时间。

---

# 10. 数据库结构优化

推荐结构：

```
providers

    |

models

    |

model_versions

    |

pricing

benchmark

api_endpoint

capabilities

aliases
```

避免单表存储所有信息。

---

# 11. 前端展示优化

首页不要展示全部模型。

调整为：

## 推荐模型

按照：

* 数据质量
* 使用热度
* API可用性

排序。

---

## 按用途选择

分类：

```
写作

编程

推理

图片

视频

Embedding

RAG

Agent
```

---

## 高级筛选

支持：

```
厂商

价格

Context长度

开源状态

能力标签

质量评分

API状态
```

---

# 12. 自动化数据维护

新增脚本：

```
scripts/model_quality_check.py
```

每日检查：

* 新模型
* 模型更新
* API变化
* 价格变化
* 废弃模型
* 数据异常

生成：

```
daily_model_update_report.md
```

---

# 13. 最终交付

完成后生成：

```
DATA_GOVERNANCE_REPORT.md
```

必须包含：

## 数据统计

修改前：

```
模型数量:
厂商数量:
```

修改后：

```
模型数量:
有效模型:
归档模型:
```

---

## 数据质量结果

包含：

* 平均质量评分
* A/B/C/D等级数量

---

## 数据处理结果

包含：

* 合并模型数量
* alias数量
* 归档模型数量
* 修复字段数量

---

# 14. 验收标准

必须满足：

✅ 无历史数据丢失

✅ 模型状态体系完成

✅ 模型质量评分完成

✅ 重复模型处理完成

✅ 厂商数据统一

✅ 模型能力标签完成

✅ 支持未来 AI 推荐系统

✅ 支持智能 API Router

---

# Version

Version:

v1.0

Purpose:

Model Explorer 数据治理基础版本

Future:

v2.0

增加：

* 自动爬取
* AI数据审核
* 模型推荐算法
* 智能路由评分
* 成本优化系统