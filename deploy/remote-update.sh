#!/usr/bin/env bash
# PostCraft 测试环境远程更新（在测试 EC2 上执行，或由 CI SSH 调用）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${POSTCRAFT_ROOT:-$SCRIPT_DIR/..}" && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"

DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false
REFRESH_ENV=false
AUTO=false
SKIP_PULL=false
SKIP_VERIFY=false

usage() {
  cat <<EOF
Usage: POSTCRAFT_ROOT=/opt/PostCraft bash deploy/remote-update.sh [options]

Options:
  --auto           根据最近一次 git 变更自动选择前后端（默认用于 CI）
  --all            部署前后端
  --backend        仅部署后端
  --frontend       仅部署前端
  --refresh-env    重装前端时覆盖 .env.production
  --skip-pull      跳过 git pull（CI 已拉取时使用）
  --skip-verify    跳过 verify-test.sh
  -h, --help       显示帮助

Examples:
  bash deploy/remote-update.sh --auto
  bash deploy/remote-update.sh --all --refresh-env
  bash deploy/remote-update.sh --frontend
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto) AUTO=true; shift ;;
    --all) DEPLOY_BACKEND=true; DEPLOY_FRONTEND=true; shift ;;
    --backend) DEPLOY_BACKEND=true; shift ;;
    --frontend) DEPLOY_FRONTEND=true; shift ;;
    --refresh-env) REFRESH_ENV=true; shift ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    --skip-verify) SKIP_VERIFY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if ! $AUTO && ! $DEPLOY_BACKEND && ! $DEPLOY_FRONTEND; then
  echo "ERROR: specify --auto, --all, --backend, and/or --frontend"
  usage
  exit 1
fi

cd "$ROOT"

if ! $SKIP_PULL; then
  echo "==> git pull ($BRANCH)"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

if $AUTO; then
  if git rev-parse HEAD@{1} >/dev/null 2>&1; then
    changed="$(git diff --name-only HEAD@{1} HEAD || true)"
  elif git rev-parse HEAD~1 >/dev/null 2>&1; then
    changed="$(git diff --name-only HEAD~1 HEAD || true)"
  else
    changed=""
  fi

  echo "==> Changed files:"
  if [[ -n "$changed" ]]; then
    echo "$changed" | sed 's/^/    /'
  else
    echo "    (none detected — will deploy both)"
  fi

  if echo "$changed" | grep -qE '^(backend/|\.env\.test\.example|deploy/postcraft\.service)'; then
    DEPLOY_BACKEND=true
  fi
  if echo "$changed" | grep -qE '^frontend/'; then
    DEPLOY_FRONTEND=true
  fi
  if echo "$changed" | grep -qE '^frontend/\.env\.test\.example|^deploy/install-frontend\.sh'; then
    REFRESH_ENV=true
  fi

  if ! $DEPLOY_BACKEND && ! $DEPLOY_FRONTEND; then
    DEPLOY_BACKEND=true
    DEPLOY_FRONTEND=true
  fi
fi

echo "==> Deploy plan"
echo "    backend:     $DEPLOY_BACKEND"
echo "    frontend:    $DEPLOY_FRONTEND"
echo "    refresh_env: $REFRESH_ENV"

if $DEPLOY_BACKEND; then
  POSTCRAFT_ROOT="$ROOT" bash "$ROOT/deploy/install-backend.sh"
fi

if $DEPLOY_FRONTEND; then
  if $REFRESH_ENV; then
    export POSTCRAFT_REFRESH_ENV=1
  fi
  POSTCRAFT_ROOT="$ROOT" bash "$ROOT/deploy/install-frontend.sh"
fi

if ! $SKIP_VERIFY; then
  bash "$ROOT/deploy/verify-test.sh"
fi

echo "==> Remote update complete"
