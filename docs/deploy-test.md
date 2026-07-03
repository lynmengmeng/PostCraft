# PostCraft 测试环境部署指南

在 studyx 同一台测试 EC2 上部署 PostCraft，复用 studyx 的 `api_keys.local.json` 与出口 IP，使 OpenAI 配图可用。

## 架构（子域名部署）

| 组件 | 地址 | 说明 |
|------|------|------|
| studyx-agent | `13.52.175.51:18230`（已有） | 不动 |
| PostCraft API（内网） | `127.0.0.1:18231` | systemd `postcraft` |
| 对外 API | `https://postcrafttest.studyx.ai/api` | nginx → 18231 |
| 对外前端 | `https://postcraft.studyx.ai` | nginx → PM2 `:3002` |

```
Browser → postcraft.studyx.ai           → Next.js :3002
Browser → postcrafttest.studyx.ai/api   → PostCraft API :18231
PostCraft API → api_keys.local.json（与 studyx 共享）→ OpenAI
```

本地开发无法直连 OpenAI（Key 启用了 IP 白名单）时，可将 `frontend/.env.local` 的 `NEXT_PUBLIC_API_URL` 指向测试 API。

## 与运维对齐清单

部署前请与运维确认以下项（可在工单中直接粘贴）：

- [ ] **DNS**：`postcraft.studyx.ai`（前端）、`postcrafttest.studyx.ai`（API）指向同一 EC2
- [ ] **nginx**：新增两个 `server` 块（见 [`deploy/nginx-postcraft.conf.example`](../deploy/nginx-postcraft.conf.example)），证书与 studyx 域一致
- [ ] **端口**：`18231` 仅监听 `127.0.0.1`；安全组仅开放 443
- [ ] **目录**：建议 `/opt/PostCraft`（与 studyx-agent-backend 同级）
- [ ] **OpenAI Key**：`api_keys.local.json` 中 Key 的 IP 白名单已包含 EC2 出口 IP（studyx 配图能通即已满足）
- [ ] **持久化**：`data/postcraft.db` 与 `data/images/` 权限正确

> 若 `postcraft.studyx.ai` 当前指向 StudyX 主站，需运维将该域名改指 PostCraft 前端（`:3002`），或确认使用独立子域名。

## 快速部署（SSH 到测试 EC2）

```bash
cd /opt/PostCraft
git pull

# 1. 后端
POSTCRAFT_ROOT=/opt/PostCraft bash deploy/install-backend.sh

# 2. 前端（子域名，无 basePath）
POSTCRAFT_REFRESH_ENV=1 POSTCRAFT_ROOT=/opt/PostCraft bash deploy/install-frontend.sh

# 3. nginx（运维）
sudo cp deploy/nginx-postcraft.conf.example /etc/nginx/conf.d/postcraft.conf
# 补全 ssl 证书路径后：
sudo nginx -t && sudo systemctl reload nginx

# 4. 验证
bash deploy/verify-test.sh
```

## 后端 `.env`

```bash
cp .env.test.example .env
nano .env   # 填入 DEEPSEEK_API_KEY
```

关键项：

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的密钥
CORS_ORIGINS=https://postcraft.studyx.ai,http://localhost:3002
JWT_SECRET=至少32位随机字符串
AUTH_REQUIRED=true
ALLOW_REGISTER=false
```

首次部署需创建测试账号（关闭公开注册后只能通过脚本添加）：

```bash
cd /opt/PostCraft
python backend/scripts/create_user.py lyn 123456
# 若服务器上已有登录前的历史数据，将其归属到该账号：
python backend/scripts/migrate_legacy_data.py lyn
```

改完后：`sudo systemctl restart postcraft`

## 前端 `.env.production`

```env
NEXT_PUBLIC_API_URL=https://postcrafttest.studyx.ai/api
NEXT_PUBLIC_SITE_URL=https://postcraft.studyx.ai
```

**不要**设置 `NEXT_PUBLIC_BASE_PATH`（子域名部署走根路径）。

修改后必须重新 build：

```bash
POSTCRAFT_REFRESH_ENV=1 POSTCRAFT_ROOT=/opt/PostCraft bash deploy/install-frontend.sh
```

## nginx 示例

见 [`deploy/nginx-postcraft.conf.example`](../deploy/nginx-postcraft.conf.example)：

- `postcrafttest.studyx.ai` → `http://127.0.0.1:18231`
- `postcraft.studyx.ai` → `http://127.0.0.1:3002`

## 本地开发策略

| 方式 | 配置 | 说明 |
|------|------|------|
| A. 远程 API | `NEXT_PUBLIC_API_URL=https://postcrafttest.studyx.ai/api` | 本地 UI + 测试环境配图 |
| B. 仅本地 | 默认 `localhost:8082` | 接受配图占位图 |

## 初稿跨环境继续创作

本地写好初稿后，可在测试环境导入并继续 AI 对话（不含三平台内容、配图、完整聊天历史；会保留 `chat_summary` 供 AI 参考此前讨论）：

1. **本地**：创作室顶栏 → **导出初稿包** → 得到 `postcraft-draft-*.json`
2. **测试环境**：打开 `https://postcraft.studyx.ai`（或你的前端域名）并登录
3. **工作台** → **导入初稿包** → 选择 JSON → 自动进入创作室
4. 继续对话打磨；满意后生成公众号 / 小红书 / 抖音（配图需在测试环境重新上传或 AI 生成）

## 部署后验证

```bash
curl https://postcrafttest.studyx.ai/api/health
curl https://postcrafttest.studyx.ai/api/auth/config
# 未登录访问业务 API 应返回 401
curl -s -o /dev/null -w "%{http_code}" https://postcrafttest.studyx.ai/api/projects
# 浏览器打开 https://postcraft.studyx.ai 并登录
```

在 UI 中发送「生成封面配图」，确认 `image_url` 为 `.png` 而非 `placeholder-*.svg`。

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 打开 postcraft.studyx.ai 仍是 StudyX 主页 | DNS/nginx 未切到 PostCraft | 确认 nginx `server_name` 与 `proxy_pass :3002` |
| 页面空白 / API 报错 | `.env.production` 仍是旧路径配置 | `POSTCRAFT_REFRESH_ENV=1` 重装前端 |
| CORS 错误 | Origin 未加入 `CORS_ORIGINS` | 更新 `.env` 并 restart postcraft |
| API 401 / 无法加载数据 | 未登录或 `AUTH_REQUIRED=true` | 浏览器登录；或 `create_user.py` 创建账号 |
| 占位图 | OpenAI 调用失败 | `journalctl -u postcraft -f` |

## 相关文件

- [`deploy/postcraft.service`](../deploy/postcraft.service)
- [`deploy/nginx-postcraft.conf.example`](../deploy/nginx-postcraft.conf.example)
- [`.env.test.example`](../.env.test.example)
- [`frontend/.env.test.example`](../frontend/.env.test.example)
- [`deploy/install-backend.sh`](../deploy/install-backend.sh)
- [`deploy/install-frontend.sh`](../deploy/install-frontend.sh)
- [`deploy/verify-test.sh`](../deploy/verify-test.sh)
