# PostCraft 测试环境部署指南

在 studyx 同一台测试 EC2 上部署 PostCraft，复用 studyx 的 `api_keys.local.json` 与出口 IP，使 OpenAI 配图可用。

## 架构（路径部署，推荐）

**域名不变**，挂在现有 `test.studyx.ai` 下，无需新增 DNS 子域名：

| 组件 | 地址 | 说明 |
|------|------|------|
| studyx-agent | `13.52.175.51:18230`（已有） | 不动 |
| PostCraft API（内网） | `127.0.0.1:18231` | systemd `postcraft` |
| 对外 API | `https://test.studyx.ai/postcraft-api/api` | nginx `location /postcraft-api/` → 18231 |
| 对外前端 | `https://test.studyx.ai/postcraft` | nginx `location /postcraft/` → PM2 `:3002` |

```
Browser → test.studyx.ai/postcraft          → Next.js (basePath=/postcraft)
Browser → test.studyx.ai/postcraft-api/api → PostCraft API :18231
PostCraft API → api_keys.local.json（与 studyx 共享）→ OpenAI
```

本地开发无法直连 OpenAI（Key 启用了 IP 白名单）时，可将 `frontend/.env.local` 的 `NEXT_PUBLIC_API_URL` 指向测试 API。

## 与运维对齐清单

部署前请与运维确认以下项（可在工单中直接粘贴）：

- [ ] **DNS**：无需新记录，复用 `test.studyx.ai`
- [ ] **nginx**：在 `test.studyx.ai` 的 `server` 块中追加 `location`（见 [`deploy/nginx-postcraft.conf.example`](../deploy/nginx-postcraft.conf.example)）
- [ ] **路径**：前端 `/postcraft`，API `/postcraft-api`（可改，但前后端需一致）
- [ ] **端口**：`18231` 仅监听 `127.0.0.1`；安全组仅开放 443
- [ ] **目录**：建议 `/opt/postcraft`（与 `/opt/studyx-agent-backend` 同级）
- [ ] **OpenAI Key**：`api_keys.local.json` 中 Key 的 IP 白名单已包含 EC2 出口 IP（studyx 配图能通即已满足）
- [ ] **持久化**：`/opt/postcraft/data/postcraft.db` 与 `/opt/postcraft/data/images/` 权限正确

## 快速部署（SSH 到测试 EC2）

```bash
# 1. 克隆或更新代码
sudo mkdir -p /opt/postcraft
sudo chown "$USER:$USER" /opt/postcraft
git clone <PostCraft-repo-url> /opt/postcraft   # 或 git pull

# 2. 后端
bash /opt/postcraft/deploy/install-backend.sh

# 3. 前端（含 NEXT_PUBLIC_BASE_PATH=/postcraft）
bash /opt/postcraft/deploy/install-frontend.sh

# 4. nginx（运维：追加 location 到 test.studyx.ai server 块）
# 见 deploy/nginx-postcraft.conf.example
sudo nginx -t && sudo systemctl reload nginx

# 5. 验证
bash /opt/postcraft/deploy/verify-test.sh
```

## 后端详细步骤

### 1. Python 环境与依赖

```bash
cd /opt/postcraft/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
mkdir -p ../data/images
```

### 2. 共享 OpenAI 配置（二选一）

**方式 A：软链（推荐）**

```bash
mkdir -p /opt/postcraft/config
ln -sf /opt/studyx-agent-backend/config/api_keys.local.json \
       /opt/postcraft/config/api_keys.local.json
```

**方式 B：环境变量 `API_KEYS_FILE`**

在 `/opt/postcraft/.env` 中设置：

```env
API_KEYS_FILE=/opt/studyx-agent-backend/config/api_keys.local.json
```

确保 studyx 的 json 含：`openai_api_key`、`openai_base_url`、`openai_image_model: gpt-image-2`、`openai_skip_proxy: true`。

### 3. 服务器 `.env`

复制模板并编辑：

```bash
cp /opt/postcraft/.env.test.example /opt/postcraft/.env
# 填入 DEEPSEEK_API_KEY 等
```

关键项：

- `LLM_PROVIDER=deepseek` — 文案走 DeepSeek
- OpenAI 字段可留空，由 `api_keys.local.json` 补齐 — **配图走 OpenAI**
- `CORS_ORIGINS=https://test.studyx.ai` — 与前端同域；本地联调时加 `http://localhost:3002`

### 4. systemd

```bash
sudo cp /opt/postcraft/deploy/postcraft.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now postcraft
curl http://127.0.0.1:18231/api/health
```

## 前端详细步骤

路径部署需设置 `NEXT_PUBLIC_BASE_PATH`，Next.js 会自动处理路由与静态资源前缀。

```bash
cd /opt/postcraft/frontend
cp .env.test.example .env.production
npm ci && npm run build
PORT=3002 pm2 start npm --name postcraft-web -- start
pm2 save
```

`.env.production` 示例：

```env
NEXT_PUBLIC_BASE_PATH=/postcraft
NEXT_PUBLIC_API_URL=https://test.studyx.ai/postcraft-api/api
NEXT_PUBLIC_SITE_URL=https://test.studyx.ai/postcraft
```

本地开发**不要**设置 `NEXT_PUBLIC_BASE_PATH`（保持根路径 `localhost:3002`）。

## nginx 示例

在 `test.studyx.ai` 现有 `server { }` 内追加：

```nginx
location /postcraft-api/ {
    proxy_pass http://127.0.0.1:18231/;
    proxy_read_timeout 600s;
}

location /postcraft/ {
    proxy_pass http://127.0.0.1:3002/postcraft/;
}

location = /postcraft {
    return 301 /postcraft/;
}
```

完整片段见 [`deploy/nginx-postcraft.conf.example`](../deploy/nginx-postcraft.conf.example)。

## 本地开发策略

| 方式 | 配置 | 说明 |
|------|------|------|
| A. 远程 API | `frontend/.env.local` → `NEXT_PUBLIC_API_URL=https://test.studyx.ai/postcraft-api/api` | 本地 UI + 测试环境配图 |
| B. 仅本地 | 默认 `localhost:8082` | 接受配图占位图 |

方式 A 需在测试 API 的 `CORS_ORIGINS` 包含 `http://localhost:3002`（模板已含）。

## 部署后验证

```bash
bash deploy/verify-test.sh

# 或手动
curl https://test.studyx.ai/postcraft-api/api/health
open https://test.studyx.ai/postcraft
```

在 UI 中发送「生成封面配图」，后端日志应出现 `/api/images/xxx.png`，而非 `placeholder-*.svg` 或 `ip_not_authorized`。

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 页面 404 / 静态资源 404 | 未设 `NEXT_PUBLIC_BASE_PATH` 或 nginx 路径不匹配 | 检查 `.env.production` 与 nginx `location` |
| `ip_not_authorized` | 本地或未授权 IP 调用 OpenAI | 确认请求来自测试 EC2；检查 Key 白名单 |
| 占位图 `placeholder-*.svg` | OpenAI 调用失败 | 查 `journalctl -u postcraft -f` |
| CORS 错误 | Origin 未加入 `CORS_ORIGINS` | 更新 `.env` 并 `systemctl restart postcraft` |
| 500 / MemoryError | 历史版本快照过大 | 已修复；旧项目可删 DB 或运行修复脚本 |

## 相关文件

- [`deploy/postcraft.service`](../deploy/postcraft.service) — systemd 单元
- [`deploy/nginx-postcraft.conf.example`](../deploy/nginx-postcraft.conf.example) — nginx location 示例
- [`.env.test.example`](../.env.test.example) — 后端 env 模板
- [`frontend/.env.test.example`](../frontend/.env.test.example) — 前端 env 模板
- [`deploy/install-backend.sh`](../deploy/install-backend.sh) — 后端一键脚本
- [`deploy/install-frontend.sh`](../deploy/install-frontend.sh) — 前端一键脚本
- [`deploy/verify-test.sh`](../deploy/verify-test.sh) — 部署验证脚本
