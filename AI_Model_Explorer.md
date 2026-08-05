# AI Model Explorer V1.0

## 大模型导航、选型与 API 调用助手

Version: 1.0.0

Status: Development

---

# 1. 项目介绍

## 1.1 项目名称

AI Model Explorer

中文名称：

大模型导航与 API 选型助手


---

## 1.2 项目目标

构建一个面向：

- AI 初学者
- 开发者
- 产品经理
- AI 应用开发者

的大模型知识导航平台。


解决用户以下问题：

1. 现在有哪些大模型？
2. 每个模型属于哪个公司？
3. 国内国外模型有什么区别？
4. 每个模型适合什么场景？
5. 应该选择哪个模型？
6. API 怎么调用？


---

# 2. 产品定位


本项目不是：

- 大模型排行榜
- 专业评测平台
- 自动Benchmark系统


本项目定位：

## AI模型知识地图

## AI模型选择助手

## API调用参考中心


---

# 3. 核心功能


# 3.1 模型知识库


展示全球主流模型：

国外：

- OpenAI
- Anthropic
- Google
- Meta
- Mistral


国内：

- DeepSeek
- 阿里通义千问
- 智谱
- Kimi
- 百度
- MiniMax


第一版：

50-100个模型。


---

# 3.2 模型信息卡片


每个模型包含：

## 基础信息

- 模型名称
- 厂商
- 国家
- 发布时间
- 开源/闭源
- 模型类型


---

## 能力标签


例如：

- Coding
- Reasoning
- Agent
- Long Context
- Multimodal
- Chinese
- Low Cost


---

## 参数信息


包含：

- Context Window
- 输入价格
- 输出价格
- 参数规模(如果公开)


---

## 使用建议


展示：

适合：

- 编程
- 写作
- Agent
- 企业应用


不适合：

- 本地部署
- 低成本场景


---

# 3.3 API调用信息


每个模型必须包含：


## Provider


例如：

OpenAI


## Base URL


例如：

https://api.openai.com/v1


## Model ID


例如：

gpt-5


## 示例代码


支持：

Python


JavaScript


curl


---

# 3.4 场景推荐


用户选择：

我要做什么？


选项：

- 写代码
- 写文章
- 学习AI
- 开发Agent
- 企业应用
- 低成本API
- 本地部署


系统根据标签推荐模型。


第一版采用规则推荐。


---

# 4. 数据设计


数据目录：


data/


models.json

providers.json

scenarios.json


---

## models.json


结构：


{
"id":"",

"name":"",

"provider":"",

"country":"",

"open_source":false,


"category":[],

"context_window":"",

"pricing":{

"input":"",

"output":""

},


"strengths":[],

"weakness":[],

"use_cases":[],

"api":{

"provider":"",

"base_url":"",

"model":""

},


"compatible":[],

"last_checked":""

}


---

# 5. 技术架构


## Frontend


技术：

HTML5

Tailwind CSS

JavaScript


不使用复杂框架。


原因：

第一版以快速验证为目标。


---

## Data Layer


使用：

JSON文件


不使用：

MySQL

MongoDB


---

## Deployment


支持：

Cloudflare Pages

Vercel


---

# 6. 项目结构


ai-model-explorer/


├── index.html

├── README.md


├── assets/


├── css/

│   └── style.css


├── js/

│   ├── app.js

│   ├── filter.js

│   └── recommend.js


├── data/

│   ├── models.json

│   ├── providers.json

│   └── scenarios.json


└── docs/


---

# 7. 页面设计


## 首页


包含：

搜索

分类导航

热门模型


---

## 模型列表


支持：

搜索

过滤

排序


过滤条件：

- 国内
- 国外
- 开源
- 闭源
- Coding
- Agent
- 多模态


---

## 模型详情


展示：

完整模型信息

API信息

代码示例


---

## 推荐页面


根据用户需求：

返回模型建议。


---

# 8. 第一版限制


不要实现：

- 用户系统
- 数据库
- 自动爬虫
- 在线聊天
- API代理
- 自动评测


---

# 9. 后续规划


## V1.5


增加：

AI数据更新助手


功能：

检查模型变化

生成JSON更新


---

## V2.0


增加：

AI模型顾问Agent


输入：

需求

预算

场景


输出：

模型选择

成本估算

架构建议


---

## V3.0


连接模型路由系统。


架构：


用户请求

↓

智能模型选择

↓

模型Router

↓

API调用

↓

成本统计


---

# 10. 开发要求


要求：

1. 代码结构清晰
2. 数据与代码分离
3. 支持后续Agent扩展
4. README完整
5. 保留版本管理能力

目标：

完成一个可运行的AI模型导航平台V1.0。