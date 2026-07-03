#!/usr/bin/env bash
# PostCraft 测试环境前端安装脚本（在测试 EC2 上执行）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${POSTCRAFT_ROOT:-$SCRIPT_DIR/..}" && pwd)"
PORT="${POSTCRAFT_WEB_PORT:-3002}"

write_default_env_production() {
  cat > .env.production <<'EOF'
NEXT_PUBLIC_API_URL=https://postcrafttest.studyx.ai/api
NEXT_PUBLIC_SITE_URL=https://postcraft.studyx.ai
EOF
  echo "Created .env.production with default subdomain values"
}

if [[ ! -d "$ROOT/frontend" ]]; then
  echo "ERROR: frontend not found at $ROOT/frontend"
  echo "       Set POSTCRAFT_ROOT to your repo path, e.g.:"
  echo "       POSTCRAFT_ROOT=/opt/PostCraft bash $0"
  exit 1
fi

echo "==> PostCraft frontend install (root: $ROOT, port: $PORT)"

cd "$ROOT/frontend"

if [[ "${POSTCRAFT_REFRESH_ENV:-}" == "1" ]] || [[ ! -f .env.production ]]; then
  if [[ -f .env.test.example ]]; then
    cp .env.test.example .env.production
    echo "Wrote .env.production from .env.test.example"
  else
    write_default_env_production
  fi
else
  echo "Using existing .env.production (set POSTCRAFT_REFRESH_ENV=1 to overwrite)"
fi

npm ci
npm run build

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete postcraft-web 2>/dev/null || true
  PORT="$PORT" pm2 start npm --name postcraft-web -- start
  pm2 save
  echo "==> Frontend started via PM2 on port $PORT"
else
  echo "PM2 not found. Start manually:"
  echo "  cd $ROOT/frontend && PORT=$PORT npm start"
fi
