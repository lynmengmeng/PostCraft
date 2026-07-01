# StudyX Agent Backend — Skill 开发规范（V2）

> **版本**：2.0.0 | **最后更新**：2026-05-14  
> 本文档在 `SKILL_CONVENTION.md`（v1.1）基础上，整合同目录 `studyAgentSkill/` 内架构笔记与研究文档，形成**可落地规范 + 设计理念 + 扩展模式**合一的版本。  
> 遵循 [agentskills.io](https://agentskills.io) 开放格式，兼容 Cursor / Claude Code / GitHub Copilot 等 Agent。  
> **契约与实现主干**：**§3–§12** 与 v1 对齐（可直接照做）；**§13–§18** 为复杂流水线、无头集成、评估、多域分层与框架选型等扩展导读。**§11** 完整长示例仍以 `SKILL_CONVENTION.md` 或仓库内已有 Skill 为准。

---

## 文档体系（同目录知识地图）

| 文档 | 用途 | 与本文关系 |
|------|------|------------|
| `SKILL_CONVENTION.md` | v1 规范原文 | V2 在其上扩展；v1 仍可作为「仅读实现规范」的精简入口 |
| `studyAgentV2.md` | Agent / Skill / Workflow 术语与工程原则 | 吸收为 5**§1、§17–§18** |
| `AGENT_SKILLS_RESEARCH.md` | Agent Skills 标准、评估、脚本最佳实践 | 吸收为 **§2.4、§15** |
| `HERMES_AGENT_ANALYSIS.md` | Nous Hermes Agent 与全景模块对照 | **§17** 补充一行选型 |
| `HERMES_NAMING_META_VS_NOUS.md` | 「Hermes」同名辨析 | **§17** 脚注，避免沟通歧义 |
| `ppt-master-and-agent-skill.md` | 复杂 Skill = 合同 + 门禁 + 脚本链 | 吸收为 **§13** |
| `integrating-ppt-master-without-conversation.md` | 对话式 Skill → 无头 API 的编排缺口 | 吸收为 **§14** |
| `skill相关修改建议.md` | 单入口 Coach + references / 工具分层 | 吸收为 **§16**（含 **§16.5** 优先级表） |

---

## 目录

1. [什么是 Skill（定义、三阶段加载、与生态分工）](#1-什么是-skill定义三阶段加载与生态分工)
2. [目录结构规范（含可选扩展）](#2-目录结构规范含可选扩展)
3. [SKILL.md 格式规范](#3-skillmd-格式规范)
4. [SKILL.md 内容写作最佳实践](#4-skillmd-内容写作最佳实践)
5. [高效指令模式](#5-高效指令模式)
6. [scripts/run.py 代码规范](#6-scriptsrunpy-代码规范)
7. [`__init__.py` 导出规范](#7-__init__py-导出规范)
8. [Router 注册规范](#8-router-注册规范)
9. [Nuxt 前端对接规范](#9-nuxt-前端对接规范)
10. [完整新建流程（Checklist）](#10-完整新建流程checklist)
11. [示例：Flash Card Skill](#11-示例flash-card-skill)
12. [常见错误与约定](#12-常见错误与约定)
13. [复杂 Skill：门禁、流水线与「设计真源」](#13-复杂-skill门禁流水线与设计真源借鉴-ppt-master-模式)
14. [无头 API / 产品与对话式 SKILL.md 的差异](#14-无头-api--产品与对话式-skillmd-的差异)
15. [评估、基准与迭代改进](#15-评估基准与迭代改进)
16. [「大而多域」Skill 的分层建议（单 HTTP 入口 + references / workflows）](#16-大而多域skill-的分层建议单-http-入口--references--workflows)
17. [框架与运行时选型（何时不必上重型框架）](#17-框架与运行时选型何时不必上重型框架)
18. [延伸阅读](#18-延伸阅读)

---

## 1. 什么是 Skill（定义、三阶段加载、与生态分工）

### 1.1 本仓库中的 Skill 构成

**Skill** 是一个自包含的能力单元，代表后端提供的一项 AI 学习辅助功能：

| 部分 | 职责 |
|------|------|
| **`SKILL.md`** | 「门面」：`name`、`description`、契约、System Prompt、Gotchas；供 Agent **发现与遵循** |
| **`scripts/run.py`** | 实际执行：校验、Prompt、LLM、解析、返回 |
| **`__init__.py`** | 导出公开 API，简化 Router import |
| **`references/`**（可选） | 详细说明、示例、边缘案例——**仅在 SKILL.md 写明触发条件时**加载 |
| **`workflows/`**（可选） | 多步支线、GATE 清单（文档化），见 **§16** |
| **`evals/`**（可选） | `evals.json` 等，用于 with/without Skill 对比，见 **§15** |

**核心设计原则**（与 v1 一致）：

| 原则 | 说明 |
|------|------|
| 单目录单技能 | 每个 Skill 独立目录，不与其他 Skill 共享实现包 |
| SKILL.md 先行 | 先契约与指令，后代码 |
| 只写 Agent 不知道的 | 不写通识；写项目特有约束与失败模式 |
| 适度精确 | 脆弱步骤写死；开放任务留自主空间 |
| 自定义 JSON 解析 | **禁止** `relaxed_json.extract_json_object`（PPT 专用逻辑会误判） |

### 1.2 Agent Skills 三阶段加载（Discovery → Activation → Execution）

> 与开放标准一致，便于 Skill 数量增长后控制上下文体积。

| 阶段 | 加载内容 | 作用 |
|------|----------|------|
| **Discovery** | 仅 `name` + `description`（frontmatter） | 扫描注册表 / 索引时占用最小 |
| **Activation** | 完整 `SKILL.md` | 任务匹配后再注入完整指令 |
| **Execution** | `scripts/`、`references/` 等 | 按文档触发条件执行或读取 |

实践要求：`description` 必须能**单独**支撑 Discovery 阶段路由决策（见 **§3** `description` 三问）。

### 1.3 Skill 与 Search、RAG、Tool、Workflow、Agent（术语对齐）

> 节选并对齐 `studyAgentV2.md`，便于与产品/算法同学同屏讨论。

**补充上下文的方式不同**：

| 类型 | 主要给模型什么 | 典型作用 |
|------|----------------|----------|
| **Search** | 检索到的零散资料 | 追新、追事实 |
| **RAG** | 知识库片段 | 回答锚定指定语料 |
| **Skill** | 做法、模板、硬约束、契约 | 教模型**怎么做**、输出什么结构 |

**是否需要模型持续自主决策**：

| 类型 | 自主决策 | 特征 |
|------|----------|------|
| **Workflow / 固定流水线** | 通常不需要 | 步骤与分支可预判 |
| **Tool** | 不需要 | 单一功能，schema 清晰 |
| **Agent** | 需要 | 规划、循环、直到目标满足 |

**工程原则（StudyX 语境）**：**能 deterministic 就不要 agentic**——解析、校验、落库、导出等尽量下沉为代码与脚本；Agent 层尽量薄，负责意图与编排边界。

### 1.4 与本项目后端的关系

- **Discovery**：`SKILL.md` 的 `description` + 与前端对齐的 **Skill ID**。
- **Execution**：`run_*` + Router 契约 + 统一错误形态（400 / 503）。
- **Escalation**：开放域或多 Skill 组合由上层对话 / 编排完成，不把一个 Skill 写成「万能对话」。

---

## 2. 目录结构规范（含可选扩展）

### 2.1 标准结构（与 v1 一致）

```
app/skills/
└── {skill_name}/                  # 小写+下划线，Python 包兼容
    ├── SKILL.md                   # 必须：元数据 + 指令（建议 ≤ 500 行 / ≤ 5000 tokens）
    ├── __init__.py                # 必须：导出公开 API
    ├── scripts/
    │   ├── __init__.py            # 必须：空文件
    │   └── run.py                 # 必须：业务逻辑（或流式入口 still 放此包内）
    └── references/                # 可选：详细参考（须写触发条件）
        ├── output_examples.json
        └── edge_cases.md
```

### 2.2 命名约定（与 v1 一致）

| 层级 | 规则 | 示例 |
|------|------|------|
| Skill 目录名 | `小写_下划线` | `flash_card` |
| `SKILL.md` 的 `name` | Title Case，≤ 5 词 | `Flash Card Generator` |
| HTTP 端点 | `小写-连字符` | `/api/skills/flash-card-generate` |
| 主函数 | `run_{skill_name}` | `run_flash_card_generate` |
| Skill ID | `skillX.camelCase` | `skillD.flashCardGenerate` |

### 2.3 可选扩展目录

| 目录/文件 | 何时引入 | 说明 |
|-----------|----------|------|
| **`references/`** | 正文过长或按域拆分 | 必须在 `SKILL.md` 写清**何时读取哪一篇** |
| **`workflows/`** | 多步支线、GATE、短篇 SOP | 可以是仅 Markdown 的步骤清单；复杂后再代码化 |
| **`evals/evals.json`** | 需要可复现评估 | 见 **§15** |
| **`assets/`** | 模板片段、静态示例 | 开放标准中的可选项；若引入须在 `SKILL.md` 说明路径与用途 |

> **大小限制**：`SKILL.md` 仍建议 ≤ 500 行；超出则下沉到 `references/` 或 `workflows/`，避免 Activation 阶段撑爆上下文。

### 2.4 脚本目录的约定（对齐开放标准）

若 Skill 除 `run.py` 外还有 CLI 小工具：

- 在 `SKILL.md` 中列出 **脚本路径 + 一句话用途 + 非交互约束**（Agent 常在非 TTY 环境运行）。
- 优先 **结构化输出**（JSON）、**清晰退出码**、**可 `--help`**；避免依赖交互式提问。

一次性命令可用 `uvx` / `npx` 等时在 `SKILL.md` 声明版本与环境要求（详见 `AGENT_SKILLS_RESEARCH.md`）。

---

## 3. SKILL.md 格式规范

（与 v1 **§3** 一致，此处摘要；完整模板以 v1 或下方要点为准。）

- YAML frontmatter **必填**：`name`、`description`。
- 建议章节：`Overview`（Skill ID、Endpoint、Mode）、`Input`、`Output`、`LLM System Prompt`、`Gotchas`、`Implementation`、`Notes & Constraints`。
- `description` 必须回答：**做什么**、**何时用**、**输出格式**。

```markdown
---
name: {Title Case, ≤ 5 words}
description: {英文触发描述：任务 + 输出结构 + 使用场景}
---

## Overview
**Skill ID**: `skillX.camelCaseName`
**Endpoint**: `POST /api/skills/{endpoint}`
**Mode**: Single-shot | Two-phase | Streaming
...
```

---

## 4. SKILL.md 内容写作最佳实践

与 v1 **§4** 一致，要点回顾：

1. **从真实任务提炼**，避免空泛「最佳实践」堆砌。
2. **只写 Agent 不知道的**；能删掉就不保留。
3. **大文档渐进加载**：`references/` + **明确触发条件**。
4. **控制粒度**：脆弱步骤精确；开放任务给原则。
5. **用真实执行迭代**：读轨迹，更新 Gotchas。

---

## 5. 高效指令模式

与 v1 **§5** 一致：Gotchas、输出模板、多步清单、验证循环、方法重于单题答案。

---

## 6. scripts/run.py 代码规范

与 v1 **§6** 一致，核心要求：

- 文件头 docstring 指向 `../SKILL.md`。
- `SYSTEM` 与 `SKILL.md` 内 Prompt **保持同步**。
- `validate_input` → `_build_prompt` → `chat_complete_text` → `_extract_*_json` → `run_*`。
- JSON 解析：**去 BOM → 直接 parse → 剥 markdown 围栏 → 平衡括号扫描特征键 →（可选）截断恢复**；禁止 `relaxed_json.extract_json_object`。
- `max_tokens` 按输出体量选择（v1 表格）。

---

## 7. `__init__.py` 导出规范

与 v1 **§7** 一致：仅导出 `run_*`，多阶段则导出全部公开入口。

---

## 8. Router 注册规范

与 v1 **§8** 一致：

- `ValueError` → 400；`RuntimeError`（解析/LLM 异常）→ 503；其他 → 500 兜底。

---

## 9. Nuxt 前端对接规范

与 v1 **§9** 一致：`server/api/skills/{endpoint}.post.ts`、`getAgentAuthHeaders`、工具组件与页面注册等。

---

## 10. 完整新建流程（Checklist）

在 v1 **§10** 基础上，**建议追加**：

```
评估与文档（可选但推荐）
□ 为大 Skill 或易回归场景添加 evals/evals.json（§15）
□ 在本文「文档体系」或 ARCHITECTURE.md 中增加指向本 Skill 的一句话说明

复杂流水线（可选）
□ 若有多步门禁或阻塞点，在 SKILL.md 或 workflows/ 写明 GATE 与禁止项（§13）
```

其余条目（后端目录、Router、前端、`ARCHITECTURE.md`）与 v1 相同。

---

## 11. 示例：Flash Card Skill

与 v1 **§11** 相同：完整 `SKILL.md` 片段、`run.py` 骨架、Router、`__init__.py`。**实现时请直接对照 v1 全文或仓库内 `app/skills/` 已有 Skill。**

---

## 12. 常见错误与约定

与 v1 **§12** 一致（平文件 Skill、模糊 description、滥用 `relaxed_json`、无触发条件的 references 等）。

---

## 13. 复杂 Skill：门禁、流水线与「设计真源」（借鉴 ppt-master 模式）

> 来源：`ppt-master-and-agent-skill.md`。适用于**步骤多、易漂移、需人机门禁**的能力；不限于 PPT。

### 13.1 角色分工（概念）

| 层次 | 角色 |
|------|------|
| **Skill（`SKILL.md`）** | **合同**：触发词、**固定流水线顺序**、**GATE**、**BLOCKING**（必须等人确认）、与脚本/目录的映射、**禁止项** |
| **Agent** | 在合同下执行：读规范、调脚本、生成中间产物 |
| **脚本与模板** | **确定性、可测**步骤；把创意约束在合法输出格式内 |

### 13.2 可迁移的设计模式

1. **稳定下沉代码，理解交给模型**：转换、校验、导出等用脚本；措辞与结构由 LLM。
2. **强流水线 + 显式门禁**：每步有准入条件；关键对齐点 **BLOCKING**，避免模型替用户做不可逆决策。
3. **中间契约抗漂移**：例如锁定版式/口径的 `spec_lock` 类文件；Skill 要求**每步生成前重读**——「Agent + 外部真源」。
4. **兼容性边界写清楚**：声明本仓库**不是什么**（例如不要默认套用通用 Web 脚手架习惯），避免别处的 Agent 规则污染结构。
5. **技术路线写清取舍**：在 `references/` 或独立 ADR 中记录**为什么**选当前栈，便于后人维护。

### 13.3 起草复杂 Skill 的最小四件套

1. **步骤表**（有序；标注并行/串行）。
2. **阻塞点列表**（何处必须等人或下游系统确认）。
3. **禁止项列表**（例如：禁止跳步、禁止未 finalize 就导出）。
4. **目录与脚本映射**（每个阶段对应命令或可调用函数）。

再按需填充 `references/` 中的角色文档与细节。

---

## 14. 无头 API / 产品与对话式 SKILL.md 的差异

> 来源：`integrating-ppt-master-without-conversation.md`。StudyX 若做「无对话直出」类功能，同样适用。

### 14.1 核心结论

- **拷贝 Skill 目录 + 脚本**在技术上也常可行，但 **`SKILL.md` 面向的是对话式 Agent**（含阻塞确认、多轮读规范）。
- **无对话产品**没有人点「继续」，必须在**自有编排层**用默认值、表单或状态机 **替换 BLOCKING**，并用程序或受控 LLM 写入中间契约文件。

### 14.2 对产品设计的含义

| 方面 | 注意点 |
|------|--------|
| **许可证** | 第三方树状依赖需遵守其 LICENSE |
| **依赖与环境** | Python 依赖合并或隔离（venv / 分组） |
| **路径与并发** | 每请求独立工作目录；避免多租户互写 |
| **SKILL.md 在生产** | 通常**不参与**运行时；仅存档或供内部 Agent 使用 |
| **质量约束** | 中间格式（如 SVG 规范）不满足则下游脚本失败——需在 Skill 合同与校验脚本中写明 |

### 14.3 编排层要点（与后端 Skill 注册互补）

- **子进程/包装函数**顺序执行；**后处理阶段勿乱序并发**（若流水线有依赖）。
- **不要用「跳过 finalize」抄近道**；错误会在后续阶段放大。
- 与开放标准一致：**无头服务**仍应有**可测的阶段守门**（文件存在性、schema 校验），等价于对话 Skill 里的 GATE。

---

## 15. 评估、基准与迭代改进

> 来源：`AGENT_SKILLS_RESEARCH.md`（[evaluating-skills](https://agentskills.io/skill-creation/evaluating-skills)）。

### 15.1 为什么要在后端 Skill 上引入 eval

- **验收**：同一批 Prompt 在 with Skill / without Skill 下对比通过率、延时、token。
- **防回归**：`SKILL.md` 变更有客观信号，而非仅靠主观观感。

### 15.2 `evals/evals.json` 形状（建议）

```json
{
  "skill_name": "your-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "与真实用户表述接近的任务描述",
      "expected_output": "可验证的成功标准（避免模糊形容词）",
      "files": ["evals/files/sample.json"]
    }
  ]
}
```

**好的 Prompt**：少量起步、措辞变体、至少一个边界/畸形输入、真实字段名与路径。  
**好的断言**：如「输出为合法 JSON」「关键数组非空」；避免「输出很好」或过窄字符串匹配。

### 15.3 决策参考

对比 with vs without 的 **pass_rate / time / tokens**：若 token 与延时适度上升但通过率显著提升，通常值得；若为微小收益付出翻倍成本则不值得。

### 15.4 迭代原则

| 原则 | 说明 |
|------|------|
| 泛化而非打补丁 | 从失败归纳规则，而非死记测试措辞 |
| 精简优于堆砌 | 规则过多会过约束 |
| 解释原因 | 「因为 Y 常导致 Z，所以做 X」比裸 `ALWAYS` 稳 |
| 重复脚本下沉 | 每次评估手工跑的命令应进 `scripts/` |

### 15.5 与 StudyX CI

若仓库尚未接全域 eval runner，可**先落盘 `evals.json` + 手动跑**：仍比完全没有基准强；后续再挂到 `npm test` / 专用 job。

---

## 16. 「大而多域」Skill 的分层建议（单 HTTP 入口 + references / workflows）

> 来源：`skill相关修改建议.md`。当**一个对外端点**要覆盖多域（如教练：健身/饮食/影单）时，避免把万物挤进单一大 System Prompt。

### 16.1 原则：丰富 ≠ 无限拆 HTTP Skill

- **主对话、强产品绑定、SSE** → 倾向 **保留单一入口**（如 `chat_coach`）。
- **批量/教育/导入、契约与时延明显不同** → **新建独立 Skill** 或普通 REST（见下表）。

### 16.2 工具（内部能力）vs 新 Skill

| 形态 | 适合 |
|------|------|
| **Tool / 内部 API** | 提醒落地、收藏检索、打卡写入、解析管道等需**可审计、可重试**的能力 |
| **新 Skill** | 周计划从收藏批量生成、记忆术/SRS、文件导入等**大块结构化输出**或独立产品 Tab |

### 16.3 推荐目录形态（示例）

```
chat_coach/
├── SKILL.md                 # 总合同：全局原则、事件格式、Gotchas
├── references/
│   ├── persona_fitness.md
│   ├── persona_nutrition.md
│   └── ...
├── workflows/               # 可选：短篇多步 SOP
│   ├── plan_from_refs.md
│   └── weekly_review.md
└── scripts/
    ├── run.py
    ├── inject_persona.py      # 按 module / 路由拼接 reference
    └── validate_reminder_schema.py
```

**注意**：策略与语气放在 **Markdown reference**；Python **只做可测的机械步骤**（拼接、校验、解析），不要把整条对话策略写死在代码分支里。

### 16.4 编排层如何选人设（示例）

1. 产品侧 Tab / 会话前选域 → 传 `module` / `persona`，**只注入对应 reference**。
2. 轻量分类器或规则路由 → 注入主 persona + **交叉域禁止项**（防止「训练频率」套到「饮食」上）。
3. 用户一句话切换域 → 写入短期会话状态或 `system_extra`。

### 16.5 优先级参考（可并入项目 backlog）

| 优先级 | 动作 |
|--------|------|
| P0 | 按域拆分 `references/persona_*.md`，压缩顶层 `SKILL.md` |
| P0 | 收藏检索等走 **工具/API**，Skill 内写明「涉及收藏必须先检索」 |
| P1 | `workflows/` 文档化 2～3 条高频支线 |
| P2 | 批量计划类 / 进阶学习类 → **独立 Skill**（对齐单目录单技能） |

---

## 17. 框架与运行时选型（何时不必上重型框架）

> 节选 `AGENT_FRAMEWORK_OVERVIEW.md` 与 `HERMES_AGENT_ANALYSIS.md`。

### 17.1 全景模块（速览）

大型 Agent 框架常包含：LLM 层、工具注册与执行、记忆、规划/验证、多 Agent、评估与可观测、队列与沙箱、人在回路等。StudyX 当前 **Skill 文件夹 + FastAPI Router** 是在「工具与技能层」的落地 subset。

### 17.2 选型结论（与仓库一致）

| 场景 | 倾向 |
|------|------|
| Skill **数量较少**（如 <10）且流程相对固定 | **Agent Skills 文件 + 后端脚本** 通常足够 |
| Skill 增多且需自动工具路由 | 再考虑 Tool Calling / 编排框架 |
| 重 DAG / 多角色编排 | LangGraph / 自研 Planner 等 |
| 多通道、定时、强工具、长会话个人助理 | 可研究 **Nous Hermes Agent** 类产品化路径（**非** Meta 的 JavaScript 引擎 Hermes；见 `HERMES_NAMING_META_VS_NOUS.md`） |

**Hermes 一句话**：偏「**单核 Agent 循环 + Registry/MCP/Skills + SQLite 会话**」；**复杂图规划**仍以专用编排框架为主战场。

### 17.3 与本文的边界

引入 LangChain 等框架**不替代** `SKILL.md` 契约：契约仍应写清输入输出、错误码与 Gotchas；框架负责调度，不负责替你定义业务语义。

---

## 18. 延伸阅读

| 资源 | 链接 |
|------|------|
| Agent Skills 官网 | https://agentskills.io |
| Skill 创建最佳实践 | https://agentskills.io/skill-creation/best-practices |
| Skill 评估 | https://agentskills.io/skill-creation/evaluating-skills |
| Skill 与脚本 | https://agentskills.io/skill-creation/using-scripts |
| 同目录 `studyAgentV2.md` | 概念与原则全文 |
| 同目录 `AGENT_SKILLS_RESEARCH.md` | 评估细节与社区目录 |

---

## 附录：v1 §11 完整示例索引

Flash Card 的完整 `SKILL.md` 长示例、`run.py` 全文样例、Router 片段已写在 `SKILL_CONVENTION.md` 第 **§11** 与 **§12**。本 V2 为控制篇幅将 **§11** 改为索引；**复制粘贴实现时请打开 v1 该节或仓库内已实现 Skill。**

---

*修订说明（相对 v1.1）：新增文档体系地图、Skill 生态分工、三阶段加载、目录扩展（evals/workflows/assets）、复杂 Skill 与无头集成、评估与迭代、多域分层建议、框架选型与 Hermes 注释；保留 v1 核心规范条目并通过章节引用避免重复冗余。*
