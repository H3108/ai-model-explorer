# 部署与数据同步方案（AI Model Explorer）

纯静态 SPA：零依赖、零构建、零后端。所有「页面逻辑」由浏览器原生 ES Module 加载，`fetch` 本地 `data/*.json` 渲染。因此**部署 = 把仓库文件镜像到服务器**，而**数据更新 = 更新仓库里的 JSON 再重新部署**。本文给出两套可直接复制执行的方案。

---

## 一、海外服务器部署（静态托管）

目标服务器（示例，按你的实际信息替换）：
- 主机：`hush-3108-server.evoxt.com`（IP `23.27.49.225`）
- 现有栈：`nginx(:80)` + `xray(:443)`，Caddy 不可用
- 约定：xray 在 443 终止 TLS 后转发到 nginx(:80)，对齐 `www.hush7.online` 模式
- 建议子域名：`models.hush7.online`

### 1.1 首次部署（本地执行）

```bash
# 配置（可写入 ~/.zshrc 或每次前缀）
export DEPLOY_HOST=hush-3108-server.evoxt.com
export DEPLOY_USER=hush
export DEPLOY_PATH=/var/www/ai-model-explorer

# 一键镜像（排除 .git / docs / backup / .workbuddy 等）
npm run deploy
```

`scripts/deploy.sh` 会：建目录 → 备份上一版到 `<path>.old` → `rsync --delete` 镜像。

### 1.2 nginx 虚拟主机（在服务器上执行）

把 `deploy/nginx-ai-model-explorer.conf` 传到服务器并启用：

```bash
# 在服务器
sudo cp ~/nginx-ai-model-explorer.conf /etc/nginx/sites-available/ai-model-explorer.conf
sudo ln -sf /etc/nginx/sites-available/ai-model-explorer.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> 记得把 `server_name` 和 `root` 改成你的子域名与 `DEPLOY_PATH`。
> TLS 由 xray 在 443 层处理；若你的 xray 入站是「转发到 nginx:80」的标准模式，以上 vhost 即可直接用。

### 1.3 验证

```bash
curl -I http://localhost/            # 服务器本机
# 浏览器打开 https://models.hush7.online
```

---

## 二、数据更新同步方案

### 2.1 核心原则：**Git 即唯一真相源**

数据不是运行时数据库，而是仓库内的 `data/*.json`。所以「同步数据」与「部署站点」是同一件事——把仓库镜像到服务器，数据自然就同步了。没有独立的数据管道、没有服务端写入。

### 2.2 本地更新六步（日常）

```bash
# ① 编辑数据：data/model_variants.json / model_variants_extra.json 等
# ② 刷新核验日期（让首页“数据于 X 联网核实”自动跟随）
npm run bump -- --all            # 或 --provider openai
# ③ 四门回归必须全绿
npm test
# ④ 提交（带语义化 message，便于回滚）
git commit -am "data: 更新 X 价格 / 新增 Y 模型"
# ⑤ 推到 GitHub（源真相 + 备份）
git push
# ⑥ 部署到海外服务器（数据随之生效）
npm run deploy
```

### 2.3 自动化选项

| 方式 | 适用 | 做法 |
|------|------|------|
| **A. 手动（推荐起步）** | 控制力强、改动不频繁 | 上面的六步手动跑 |
| **B. GitHub Actions 自动部署** | 想要 push 即生效 | 在 push 到 master 后，CI 校验通过 → 用 SSH deploy key `rsync` 到服务器（需配置 `DEPLOY_HOST/USER/KEY` 三个 Secrets）。本仓库未默认启用，需要时加 `.github/workflows/deploy.yml` |
| **C. 周一定时复核** | 防止数据过期 | CI 已配置 `cron '17 9 * * 1'` 跑 `model_quality_check.py`（`continue-on-error`，只告警不阻断） |

### 2.4 回滚

- **数据回滚**：每次更新都是一次 git commit → `git revert <bad_commit>` 再 `npm run deploy`。
- **服务器回滚**：`deploy.sh` 每轮部署前会保留 `<path>.old`；紧急时可 `cp -r <path>.old <path> && nginx -s reload`。

### 2.5 防回归守卫（已内置）

- `scripts/validate_normalized.cjs`：扫描全仓源码，**禁止写死核验日期**（必须走 `dataMeta`）；并提示「最近核验距今 N 天」是否超期。
- 首页 / 页脚 / 信任区显示的数据日期，全部从 `verified_date` 计算，改数据即可自动更新，无需动代码。
- `scripts/bump_verified.cjs`：批量更新 `verified_date`，支持 `--provider` / `--all` / `--dry-run`，避免手工改日期出错。

---

## 三、推送 GitHub 前的检查清单 ✅

- [x] `LICENSE`（MIT）已就位
- [x] `.gitignore` 已排除 `.workbuddy/ docs/ backup/ .env / 密钥文件`
- [x] 全仓已扫描，源码无写死密钥 / 日期
- [x] 根目录 `README.md` 为对外版本；`docs/` 不进库
- [x] CI（`.github/workflows/ci.yml`）覆盖语法 + 数据校验 + 周一复核
- [ ] 配置 remote 并首次 `git push -u origin master`
- [ ] 本地 `python3 -m http.server 8848` 自测 OK（端口若被回收，重启即可）

> 注：本项目不启用 CloudStudio 自动预览，纯本地 `localhost:8848` 查看。
