# 前端工程师任务书
## Agent + Skill 框架实践：学习内容生成器

**版本**：v1.1  
**负责人**：前端工程师  
**预期工期**：3 ~ 5 天  
**产出形态**：可运行的本地 Demo（不需要上线）

---

## 一、任务目标

通过构建一个完整的「学习内容生成器」，掌握 Agent + Skill 框架的核心概念和实现方式，包括：

- Skill 的接口定义与调用规范
- 串行 + 并行两种 Skill 调度模式
- 流式进度 UI（SSE / Streaming）
- Human-in-the-loop 节点的实现
- 结构化 JSON 数据渲染为可交互组件

---

## 二、产品描述

用户通过两种方式触发学习内容生成：

- **方式一：输入网页 URL**，系统自动提取网页正文作为学习素材
- **方式二：直接用文字描述学习需求**（例如："帮我学习牛顿三大定律，适合高中程度"）

系统基于以上任意一种输入，生成一套完整的学习材料，包括 Study Note、Flashcards 和 Quiz。整个流程分两个阶段，中间有一个用户确认节点。

---

## 三、完整流程

```
[用户输入：网页 URL 或 文字描述]
              │
              ▼
        输入类型判断
       /             \
  是 URL           是文字描述
      │                  │
      ▼                  ▼
 Skill A：         直接进入
 网页内容抓取      Skill B
      │                  │
      └────────┬─────────┘
               ▼
        Skill B：生成 Study Note
        （输出 Markdown，流式渲染）
               │
               ▼
        ⏸️  Human-in-the-loop
        用户阅读并可编辑 Study Note
        点击「确认并继续」后进入下一阶段
               │
               ▼
         ┌─────┴─────┐
         ▼           ▼
      Skill C     Skill D
     Flashcards    Quiz
      （并行执行）
         └─────┬─────┘
               │
               ▼
         Skill E：导出 PDF
         （Study Note 导出为 PDF 下载）
```

---

## 四、各 Skill 规格

### Skill A — 网页内容抓取（仅 URL 输入时触发）

| 项目 | 说明 |
|------|------|
| 输入 | `{ url: string }` |
| 输出 | `{ title: string, content: string }` |
| 实现建议 | 使用 Jina Reader：直接请求 `https://r.jina.ai/{url}`，返回干净的 Markdown 正文，零配置，无需后端 |
| 注意 | content 建议截断至 8000 字以内再传给 Skill B |

### Skill B — 生成 Study Note

| 项目 | 说明 |
|------|------|
| 输入 | `{ source: 'url', title: string, content: string }` 或 `{ source: 'text', userInput: string }` |
| 输出 | `{ markdown: string }` |
| 要求 | 包含：核心概念、重点摘要、关键术语解释；使用标准 Markdown 标题层级 |
| 流式输出 | 支持 streaming，前端逐字渲染 |

### Skill C — 生成 Flashcards

| 项目 | 说明 |
|------|------|
| 输入 | 用户确认后的 Study Note markdown |
| 输出 | `{ cards: Array<{ id: string, front: string, back: string }> }` |
| 数量 | 10 ~ 15 张 |
| 前端渲染 | 可翻转的卡片交互（点击正面翻到背面） |

### Skill D — 生成 Quiz

| 项目 | 说明 |
|------|------|
| 输入 | 用户确认后的 Study Note markdown |
| 输出 | `{ questions: Array<{ id: string, question: string, options: string[], answer: number, explanation: string }> }` |
| 数量 | 5 ~ 8 题 |
| 前端渲染 | 可选答、提交后显示对错和解析 |

### Skill E — 导出 PDF

| 项目 | 说明 |
|------|------|
| 输入 | Study Note markdown 字符串 |
| 输出 | PDF 文件（浏览器下载） |
| 实现建议 | 将 Markdown 渲染为 HTML 后用 `window.print()` 导出即可，不需要精美排版 |

---

## 五、UI 要求

### 输入区
两种输入方式通过 Tab 或 Toggle 切换，同一个入口，不要做成两个页面。

### 进度可视化
每个 Skill 执行时，界面需展示实时状态：

```
[ ✓ ] 网页内容抓取      完成        （文字描述模式下此步跳过，显示为 N/A）
[ ⟳ ] 生成 Study Note   生成中...
[ ◯ ] Flashcards        等待中
[ ◯ ] Quiz              等待中
```

### Human-in-the-loop 节点
- Study Note 生成完成后，流程**必须暂停**
- 用户可以在界面上直接编辑 Markdown 内容
- 显示明确的「确认并继续」按钮，点击后才触发 Skill C / D 并行执行
- 这是整个 Demo 最重要的交互节点，UI 上需要视觉强调

### 并行状态展示
Skill C 和 Skill D 同时执行时，进度状态需同时更新，体现并行感。

---

## 六、技术要求

- 前端框架：React（推荐）
- LLM 调用：直接调用 Claude API（`claude-sonnet-4-20250514`），Skill 的 prompt 写在前端，不需要后端
- Skill 实现：每个 Skill 写成独立的函数模块，统一接口：

```typescript
interface Skill<TInput, TOutput> {
  name: string
  run(input: TInput): Promise<TOutput>
}
```

- 不需要数据库，所有状态存在 React state 里
- 不需要用户登录

---

## 七、不需要做的事（明确排除）

- ❌ YouTube 视频抓取
- ❌ 多格式导出（DOCX、PPT）—— PDF 一种足够
- ❌ 内容入库 / 历史记录
- ❌ 用户账号体系
- ❌ 个性化调整功能
- ❌ 移动端适配
- ❌ 错误重试机制（基础错误提示即可）

---

## 八、验收标准

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | 两种输入都能跑通 | URL 模式和文字描述模式各跑一次完整流程 |
| 2 | Human-in-the-loop | Study Note 生成后流程暂停，用户编辑并确认后才继续 |
| 3 | 并行执行 | Flashcards 和 Quiz 同时生成，进度状态同步更新 |
| 4 | Skill 模块化 | 每个 Skill 是独立函数，可以单独测试调用 |
| 5 | 流式渲染 | Study Note 生成过程中文字逐步出现，不是等全部完成再显示 |
| 6 | PDF 导出 | 点击导出后能下载包含 Study Note 内容的 PDF |

---

## 九、建议的推进节奏

| 时间 | 里程碑 |
|------|--------|
| Day 1 | 搭项目框架，定义 Skill 接口规范，跑通 Skill A（网页抓取）+ Skill B（Study Note 流式生成） |
| Day 2 | 实现 Human-in-the-loop 节点（Markdown 展示 + 编辑 + 确认按钮） |
| Day 3 | 实现 Skill C / D 并行执行 + Flashcards / Quiz 交互渲染 |
| Day 4 | 接入文字描述输入模式 + Skill E（PDF 导出）+ 进度 UI 整体收尾 |
| Day 5 | 缓冲：联调、修 bug、准备演示 |

---

## 十、参考资料

- Jina Reader：https://jina.ai/reader
- Claude API Streaming 文档：https://docs.anthropic.com/en/api/messages-streaming
- SSE 前端接入参考：MDN EventSource

---

*如果在实现过程中发现某个 Skill 的设计不合理，欢迎提出，任务书可以迭代。*
