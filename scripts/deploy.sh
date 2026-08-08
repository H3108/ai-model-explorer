#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# AI Model Explorer · 部署脚本（本地 → 海外服务器）
# 纯静态站点，无需构建。rsync 镜像整个仓库（排除 .git / docs / 等）。
# 用法：
#   npm run deploy                       # 使用下方默认配置
#   DEPLOY_HOST=1.2.3.4 DEPLOY_USER=root npm run deploy
# ───────────────────────────────────────────────────────────────
set -euo pipefail

# —— 可覆盖的配置（环境变量优先）——
SERVER_USER="${DEPLOY_USER:-hush}"
SERVER_HOST="${DEPLOY_HOST:-hush-3108-server.evoxt.com}"   # 海外服务器
SERVER_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/ai-model-explorer}"    # 与 nginx root 一致
SSH_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519}"

# —— 不进生产目录 ——
EXCLUDES=(
  --exclude='.git'
  --exclude='.workbuddy'
  --exclude='docs'
  --exclude='backup'
  --exclude='.cache'
  --exclude='node_modules'
  --exclude='*.log'
  --exclude='.DS_Store'
)

echo "→ 部署 ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}"

# 先在远端建目录（不存在则建），并保留上一版便于回滚
ssh -p "${SERVER_PORT}" -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_HOST}" \
  "mkdir -p ${DEPLOY_PATH} && rm -rf ${DEPLOY_PATH}.old && cp -r ${DEPLOY_PATH} ${DEPLOY_PATH}.old 2>/dev/null || true"

# 镜像同步（--delete 保证服务器与本地完全一致）
rsync -avz --delete "${EXCLUDES[@]}" \
  -e "ssh -p ${SERVER_PORT} -i ${SSH_KEY}" \
  ./ "${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/"

echo "✓ 部署完成。刷新你的子域名即可看到更新。"
