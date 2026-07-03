#!/usr/bin/env bash
# PostCraft 测试环境部署验证
set -euo pipefail

API_LOCAL="${API_LOCAL:-http://127.0.0.1:18231/api}"
API_PUBLIC="${API_PUBLIC:-https://postcrafttest.studyx.ai/api}"
WEB_PUBLIC="${WEB_PUBLIC:-https://postcraft.studyx.ai}"
ORIGIN="${CORS_ORIGIN:-https://postcraft.studyx.ai}"

pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "[OK] $name"
    pass=$((pass + 1))
  else
    echo "[FAIL] $name"
    fail=$((fail + 1))
  fi
}

echo "==> PostCraft test environment verification"
echo

# Local health (on EC2)
if curl -sf "${API_LOCAL}/health" >/dev/null 2>&1; then
  check "Local API health ($API_LOCAL/health)" true
else
  check "Local API health ($API_LOCAL/health)" false
  echo "      Hint: systemctl status postcraft"
fi

# Public health (after nginx)
if curl -sf "${API_PUBLIC}/health" >/dev/null 2>&1; then
  check "Public API health ($API_PUBLIC/health)" true
else
  check "Public API health ($API_PUBLIC/health)" false
  echo "      Hint: check nginx server_name postcrafttest.studyx.ai"
fi

# Auth config
auth_cfg=$(curl -sf "${API_PUBLIC}/auth/config" 2>/dev/null || true)
if echo "$auth_cfg" | grep -q '"auth_required"'; then
  check "Auth config endpoint ($API_PUBLIC/auth/config)" true
else
  check "Auth config endpoint ($API_PUBLIC/auth/config)" false
fi

# Protected API should reject anonymous access when auth is required
projects_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_PUBLIC}/projects" 2>/dev/null || echo "000")
if [[ "$projects_code" == "401" ]] || [[ "$projects_code" == "200" ]]; then
  check "Projects API access control (HTTP $projects_code)" true
else
  check "Projects API access control (HTTP $projects_code)" false
  echo "      Hint: expect 401 when AUTH_REQUIRED=true, 200 when false"
fi

# CORS preflight
cors_headers=$(curl -sI -X OPTIONS \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  "${API_PUBLIC}/health" 2>/dev/null || true)
if echo "$cors_headers" | grep -qi "access-control-allow-origin"; then
  check "CORS headers for Origin=${ORIGIN}" true
else
  check "CORS headers for Origin=${ORIGIN}" false
  echo "      Hint: add origin to CORS_ORIGINS in .env"
fi

# Frontend reachable
if curl -sf -o /dev/null "${WEB_PUBLIC}" 2>/dev/null; then
  check "Frontend reachable ($WEB_PUBLIC)" true
else
  check "Frontend reachable ($WEB_PUBLIC)" false
  echo "      Hint: pm2 status postcraft-web && nginx server_name postcraft.studyx.ai"
fi

# systemd active
if systemctl is-active --quiet postcraft 2>/dev/null; then
  check "systemd postcraft service active" true
else
  check "systemd postcraft service active" false
fi

# api_keys file
keys_path="${API_KEYS_FILE:-/opt/PostCraft/config/api_keys.local.json}"
if [[ -f "$keys_path" ]] || [[ -L "$keys_path" ]]; then
  check "api_keys.local.json present ($keys_path)" true
else
  check "api_keys.local.json present ($keys_path)" false
fi

echo
echo "==> Results: ${pass} passed, ${fail} failed"
echo
echo "Manual UI check:"
echo "  1. Open ${WEB_PUBLIC}"
echo "  2. Create/open a project and send 「生成封面配图」"
echo "  3. Confirm image_url ends with .png (not placeholder-*.svg)"
echo "  4. journalctl -u postcraft -f — no ip_not_authorized"

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
