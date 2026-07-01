# Chat Orchestrator 设计文档

> PostCraft 内容创作室的核心后端模块：解析对话意图、调度 Skill 链、输出结构化 Patch、驱动预览刷新。

---

## 1. 概述

Chat Orchestrator 是 PostCraft 的 **AI 编排层**，介于用户对话 UI 与 Skill/Prompt 层之间。

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Chat UI    │────▶│ Chat Orchestrator │────▶│  LLM API    │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        Skill Loader   Content Store   Version Store
              │              │              │
              └──────────────┴──────────────┘
                             │
                             ▼
                    Preview Renderer (SSE/WebSocket)
```

**设计目标：**

- 对话修改 **精准 patch**，非全文重写
- Skill **可插拔**，Prompt 来自 `SKILL.md`
- 预览与存储 **实时同步**
- 支持 **流式** 输出与 **版本回退**

---

## 2. 模块划分

| 模块 | 职责 |
| --- | --- |
| **IntentParser** | 从用户消息解析 intent、targetPlatforms、constraints |
| **ContextBuilder** | 组装 LLM 上下文（项目状态 + Skill 指令 + 对话摘要） |
| **SkillRouter** | 根据 intent 选择 Skill 链及执行顺序 |
| **SkillLoader** | 读取 `SKILL.md`，注入为 system/sub prompt |
| **PatchGenerator** | LLM 输出 ContentPatch JSON |
| **PatchApplier** | 校验并应用 Patch 到 ContentProject |
| **VersionManager** | 重大修改前创建 snapshot，支持 rollback |
| **ResponseFormatter** | 生成用户可见摘要 + 流式 token |
| **PreviewNotifier** | 推送 preview-updated 事件到前端 |

---

## 3. API 设计

### 3.1 发送消息

```http
POST /api/projects/:projectId/chat
Content-Type: application/json

{
  "message": "公众号开头改成回农村的经历",
  "selectedPlatform": "wechat",
  "options": {
    "stream": true
  }
}
```

### 3.2 流式响应（SSE）

```text
event: intent
data: {"intent":"patch_platform","targetPlatforms":["wechat"]}

event: delta
data: {"text":"正在更新公众号开头……"}

event: patch
data: {"summary":"...","patch":{"platforms.wechat.body":"..."}}

event: done
data: {"projectVersion":12,"previewUpdated":true}
```

### 3.3 回退版本

```http
POST /api/projects/:projectId/versions/:versionId/restore
```

---

## 4. 意图解析

### 4.1 两阶段解析

**阶段 A — 规则快路径（毫秒级）**

匹配快捷按钮与高频句式：

```typescript
const QUICK_INTENTS = [
  { pattern: /更温和|温和一点/, intent: 'humanize', tone: '温和' },
  { pattern: /更犀利|犀利一点/, intent: 'humanize', tone: '犀利' },
  { pattern: /缩短|精简|短一点/, intent: 'patch_platform', constraint: 'shorter' },
  { pattern: /(\d+)个标题/, intent: 'generate_titles' },
  { pattern: /只改|仅改|不要动.*(小红书|公众号|抖音)/, intent: 'patch_platform' },
  { pattern: /生成.*初稿|三个平台/, intent: 'generate_all' },
  { pattern: /撤销|回退|上一版/, intent: 'rollback' },
];
```

**阶段 B — LLM 分类（规则未命中时）**

轻量分类 prompt，输出：

```json
{
  "intent": "patch_platform",
  "targetPlatforms": ["wechat"],
  "constraints": ["opening", "personal_story"],
  "confidence": 0.92
}
```

### 4.2 平台消歧

| 信号 | 解析 |
| --- | --- |
| 「公众号」「微信」 | wechat |
| 「小红书」「笔记」 | xiaohongshu |
| 「抖音」「口播」「脚本」 | douyin |
| 「全部」「三个平台」 | all |
| 未指定 + 当前 Tab | selectedPlatform |
| 未指定 + 无 Tab | 询问用户 |

---

## 5. Skill 链编排

### 5.1 链定义（配置化）

```typescript
// config/skill-pipelines.ts
export const PIPELINES: Record<Intent, SkillStep[]> = {
  generate_all: [
    { skill: 'general-writing', output: 'draft' },
    { skill: 'humanizer-cn', input: 'draft', output: 'humanized' },
    { skill: 'wechat-converter', input: 'humanized', output: 'platforms.wechat' },
    { skill: 'xiaohongshu-converter', input: 'humanized', output: 'platforms.xiaohongshu' },
    { skill: 'douyin-converter', input: 'humanized', output: 'platforms.douyin' },
  ],
  patch_platform: [
    { skill: 'postcraft-orchestrator', mode: 'patch' },
    { skill: 'dynamic-converter', mode: 'format' },
  ],
  humanize: [
    { skill: 'humanizer-cn', input: 'draft|platforms.*', output: 'humanized' },
    { skill: 'dynamic-converter', mode: 'cascade' },
  ],
  generate_titles: [{ skill: 'title-generator' }],
  research: [{ skill: 'deep-research', output: 'research' }],
  cover_assets: [{ skill: 'image-search' }, { skill: 'image-processing' }],
  rollback: [{ skill: 'version-manager' }],
};
```

### 5.2 Skill 加载

```typescript
async function loadSkill(name: string): Promise<string> {
  const paths = [
    `skills/${name}/SKILL.md`,
    `vendor/oh-my-writing-skill/skills/${name}/SKILL.md`,
  ];
  // 返回 SKILL.md 正文（去掉 frontmatter 或保留 metadata）
}
```

### 5.3 单步执行

```text
Input: 上一步 output + topicMeta + user message
System: SKILL.md 内容
User: 结构化任务描述 + 待处理文本
Output: 平台字段 JSON 或 Markdown
```

---

## 6. ContentPatch 协议

### 6.1 类型定义

```typescript
interface ContentPatch {
  intent: Intent;
  targetPlatforms: Platform[];
  summary: string;
  changes: ChangeRecord[];
  patch: Record<string, unknown>;
  previewHints?: string[];
}

interface ChangeRecord {
  path: string;
  action: 'replace' | 'replace_section' | 'append' | 'merge';
  section?: string;
  before_preview?: string;
  after_preview?: string;
}
```

### 6.2 应用规则

1. **路径白名单**：仅允许 `draft`、`humanized`、`platforms.*`、`titles`、`coverAssets`
2. **版本快照**：`replace` 整篇正文前自动 snapshot
3. **原子性**：单次 Patch 全部成功或全部回滚
4. **校验**：douyin.script 必须是分镜数组；xhs.tags 必须是字符串数组

### 6.3 路径示例

```json
{
  "patch": {
    "platforms.wechat.title": "回农村后，我才看懂老人的健康",
    "platforms.wechat.body": "...",
    "platforms.douyin.script": [
      { "index": 1, "duration": "3s", "narration": "...", "visual": "...", "subtitle": "..." }
    ],
    "titles": ["标题A", "标题B"]
  }
}
```

---

## 7. 上下文管理

### 7.1 Token 预算分配

| 部分 | 预算 | 说明 |
| --- | --- | --- |
| Orchestrator + Skill system | ~4K | 固定 |
| topicMeta + inspiration | ~500 | 固定 |
| humanized 摘要 | ~1K | 长文时摘要 |
| 当前 platform 全文 | ~3K | patch 目标 |
| 其他 platform 摘要 | ~500 each | 仅摘要 |
| recentChat | ~2K | 最近 6 轮压缩 |

### 7.2 对话摘要策略

每 6 轮对话，后台异步生成 `chatSummary` 写入 project，替换原始 chatHistory 注入。

---

## 8. 与预览联动

```text
PatchApplier.apply(patch)
  → ContentStore.update(project)
  → PreviewNotifier.emit({
      projectId,
      updatedPlatforms: ['wechat'],
      version: 12
    })
  → 前端 Zustand/React Query invalidate
  → PreviewRenderer 重渲染对应 Tab
```

**各平台 Preview 组件输入：**

| 平台 | 渲染数据源 |
| --- | --- |
| 公众号 | platforms.wechat.title + summary + body → HTML/Markdown 排版 |
| 小红书 | coverImage + title + body + tags → 卡片 UI |
| 抖音 | script[] → 分镜表格 + 时间轴 |

---

## 9. 错误处理

| 错误 | 用户可见 | 系统行为 |
| --- | --- | --- |
| LLM 超时 | 「生成超时，请重试」 | 不应用部分 Patch |
| Patch JSON 无效 | 「理解有误，请换个说法」 | 重试 1 次带 repair prompt |
| Skill 文件缺失 | 「功能暂不可用」 | 日志 + 降级到通用 prompt |
| 内容违规 | 「已标记需修改的表述」 | fact_check 高亮 + 建议替换 |

---

## 10. MVP 实现顺序

| 阶段 | 交付 |
| --- | --- |
| **W1** | SkillLoader + PIPELINES 配置 + generate_all 链 |
| **W2** | IntentParser 快路径 + patch_platform + ContentPatch |
| **W3** | SSE 流式 + VersionManager rollback |
| **W4** | PreviewNotifier + 三平台 Preview 联动 |
| **W5** | research / cover_assets 可选链 |

---

## 11. 相关文档

- [PRD §15 Skill 集成方案](../PRD.md#15-skill-集成方案)
- [skills/postcraft-orchestrator/SKILL.md](../../skills/postcraft-orchestrator/SKILL.md)
- [skills/README.md](../../skills/README.md)
- [oh-my-writing-skill](https://github.com/z0gSh1u/oh-my-writing-skill/tree/master/skills)
