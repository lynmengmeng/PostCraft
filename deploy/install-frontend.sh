#!/usr/bin/env bash
# PostCraft 测试环境前端安装脚本（在测试 EC2 上执行）
set -euo pipefail

ROOT="${POSTCRAFT_ROOT:-/opt/postcraft}"
PORT="${POSTCRAFT_WEB_PORT:-3002}"

echo "==> PostCraft frontend install (root: $ROOT, port: $PORT)"

cd "$ROOT/frontend"

if [[ ! -f .env.production ]]; then
  cp .env.test.example .env.production
  echo "Created .env.production from .env.test.example"
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
