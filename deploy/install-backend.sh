#!/usr/bin/env bash
# PostCraft 测试环境后端安装脚本（在测试 EC2 上执行）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${POSTCRAFT_ROOT:-$SCRIPT_DIR/..}" && pwd)"
STUDYX_KEYS="${STUDYX_API_KEYS:-/opt/studyx-agent-backend/config/api_keys.local.json}"

if [[ ! -d "$ROOT/backend" ]]; then
  echo "ERROR: backend not found at $ROOT/backend"
  echo "       Set POSTCRAFT_ROOT to your repo path, e.g.:"
  echo "       POSTCRAFT_ROOT=/opt/PostCraft bash $0"
  exit 1
fi

echo "==> PostCraft backend install (root: $ROOT)"

cd "$ROOT/backend"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements.txt

mkdir -p "$ROOT/data/images" "$ROOT/config"

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.test.example" "$ROOT/.env"
  echo "Created $ROOT/.env — please edit DEEPSEEK_API_KEY before starting service."
fi

if [[ -f "$STUDYX_KEYS" ]]; then
  if [[ ! -f "$ROOT/config/api_keys.local.json" && ! -L "$ROOT/config/api_keys.local.json" ]]; then
    ln -sf "$STUDYX_KEYS" "$ROOT/config/api_keys.local.json"
    echo "Linked api_keys.local.json -> $STUDYX_KEYS"
  fi
else
  echo "WARN: studyx keys not found at $STUDYX_KEYS"
  echo "      Set API_KEYS_FILE in $ROOT/.env or create config/api_keys.local.json"
fi

sed "s|@POSTCRAFT_ROOT@|$ROOT|g" "$ROOT/deploy/postcraft.service" \
  | sudo tee /etc/systemd/system/postcraft.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable postcraft
sudo systemctl restart postcraft

sleep 2
curl -sf "http://127.0.0.1:18231/api/health" && echo
echo "==> Backend ready on 127.0.0.1:18231"
