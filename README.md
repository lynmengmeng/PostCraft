# PostCraft（生活有稿）

个人观察与内容创作工作台：把生活观察整理成碎片，校验后生成可发布的公众号 / 小红书 / 抖音内容。

## 架构

| 层级 | 技术 |
| --- | --- |
| 前端 | Next.js + React + Tailwind CSS |
| 后端 | Python FastAPI |
| 数据库 | SQLite（`data/postcraft.db`） |
| AI 文案 | DeepSeek / OpenAI（`DEEPSEEK_API_KEY` / `OPENAI_API_KEY`） |
| AI 配图 | OpenAI DALL-E 3（需配置 `OPENAI_API_KEY`，无 Key 时使用占位图） |
| Skill 流水线 | `general-writing → humanizer-cn → 各平台 converter` |

## 快速开始

### 1. 首次安装

在项目根目录执行：

```powershell
copy .env.example .env
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
cd ..
cd frontend
npm install
copy .env.local.example .env.local
cd ..
npm install
```

### 2. 开发模式（两个终端）

开发时前后端分别启动，便于单独查看日志与重启。请在**两个终端**中均先 `cd` 到项目根目录 `PostCraft`。

**终端 1 — 后端**

```powershell
npm run dev:backend
```

启动 FastAPI，默认地址：http://localhost:8082/docs

**终端 2 — 前端**

```powershell
npm run dev:frontend
```

启动 Next.js，默认地址：http://localhost:3002

> 上述命令会自动清理对应端口上的残留进程（8082 / 3002）。若需手动释放端口，可运行 `powershell -ExecutionPolicy Bypass -File scripts/free-dev-ports.ps1`。

**可选：单终端一键启动**

若希望前后端在同一终端运行，可使用：

```powershell
npm run dev
```

### 3. 环境变量（`.env`）

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key
OPENAI_API_KEY=your_openai_key
CORS_ORIGINS=http://localhost:3002,http://127.0.0.1:3002
```

前端 `.env.local`：

```env
NEXT_PUBLIC_API_URL=http://localhost:8082/api
```

## 当前能力（MVP）

- **工作台**：一句话灵感一键进入创作室；首页展示待完成草稿与最近编辑
- **灵感库 / 选题库**：打标签、筛选、删除；一键转选题并进入创作室
- **创作工作室**：对话（SSE 流式 + 快捷指令）/ 三平台正文可编辑（自动保存）/ 预览
- **Skill 流水线**：按 PRD 标准生成三平台内容；对话 patch 优先更新 `humanized` 中间层
- **标题**：批量生成 ≥10 个标题，应用至当前平台
- **配图**：提示词 + DALL-E 生图，同步至小红书 `cover_image` 与预览区
- **导出**：创作室顶部「导出全部」Markdown，三平台一键复制
- **草稿箱**：待发布 / 已发布视图、发布记录（含备注）、删除草稿
- **作者风格档案**：语气、禁用词、个人素材、各平台默认风格注入流水线 system prompt

未配置 API Key 时，后端自动使用本地 mock 模板，不影响 UI 与流程演示。

## 测试环境部署

推送到 `main` 后可自动部署到测试环境（需先在 GitHub 配置 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY`）。详见 [测试环境部署指南](docs/deploy-test.md)。

## 文档

- [产品需求文档（PRD）](docs/PostCraft-PRD.md) — 第9 MVP 能力清单与同步
- [Chat Orchestrator 设计](docs/architecture/chat-orchestrator.md)
- [Skill 目录](skills/README.md)
