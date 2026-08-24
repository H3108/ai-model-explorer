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

# ── 上线前校验（防静默回退，2026-08-24 加固）──
# 根因：之前一次手动部署在本地 collect+apply 出新价后未提交，导致 git 真相源停留在旧价，
#       下次从干净 checkout 部署会把生产静默打回旧价。下面两段把这类故障挡在 rsync 之前。

# 1) 主数据必须存在且为合法 JSON，否则直接中止，避免把破损站点打上生产
ROOT_JSON="data/model_variants.json"
if [[ ! -f "${ROOT_JSON}" ]]; then
  echo "✗ 中止：找不到 ${ROOT_JSON}，部署取消。" >&2
  exit 1
fi
if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "${ROOT_JSON}" 2>/dev/null; then
  echo "✗ 中止：${ROOT_JSON} 不是合法 JSON，部署取消。" >&2
  exit 1
fi

# 2) 检测 data/ 是否有未提交改动：若有，说明本次要发的不是 git 里的"真相源"。
#    部署能成功，但下次从干净 checkout 部署会静默回退。设 DEPLOY_UNCOMMITTED=1 可显式绕过（仅临时验证用）。
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --quiet -- data/ 2>/dev/null || ! git diff --cached --quiet -- data/ 2>/dev/null; then
    echo "⚠️ 警告：data/ 存在未提交改动，本次部署内容与 git 真相源不一致。" >&2
    echo "⚠️ 这会把未提交数据打上生产；建议先『git add data/ && git commit』，否则下次干净部署会静默回退。" >&2
    if [[ "${DEPLOY_UNCOMMITTED:-}" != "1" ]]; then
      echo "✗ 中止（安全第一）。确认要部署未提交数据，请设 DEPLOY_UNCOMMITTED=1 后重试。" >&2
      exit 1
    fi
    echo "→ DEPLOY_UNCOMMITTED=1 已设置，继续部署未提交数据。" >&2
  fi
fi

# 镜像同步（--delete 保证服务器与本地完全一致）
rsync -avz --delete "${EXCLUDES[@]}" \
  -e "ssh ${SSH_OPTS[*]}" \
  ./ "${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/"

echo "✓ 部署完成。刷新你的子域名即可看到更新。"
