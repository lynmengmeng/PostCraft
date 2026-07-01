# PostCraft Skills

PostCraft 的内容生成能力基于 **Skill 链** 编排：每个 Skill 是一份 Prompt 规范（`SKILL.md`），由 Chat Orchestrator 按场景调用。

## 来源与分工

| Skill | 来源 | MVP | 用途 |
| --- | --- | --- | --- |
| `general-writing` | [oh-my-writing-skill](https://github.com/z0gSh1u/oh-my-writing-skill) | ✅ | 生成通用中间体 Markdown |
| `humanizer-cn` | oh-my-writing-skill | ✅ | 去 AI 化、注入真实感 |
| `wechat-converter` | oh-my-writing-skill | ✅ | 公众号格式转换 |
| `xiaohongshu-converter` | oh-my-writing-skill | ✅ | 小红书格式转换 |
| `douyin-converter` | **PostCraft 自研** | ✅ | 抖音口播分镜脚本 |
| `deep-research` | oh-my-writing-skill | P1 | 选题资料搜集 |
| `image-search` | oh-my-writing-skill | P1 | 配图素材搜索 |
| `image-processing` | oh-my-writing-skill | P1 | 封面贴纸/配文 |
| `zhihu-converter` | oh-my-writing-skill | v1.1 | 知乎格式转换 |
| `postcraft-orchestrator` | **PostCraft 自研** | ✅ | 对话意图路由与 Skill 调度 |

## 引入 oh-my-writing-skill

推荐以 git submodule 引入外部 Skill：

```bash
git submodule add https://github.com/z0gSh1u/oh-my-writing-skill.git vendor/oh-my-writing-skill
```

PostCraft 自研 Skill 放在 `skills/` 根目录；外部 Skill 从 `vendor/oh-my-writing-skill/skills/` 读取。

本地参考副本（可选）：`docs/oh-my-writing-skill/`。

## 标准流水线

```text
灵感/选题
  → [可选] deep-research
  → general-writing（中间体 draft）
  → humanizer-cn（去 AI 化）
  → platform converters（wechat / xiaohongshu / douyin）
  → [可选] image-search + image-processing
  → Preview Renderer
```

## 目录结构

```text
skills/
├── README.md
├── postcraft-orchestrator/SKILL.md
├── douyin-converter/SKILL.md
└── (vendor/oh-my-writing-skill/skills/...)
```

## 开发约定

1. **Skill = Prompt 源**：业务代码从 `SKILL.md` 加载 system prompt，不在代码里硬编码长 Prompt
2. **中间体优先**：平台转换始终基于 `draft` / `humanized` 中间体，便于对话 patch
3. **结构化输出**：Converter 输出需符合 `ContentProject.platforms.*` 数据模型
4. **可跳过步骤**：与 content-creator 一致，支持跳过研究/配图/润色

详细编排设计见 [docs/architecture/chat-orchestrator.md](../docs/architecture/chat-orchestrator.md)。
