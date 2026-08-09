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
# 本地默认：用已配好的 ssh 别名 hush-server（root@IP，已知可用），密钥走 ssh 默认发现
# Actions：由 DEPLOY_USER/DEPLOY_HOST/DEPLOY_KEY 三个 secret 覆盖
SERVER_USER="${DEPLOY_USER:-root}"
SERVER_HOST="${DEPLOY_HOST:-hush-server}"
SERVER_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/ai-model-explorer}"    # 与 nginx root 一致
SSH_KEY="${DEPLOY_KEY:-}"                                   # 本地留空→用默认密钥；Actions 用 secret

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

# 组装 ssh 选项（仅设置了密钥时才加 -i，避免指定不存在的 id_ed25519）
SSH_OPTS=(-p "${SERVER_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=15)
if [[ -n "${SSH_KEY}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
fi

# 先在远端建目录（不存在则建），并保留上一版便于回滚
ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_HOST}" \
  "mkdir -p ${DEPLOY_PATH} && rm -rf ${DEPLOY_PATH}.old && cp -r ${DEPLOY_PATH} ${DEPLOY_PATH}.old 2>/dev/null || true"

# 镜像同步（--delete 保证服务器与本地完全一致）
rsync -avz --delete "${EXCLUDES[@]}" \
  -e "ssh ${SSH_OPTS[*]}" \
  ./ "${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/"

echo "✓ 部署完成。刷新你的子域名即可看到更新。"
