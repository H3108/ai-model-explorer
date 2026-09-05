#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# AI Model Explorer · 静态资源版本号注入（缓存加固）
#
# 背景：线上 index.html 用 <script src="app.js"> 无版本号，且 nginx 未下发
#       Cache-Control / ETag / Last-Modified，浏览器走启发式缓存 → 发版后
#       用户仍加载旧 JS（2026-09-05 连续踩两次：排序按钮、family 默认顺序）。
#
# 做法：给入口引用 + 全部 ESM 相对 import 打上 ?v=<git sha>。sha 随每次提交
#       变化 → URL 变化 → 浏览器必然拉新文件；同一 commit 重复部署版本号不变，
#       仍可命中缓存。
#
# 覆盖范围（共 18 处）：
#   index.html   2 处：styles.css、app.js
#   app.js       2 处：./src/store.js、./src/router.js
#   src/*.js    14 处：相互 import（含多行 import，按 from './x.js' 行匹配）
#
# 幂等：重复执行会把已有的 ?v=xxx 替换为当前值，不会追加成 ?v=a?v=b。
# 跨平台：不用 sed -i（BSD/GNU 语义不同），改用临时文件中转。
# 坑：sed 规则不能用数组存再 "${arr[@]}" 展开——引号会被字面化传给 sed，
#     导致规则静默失效（表现为「没替换但不报错」）。统一走下面的函数。
#
# 用法：
#   bash scripts/bump_version.sh              # 版本号取 git rev-parse --short=8 HEAD
#   bash scripts/bump_version.sh <版本号>      # 指定版本号
#   bash scripts/bump_version.sh --dry-run     # 只打印注入后的目标行，不写文件
# ───────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

# —— 解析参数 ——
DRY=""
V=""
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY=1 ;;
    -*) echo "未知参数：${arg}" >&2; exit 1 ;;
    *) V="${arg}" ;;
  esac
done

# —— 版本号：优先入参 → git sha → 时间戳兜底 ——
if [[ -z "${V}" ]]; then
  V="$(git rev-parse --short=8 HEAD 2>/dev/null || true)"
fi
if [[ -z "${V}" ]]; then
  V="$(date +%s)"
fi

# 注入规则：字面问号统一写 [?]，避免 ERE 下 \? 的未定义行为
bump_stream() {
  sed -E \
    -e "s|(from '\./[^']+\.js)([?]v=[^']*)?'|\1?v=${V}'|g" \
    -e "s|(from \"\./[^\"]+\.js)([?]v=[^\"]*)?\"|\1?v=${V}\"|g" \
    -e "s|(href=\"styles\.css)([?]v=[^\"]*)?\"|\1?v=${V}\"|g" \
    -e "s|(src=\"app\.js)([?]v=[^\"]*)?\"|\1?v=${V}\"|g"
}

FILES=(index.html app.js)
for f in src/*.js; do
  [[ -f "${f}" ]] && FILES+=("${f}")
done

echo "→ 静态资源版本号注入 v=${V}${DRY:+（dry-run，不写文件）}"

changed=0
for f in "${FILES[@]}"; do
  [[ -f "${f}" ]] || continue
  tmp="$(mktemp)"
  bump_stream < "${f}" > "${tmp}"

  if [[ -n "${DRY}" ]]; then
    hits="$(grep -E "from ['\"]\./|href=\"styles\.css|src=\"app\.js" "${tmp}" || true)"
    if [[ -n "${hits}" ]]; then
      echo "  · ${f}"
      echo "${hits}" | sed 's/^/      /'
    fi
    rm -f "${tmp}"
    continue
  fi

  if ! cmp -s "${tmp}" "${f}"; then
    mv "${tmp}" "${f}"
    changed=$((changed + 1))
  else
    rm -f "${tmp}"
  fi
done

if [[ -n "${DRY}" ]]; then
  echo "✓ dry-run 结束（未写文件）"
else
  echo "✓ 版本注入完成，改动 ${changed} 个文件"
fi
