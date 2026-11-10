# Exam Model 与 Goal-based Learning Model 底层技术架构方案

> 版本：v0.1  
> 目标读者：产品、技术、AI、内容、学习科学团队  
> 适用范围：标准化考试备考产品、学校课程学习产品、终身学习/技能提升产品、AI Tutor、AI Study Planner、AI Assessment 系统

---

## 0. 文档目的

本文档用于团队对齐一种面向长期个性化学习的底层技术架构。它不局限于某一个具体产品，而是讨论如何在 AI 大模型能力持续增强的趋势下，构建一个稳定、可扩展、可验证的学习智能基础设施。

本文给出两个架构方案：

1. **方案 A：Exam-specific Learning Architecture**  
   专门针对标准化考试或明确考试目标，例如 AP、SAT、ACT、IELTS、TOEFL、NCLEX、CPA、CFA、学校期中/期末考试等。

2. **方案 B：Goal-based Learning Architecture**  
   更通用的学习目标模型，覆盖所有学习目标，包括考试、学校课程、学期目标、项目目标、技能提升、职业成长和终身学习目标。

核心观点：

> 大模型负责理解、生成、解释、评分和对话；底层学习架构负责定义目标、结构化证据、维护长期学习状态、评估学习干预效果，并决定下一步最优学习行动。

这套架构的长期价值不在于“架构图本身难以复制”，而在于它能持续积累普通 AI Chat 产品无法自然沉淀的数据资产：

```text
用户学习轨迹
+ 学习证据
+ 能力状态变化
+ 推荐 / 干预动作
+ 干预后的真实结果
= 可复利的学习智能数据飞轮
```

模型越强，这些结构化数据越有价值。更强的模型可以更准确地解析材料、评分答案、生成练习和解释反馈，但它仍然需要一个外部系统来告诉它：目标是什么、历史证据是什么、状态如何变化、哪种干预曾经真的有效。

---

# Part I：总体判断

## 1. 为什么更强模型仍需要学习状态与干预数据？

未来大模型会越来越强，很多能力会被模型内化：

- 理解题目
- 解释知识点
- 生成练习题
- 批改答案
- 总结错因
- 生成学习计划
- 多模态理解课堂材料、作业、图片和 PDF

但大模型本身并不能天然解决长期学习系统的关键问题：

1. 这个考试或学习目标到底要求什么？
2. 如何判断学习者已经掌握？
3. 用户过去几周、几个月的真实学习状态是什么？
4. 用户反复犯的错误是什么？
5. 哪些证据可信，哪些只是弱信号？
6. 今天最应该学什么？
7. 为什么推荐这个任务，而不是另一个任务？
8. 用户是否真的因为某个推荐而进步？
9. 如何跨产品、跨场景持续复用学习数据？

未来模型可能拥有更长上下文、更强记忆和更好的工具调用能力，但这并不等于它天然拥有一个可靠的 Learner State。对学习产品来说，真正需要的是可计算、可审计、可迁移、可评估的长期学习状态，而不是某次对话窗口里的自然语言记忆。

```text
LLM Memory 可以记住：
- 用户最近聊过什么
- 用户曾经说自己哪里不会
- 当前对话里发生了什么

Learner State 必须回答：
- 某个 dimension 的 mastery 是多少？
- 这个判断来自哪些 evidence？
- evidence 的可信度和时间衰减是多少？
- 哪些推荐曾经带来提升？
- 用户跨考试、跨课程、跨年份的能力曲线如何变化？
```

因此，底层系统不能只是“更好的 Prompt”或“更强的 LLM”。真正需要构建的是一个稳定的中间层：

```text
Learning Goal / Exam Model
        ↓
Learning Evidence System
        ↓
Student / Learner State Engine
        ↓
Adaptive Decision Engine
        ↓
Learning Intervention & Outcome Measurement
        ↓
AI Orchestration Layer
        ↓
Personalized Learning Experience
```

---

## 2. 三层基础资产 + 一层复利资产 + 两层可变能力

建议把底层架构拆成三层基础资产、一层复利资产和两层可变能力。

### 三层基础资产

#### 1. Exam / Goal Model

定义考试或学习目标的结构、能力维度、评分标准、证据规则和推荐策略。

#### 2. Learner State

记录学习者在某个考试或学习目标下的长期状态，包括掌握度、信心、错因、遗忘风险、行为习惯、目标进度和预测结果。

#### 3. Learning Evidence System

把用户所有学习行为转成标准化证据，例如作答、改错、上传作业、看解释、复习 flashcards、提交 essay、完成项目等。

### 一层复利资产

#### 4. Intervention Outcome Data

记录系统对用户做过什么学习干预，以及干预之后用户是否真的进步。例如推荐了哪组练习、使用了哪种解释、安排了哪个复习时机、用户是否完成、完成后相关能力是否提升。

这层数据是长期护城河的核心。架构本身可以被复制，但大规模、长期、细粒度的“错因 → 干预 → 结果”数据很难被后来者直接获得。

### 两层可变能力

#### 5. AI Model Layer

可以不断替换、组合和升级，例如 GPT、Claude、Gemini、小模型、自研模型、多模态模型等。

#### 6. Product Experience Layer

可以是多个不同产品，例如 AI Tutor、Exam Prep App、Flashcards、Mock Test、Essay Grader、Learning Coach、Skill Learning App 等。

---

## 2.5. 真正的护城河：学习干预效果数据飞轮

这套系统的护城河不是“有一个 Exam Model / Goal Model”，而是架构让产品能持续积累下面这种数据：

```text
某类学习者
在某个目标 / 能力维度下
出现某类错因或遗忘风险
接受某种学习干预
之后在 1 天、7 天、30 天内是否真的进步
```

核心飞轮如下：

```text
Learning Event
  ↓
Learning Evidence
  ↓
Learner State
  ↓
Recommendation / Intervention
  ↓
User Action
  ↓
Outcome Measurement
  ↓
Recommendation Improvement
  ↓
Better Recommendation / Intervention
```

早期可以用规则推荐，但每一次推荐都应该被记录为一次 learning intervention，并追踪结果：

```json
{
  "intervention_id": "int_001",
  "user_id": "u_123",
  "goal_id": "ap_us_history_score_5",
  "intervention_type": "micro_remediation",
  "target_dimensions": [
    "period_3_1754_1800",
    "causation"
  ],
  "reason_codes": [
    "weak_causal_explanation",
    "recent_error_frequency"
  ],
  "content_ids": [
    "lesson_period_3_causation",
    "drill_period_3_causation_5q"
  ],
  "created_from_recommendation_id": "rec_001"
}
```

干预结果也必须结构化：

```json
{
  "intervention_outcome_id": "out_001",
  "intervention_id": "int_001",
  "completion_status": "completed",
  "before_mastery": 0.45,
  "after_mastery": 0.53,
  "post_assessment_score": 0.72,
  "measured_after_days": 7,
  "outcome": "improved"
}
```

随着用户规模扩大，系统会逐渐知道：

```text
哪类题最能诊断某个错因
哪种解释最适合某类学生
哪组练习最能提升某个 dimension
什么复习间隔最能降低遗忘风险
哪些内容看似完成率高但实际提分弱
哪些推荐对高分段 / 低分段用户分别有效
```

这类数据不是通用大模型天然拥有的，也不是简单采购题库就能得到的。它来自真实用户在真实学习目标下的长期交互，是 Personal Learning OS 最重要的复利资产。

---

## 2.6. Personal Learning OS 作为一个 mini world model

可以把 Personal Learning OS 理解为一个专门帮助人类提升自己的 mini world model。

它不试图模拟完整物理世界，也不试图建模一个人的全部人生，而是建模一个更窄但非常关键的世界：

```text
某个人
在某个目标下
当前处于什么状态
做某个学习行动
会不会变得更好
```

它的最小形式是：

```text
Person + Goal + State + Action → Outcome
```

在这个模型里，核心对象不是地点、物品或外部事件，而是：

```text
Goal：用户想达到什么结果
Competency：达成目标需要哪些能力
Observation：系统观察到哪些学习行为和表现
Evidence：这些行为说明了什么
State：系统当前如何估计用户状态
Action：下一步可以安排什么学习行动
Outcome：行动之后是否真的更接近目标
```

因此，Personal Learning OS 的世界观不是“用户是一个静态画像”，而是：

> 用户是一个会因为行动而改变的系统。

普通用户画像主要回答：

```text
这个用户喜欢什么？
这个用户会点击什么？
这个用户会购买什么？
```

Personal Learning OS 需要回答：

```text
这个用户现在缺什么？
他为什么卡住？
什么行动最可能让他进步？
做完之后他真的变好了吗？
```

从技术角度，它具备一个 mini world model 的关键部件：

```text
Observation：Learning Event / Learning Evidence
Belief State：Learner State
Action：Learning Intervention
Transition：State Update + Outcome Prediction
Reward：Progress toward Goal
Policy：Recommendation Engine
```

换句话说，系统每次都在做一个小型预测：

```text
如果当前用户状态是 S
执行学习行动 A
下一状态 S' 是否会更接近目标 G？
```

早期这个 transition model 可以很简单：

```text
完成针对性 drill → 对应 mastery 小幅上升
连续同类错误 → mastery 下降 + mistake risk 上升
长时间未复习 → forgetting risk 上升
完成改错并重做正确 → mastery 上升 + mistake risk 下降
```

长期则可以从 intervention outcome 数据中学习更精细的规律：

```text
对低基础学生，先 mini lesson 再 drill 效果更好
对中高分学生，mixed practice 的收益更高
对写作型错因，revision task 比选择题 drill 更有效
考试前 10 天，mock section 的收益高于章节慢复习
```

这就是 Personal Learning OS 与普通 AI Tutor 的根本区别。普通 AI Tutor 主要回答用户当下的问题；Personal Learning OS 则持续维护一个关于“这个人如何通过行动变得更好”的可计算模型。

LLM 在这个系统中更像强大的 perception / generation / reasoning module：

```text
看懂题目
理解答案
解释概念
生成练习
和用户对话
```

Personal Learning OS 则负责长期闭环：

```text
记住目标
维护状态
选择行动
观察结果
修正策略
```

因此，模型越强，Personal Learning OS 的感知和行动生成能力越强；但如果没有这个 OS，模型每次都更像是在重新认识这个人。

---

# Part II：方案 A — Exam-specific Learning Architecture

## 3. 方案 A 的适用场景

Exam-specific Architecture 适合外部标准明确、评分规则明确、学习目标较清晰的场景：

- AP US History
- SAT Math
- ACT English
- IELTS Writing
- TOEFL Speaking
- NCLEX
- CPA
- CFA
- 学校期中/期末考试
- 职业认证考试

这类目标的共同特点：

```text
有明确考试范围
有题型结构
有评分标准
有目标分数或通过标准
有备考周期
有标准题库或可构建题库
```

---

## 4. Exam Model 的定义

Exam Model 不是一个独立训练的小模型，也不是单纯的知识图谱。它是一个可计算的考试语义层。

> Exam Model = 定义一个考试“考什么、怎么考、怎么评分、如何诊断、如何推荐”的结构化模型。

它至少包含五个子模型：

```text
1. Blueprint Model
2. Measurement Model
3. Scoring / Rubric Model
4. State Update Model
5. Recommendation Model
```

---

## 5. Exam Model 的核心结构

```json
{
  "exam_id": "ap_us_history",
  "exam_name": "AP United States History",
  "exam_type": "standardized_exam",
  "provider": "college_board",
  "version": "2026",
  "score_scale": {},
  "blueprint_model": {},
  "measurement_model": {},
  "scoring_model": {},
  "rubric_model": {},
  "state_update_model": {},
  "recommendation_model": {},
  "ai_behavior_model": {}
}
```

---

## 6. Blueprint Model：考试结构

Blueprint Model 回答：**这个考试考什么？**

它包括：

- 内容模块
- 子主题
- 能力维度
- 题型
- 分数结构
- 考试权重
- 官方标准版本

以 AP US History 为例：

```json
{
  "blueprint_model": {
    "content_units": [
      {
        "id": "period_1_1491_1607",
        "name": "Period 1: 1491–1607",
        "weight": 0.04
      },
      {
        "id": "period_2_1607_1754",
        "name": "Period 2: 1607–1754",
        "weight": 0.08
      },
      {
        "id": "period_3_1754_1800",
        "name": "Period 3: 1754–1800",
        "weight": 0.12
      }
    ],
    "skills": [
      "source_analysis",
      "contextualization",
      "causation",
      "comparison",
      "argumentation"
    ],
    "question_types": [
      "mcq",
      "saq",
      "dbq",
      "leq"
    ]
  }
}
```

关键原则：

> Blueprint 不应只描述知识点，也必须描述技能、题型和评分维度。

因为备考不是单纯掌握知识，而是在特定题型和评分标准下表现得更好。

---

## 7. Measurement Model：测量模型

Measurement Model 回答：**每一道题、每个任务到底测量什么？**

例如一道 APUSH SAQ 题可能测量：

```json
{
  "question_type": "saq",
  "measures": [
    {
      "dimension_id": "period_3_1754_1800",
      "dimension_type": "content",
      "weight": 0.35
    },
    {
      "dimension_id": "causation",
      "dimension_type": "skill",
      "weight": 0.45
    },
    {
      "dimension_id": "specific_evidence_usage",
      "dimension_type": "rubric_item",
      "weight": 0.20
    }
  ]
}
```

这一步非常重要，因为它决定用户做错一道题时，到底应该更新哪些状态。

错误示例：

```text
用户答错 → 历史不好
```

正确示例：

```text
用户答错 → Period 3 掌握略低 + causation 能力明显弱 + specific evidence 使用不足
```

---

## 8. Scoring / Rubric Model：评分模型

Scoring Model 回答：**如何评价用户表现？**

不同题型有不同评分方式：

```text
MCQ：binary scoring
SAQ：partial credit / rubric scoring
DBQ：rubric scoring
LEQ：rubric scoring
SAT Math：binary + difficulty + time pressure
IELTS Writing：multi-dimensional rubric
NCLEX：clinical judgment / decision path
```

示例：APUSH DBQ Rubric

```json
{
  "rubric_model": {
    "dbq": {
      "max_score": 7,
      "dimensions": [
        {
          "id": "thesis",
          "max_points": 1,
          "criteria": [
            "Makes a historically defensible claim",
            "Responds to the prompt",
            "Establishes a line of reasoning"
          ]
        },
        {
          "id": "contextualization",
          "max_points": 1
        },
        {
          "id": "evidence",
          "max_points": 3
        },
        {
          "id": "analysis_reasoning",
          "max_points": 2
        }
      ]
    }
  }
}
```

Rubric Model 不只是为了给分，更重要的是用于更新用户的能力状态：

```text
DBQ thesis mastery
DBQ evidence mastery
DBQ sourcing mastery
DBQ reasoning mastery
```

---

## 9. State Update Model：状态更新模型

State Update Model 回答：**一个学习证据如何改变用户状态？**

MVP 阶段可以用规则，不必一开始上复杂算法。

示例规则：

```json
{
  "if": {
    "event_type": "question_answered",
    "is_correct": false,
    "difficulty": "medium"
  },
  "then": {
    "mastery_delta": -0.04,
    "confidence_delta": 0.03,
    "add_to_mistake_bank": true
  }
}
```

更合理的是把状态更新拆为：

```text
Raw Event
→ Tagged Evidence
→ State Update
→ Recommendation
→ User-facing Explanation
```

### 需要维护的状态

```text
Content Mastery
Skill Mastery
Question Type Mastery
Rubric Mastery
Memory / Forgetting Risk
Mistake Pattern
Speed / Fluency
Behavior State
Predicted Score
Confidence
```

---

## 10. Recommendation Model：推荐模型

Recommendation Model 回答：**下一步最应该让用户做什么？**

推荐不应该完全交给大模型自由生成，而应由系统根据用户状态、考试结构和目标分决定。

示例优先级公式：

```text
priority_score =
  exam_weight * 0.25
+ weakness_gap * 0.25
+ forgetting_risk * 0.15
+ recent_error_frequency * 0.15
+ target_score_impact * 0.10
+ time_to_exam_urgency * 0.10
```

推荐结果不是简单的“学习计划”，而是 Next Best Learning Action：

```json
{
  "action_type": "weakness_drill",
  "title": "Practice Period 3 causation",
  "reason": "You missed recent questions involving causes of the American Revolution.",
  "estimated_minutes": 15,
  "targets": [
    "period_3_1754_1800",
    "causation"
  ],
  "tasks": [
    {
      "type": "mini_lesson",
      "minutes": 4
    },
    {
      "type": "practice_questions",
      "count": 5
    },
    {
      "type": "reflection",
      "minutes": 2
    }
  ]
}
```

---

# Part III：用户上传课堂内容与作业时的处理链路

## 11. 场景示例

用户拍照上传今天学校学习内容和作业情况：

```text
课堂内容：
AP US History - Causes of the American Revolution

作业题：
Explain how the French and Indian War contributed to the American Revolution.

学生答案：
The war made Britain stronger and helped America become independent.
```

系统不能只是给出标准答案，而应该把这次上传转化为长期学习状态的一部分。

---

## 12. Step 1：Document Understanding

先把图片拆成结构化对象：

```json
{
  "input_type": "photo",
  "detected_objects": [
    {
      "object_type": "class_content",
      "text": "Causes of the American Revolution"
    },
    {
      "object_type": "homework_question",
      "text": "Explain how the French and Indian War contributed to the American Revolution."
    },
    {
      "object_type": "student_answer",
      "text": "The war made Britain stronger and helped America become independent."
    }
  ]
}
```

此时还不更新学习状态，因为这只是原始输入解析。

---

## 13. Step 2：Exam Matching

判断内容属于哪个考试模型：

```json
{
  "exam_candidates": [
    {
      "exam_id": "ap_us_history",
      "confidence": 0.93
    },
    {
      "exam_id": "us_history_high_school",
      "confidence": 0.72
    }
  ],
  "selected_exam_id": "ap_us_history"
}
```

如果用户已处于某个 exam path 下，可直接绑定对应 exam_id。

---

## 14. Step 3：Tagging

用 Exam Model 给题目、课堂内容和学生答案打标签。

```json
{
  "exam_id": "ap_us_history",
  "content_tags": [
    {
      "dimension_id": "period_3_1754_1800",
      "confidence": 0.94
    },
    {
      "dimension_id": "french_and_indian_war",
      "confidence": 0.91
    },
    {
      "dimension_id": "american_revolution_causes",
      "confidence": 0.89
    }
  ],
  "skill_tags": [
    {
      "dimension_id": "causation",
      "confidence": 0.92
    },
    {
      "dimension_id": "contextualization",
      "confidence": 0.63
    }
  ],
  "question_type": {
    "id": "saq_like",
    "confidence": 0.78
  },
  "difficulty": 0.48
}
```

关键原则：

> Tagging 不是自由标签，而是受 Exam Model 约束的结构化映射。

---

## 15. Step 4：Answer Evaluation

根据题型和评分标准评价用户答案。

```json
{
  "answer_evaluation": {
    "overall_quality": 0.38,
    "is_correct": false,
    "partial_credit": 0.4,
    "rubric_scores": [
      {
        "rubric_item": "identifies_relevant_event",
        "score": 1,
        "max_score": 1
      },
      {
        "rubric_item": "explains_causal_link",
        "score": 0,
        "max_score": 1
      },
      {
        "rubric_item": "uses_specific_evidence",
        "score": 0,
        "max_score": 1
      }
    ],
    "mistake_types": [
      "weak_causal_explanation",
      "missing_specific_evidence",
      "oversimplified_historical_relationship"
    ],
    "feedback_summary": "The answer mentions independence but does not explain the causal chain from war debt to British taxation to colonial resistance."
  }
}
```

---

## 16. Step 5：生成 Learning Events

同一次上传应生成多个事件，而不是一个事件。

### Event A：课堂内容上传

```json
{
  "event_type": "class_content_uploaded",
  "exam_id": "ap_us_history",
  "source": "photo_upload",
  "content_tags": [
    "period_3_1754_1800",
    "american_revolution_causes"
  ],
  "skill_tags": [
    "causation"
  ],
  "evidence_strength": 0.25,
  "meaning": "user_is_currently_learning_this_topic"
}
```

该事件主要更新：

```text
current_school_context
recent_topics
near-term review candidates
```

它不应强烈更新 mastery，因为“看到了课堂内容”不等于“已经掌握”。

### Event B：提交作业尝试

```json
{
  "event_type": "homework_attempt_submitted",
  "exam_id": "ap_us_history",
  "question_type": "saq_like",
  "content_tags": [
    "period_3_1754_1800",
    "french_and_indian_war"
  ],
  "skill_tags": [
    "causation"
  ],
  "difficulty": 0.48,
  "student_answer_present": true,
  "evidence_strength": 0.65
}
```

### Event C：答案评价结果

```json
{
  "event_type": "answer_evaluated",
  "exam_id": "ap_us_history",
  "question_type": "saq_like",
  "content_tags": [
    "period_3_1754_1800",
    "french_and_indian_war"
  ],
  "skill_tags": [
    "causation"
  ],
  "result": {
    "partial_credit": 0.4,
    "overall_quality": 0.38,
    "rubric_scores": {
      "identifies_relevant_event": 1,
      "explains_causal_link": 0,
      "uses_specific_evidence": 0
    },
    "mistake_types": [
      "weak_causal_explanation",
      "missing_specific_evidence"
    ]
  },
  "evidence_strength": 0.8
}
```

### Event D：用户修改答案后再次提交

```json
{
  "event_type": "answer_revised",
  "exam_id": "ap_us_history",
  "before_quality": 0.38,
  "after_quality": 0.72,
  "improved_dimensions": [
    "explains_causal_link",
    "uses_specific_evidence"
  ],
  "evidence_strength": 0.9
}
```

这个事件非常重要，因为它证明用户在反馈后产生了真实进步。

---

## 17. Step 6：Learning Events 转成 Learning Evidence

Learning Event 表示发生了什么；Learning Evidence 表示这件事说明了什么。

```json
{
  "evidence_id": "evd_001",
  "user_id": "u_123",
  "exam_id": "ap_us_history",
  "dimension_id": "period_3_1754_1800",
  "evidence_type": "answer_quality",
  "observed_score": 0.38,
  "confidence": 0.82,
  "direction": "negative",
  "source_event_id": "event_answer_evaluated"
}
```

```json
{
  "evidence_id": "evd_002",
  "user_id": "u_123",
  "exam_id": "ap_us_history",
  "dimension_id": "causation",
  "evidence_type": "rubric_performance",
  "observed_score": 0.32,
  "confidence": 0.86,
  "direction": "negative",
  "mistake_type": "weak_causal_explanation"
}
```

---

## 18. Step 7：更新 Student Learning State

更新前：

```json
{
  "period_3_1754_1800": {
    "mastery": 0.58,
    "confidence": 0.42
  },
  "causation": {
    "mastery": 0.52,
    "confidence": 0.46
  },
  "french_and_indian_war": {
    "mastery": 0.50,
    "confidence": 0.30
  }
}
```

更新后：

```json
{
  "period_3_1754_1800": {
    "mastery": 0.54,
    "confidence": 0.50,
    "last_evidence_at": "2026-05-11"
  },
  "causation": {
    "mastery": 0.45,
    "confidence": 0.58,
    "last_evidence_at": "2026-05-11"
  },
  "french_and_indian_war": {
    "mastery": 0.43,
    "confidence": 0.48,
    "last_evidence_at": "2026-05-11"
  },
  "mistake_patterns": {
    "weak_causal_explanation": {
      "count_30d": 2,
      "last_seen_at": "2026-05-11"
    },
    "missing_specific_evidence": {
      "count_30d": 3,
      "last_seen_at": "2026-05-11"
    }
  },
  "current_school_context": {
    "recent_topics": [
      "american_revolution_causes",
      "french_and_indian_war"
    ]
  }
}
```

核心原则：

```text
课堂内容上传：弱更新 current context
作业答案质量：强更新 mastery / skill / mistake pattern
用户修改后提升：强更新 mastery，并降低相关 mistake risk
```

---

## 19. Step 8：生成即时反馈和下一步任务

面向用户的反馈应简洁：

```text
You understand the topic generally, but your answer is missing the causal chain.

Better answer:
The French and Indian War left Britain with heavy debt. To pay for it, Britain taxed the colonies more directly, such as through the Stamp Act. These taxes increased colonial resistance and helped lead to the American Revolution.

Today’s follow-up:
1. Review: war debt → taxation → colonial resistance
2. Practice: 3 causation questions on Period 3
3. Fix your answer using one specific example
```

内部推荐对象：

```json
{
  "recommendation_type": "micro_remediation",
  "targets": [
    "period_3_1754_1800",
    "causation",
    "french_and_indian_war"
  ],
  "reason_codes": [
    "weak_causal_explanation",
    "missing_specific_evidence",
    "recent_school_topic"
  ],
  "tasks": [
    {
      "type": "mini_lesson",
      "duration_minutes": 3
    },
    {
      "type": "practice_drill",
      "question_count": 3
    },
    {
      "type": "answer_revision",
      "duration_minutes": 4
    }
  ]
}
```

---

# Part IV：Content & Assessment Supply Strategy

## 20. 标准课程 / 备考内容资源如何构建？

Exam Model 是内容建设骨架。内容资源不是散落的文章、视频或题解，而是挂载到 Exam Model 上的 Learning Objects。

但内容建设不能被视为一个简单的“填充题库”任务。对 Exam Prep 产品来说，内容层本身是和技术架构同等重要的系统：

```text
没有高质量内容 → evidence 不可信
没有准确标注 → learner state 被污染
没有校准数据 → recommendation 无法判断什么真的有效
没有 remediation 内容 → 诊断之后无法形成进步闭环
```

因此，内容建设的目标不是“有足够多的题”，而是建立一套可测量、可校准、可持续改进的 Assessment & Learning Object Supply System。

建议流程：

```text
Step 1: 从官方大纲 / 标准 / 评分规则建立 Exam Model
Step 2: 为每个 dimension 定义 learning objectives
Step 3: 为每个 objective 创建 mini lesson / example / flashcard / quiz / drill
Step 4: 每个内容资源绑定 dimensions、difficulty、use case
Step 5: 专家审核关键标注、rubric 和解释质量
Step 6: 根据用户表现校准 difficulty / discrimination / mistake_tags
Step 7: 根据干预结果验证哪些内容真正有效
Step 8: 对低质量内容降权、修订或淘汰
```

内容供给可以采用三种模式组合：

```text
专家建设
- 适合官方大纲、rubric、核心题型、关键解释
- 成本高，但质量和可信度最高

AI 辅助生成 + 人工审核
- 适合生成练习变体、错因解释、mini lesson、flashcards
- 需要审核 official alignment、事实准确性、难度和评分标准

授权 / 采购题库
- 适合快速补足标准题库与模拟题
- 必须重新绑定 dimensions、difficulty、mistake_tags 和 evidence_value
```

内容生命周期应是闭环，而不是一次性交付：

```text
Create
  ↓
Tag
  ↓
Review
  ↓
Calibrate
  ↓
Deploy
  ↓
Measure
  ↓
Improve / Retire
```

核心质量指标包括：

```text
difficulty：题目实际难度是否与预期一致
discrimination：题目是否能区分不同能力水平用户
rubric reliability：主观题评分是否稳定一致
remediation effectiveness：对应补救内容是否真的带来提升
content freshness：内容是否仍符合最新考试标准和课程进度
```

---

## 21. Learning Object 示例

```json
{
  "content_id": "lesson_apush_p3_french_indian_war_causes",
  "exam_id": "ap_us_history",
  "content_type": "mini_lesson",
  "title": "How the French and Indian War led to the American Revolution",
  "target_dimensions": [
    "period_3_1754_1800",
    "french_and_indian_war",
    "american_revolution_causes",
    "causation"
  ],
  "difficulty": 0.45,
  "estimated_minutes": 4,
  "prerequisites": [
    "colonial_british_relations"
  ],
  "learning_objectives": [
    "Explain how war debt changed British colonial policy",
    "Connect British taxation to colonial resistance"
  ],
  "use_cases": [
    "learn",
    "review",
    "remediate"
  ],
  "output_formats": [
    "text_lesson",
    "flashcards",
    "quiz",
    "timeline"
  ]
}
```

---

## 22. 内容资源库结构

```text
exam_model
  └── dimension: period_3
        ├── learning_objective: explain_causes_of_american_revolution
        │      ├── mini_lesson
        │      ├── worked_example
        │      ├── flashcards
        │      ├── mcq_questions
        │      ├── saq_questions
        │      └── common_mistakes
        └── learning_objective: compare_patriot_and_loyalist_perspectives
               ├── source_analysis_lesson
               ├── primary_source_set
               ├── quiz
               └── writing_drill
```

---

## 23. 标准模拟题库放在哪一层？

标准模拟题库应放在：

> Assessment Content Layer / Question Bank Layer

它不是 Exam Model 本身，但每一道题必须绑定 Exam Model。

```text
Exam Model Layer
- 定义考试结构、技能、题型、评分规则

Assessment Content Layer
- 标准题库、模拟题、真题风格题、作文题、听力材料等

Learning Evidence Layer
- 用户做题后的行为和结果

Student State Layer
- 用户掌握度、错因、预测分
```

---

## 24. 题目结构示例

```json
{
  "question_id": "apush_mcq_000123",
  "exam_id": "ap_us_history",
  "exam_model_version": "2026",
  "question_type": "mcq",
  "content_dimensions": [
    "period_3_1754_1800",
    "french_and_indian_war"
  ],
  "skill_dimensions": [
    "causation",
    "source_analysis"
  ],
  "difficulty": 0.62,
  "discrimination": 0.74,
  "estimated_time_seconds": 60,
  "answer_key": "B",
  "explanation_id": "exp_000123",
  "common_mistake_tags": [
    "confuses_war_outcome_with_cause",
    "misses_british_debt_taxation_link"
  ],
  "evidence_value": {
    "period_3_1754_1800": 0.35,
    "french_and_indian_war": 0.35,
    "causation": 0.30
  }
}
```

题库的本质是测量工具。Exam Model 定义“要测什么”，题库提供“用什么测”。

题目上线后还需要持续校准：

```json
{
  "question_calibration_stats": {
    "question_id": "apush_mcq_000123",
    "attempt_count": 1842,
    "observed_difficulty": 0.67,
    "observed_discrimination": 0.71,
    "top_mistake_tags": [
      {
        "mistake_tag": "misses_british_debt_taxation_link",
        "frequency": 0.34
      }
    ],
    "remediation_effectiveness": {
      "drill_period_3_causation_5q": 0.18,
      "lesson_period_3_causal_chain": 0.11
    },
    "quality_status": "active"
  }
}
```

如果一道题频繁产生低置信度标签、用户反馈争议大、或完成后无法预测后续表现，应进入 review queue，而不是继续作为强证据更新用户状态。

---

## 25. 模拟卷结构示例

一套 mock exam 不是一组题目的集合，而是 assessment blueprint 的实例。

```json
{
  "mock_exam_id": "apush_mock_001",
  "exam_id": "ap_us_history",
  "blueprint_alignment": {
    "period_1": 0.04,
    "period_2": 0.08,
    "period_3": 0.12,
    "period_4": 0.10
  },
  "question_type_distribution": {
    "mcq": 55,
    "saq": 3,
    "dbq": 1,
    "leq": 1
  },
  "skill_distribution": {
    "causation": 0.18,
    "comparison": 0.16,
    "source_analysis": 0.22
  },
  "difficulty_distribution": {
    "easy": 0.25,
    "medium": 0.50,
    "hard": 0.25
  }
}
```

---

# Part V：个性化学习计划如何生成

## 26. 个性化不是让 LLM 自由生成计划

稳定的个性化链路应该是：

```text
Student State 判断用户需要什么
Exam Model 判断什么重要
Content / Question Bank 提供可选材料
Decision Engine 决定顺序和节奏
LLM 生成适合用户的表达、讲解和变体练习
```

---

## 27. 个性化计划生成流程

### Step 1：读取用户状态

```json
{
  "target_score": 5,
  "exam_date": "2026-05-08",
  "weekly_available_minutes": 240,
  "mastery": {
    "period_3": 0.43,
    "period_5": 0.71,
    "causation": 0.45,
    "source_analysis": 0.66,
    "dbq_evidence": 0.39
  },
  "mistake_patterns": [
    "weak_causal_explanation",
    "missing_specific_evidence"
  ],
  "behavior": {
    "avg_session_minutes": 14,
    "completion_rate": 0.62,
    "preferred_task_type": "quiz"
  }
}
```

### Step 2：计算优先级

```json
[
  {
    "target": "dbq_evidence",
    "priority": 0.91,
    "reason": "High score impact and low mastery"
  },
  {
    "target": "period_3_causation",
    "priority": 0.87,
    "reason": "Repeated recent mistakes"
  },
  {
    "target": "period_5_reconstruction",
    "priority": 0.52,
    "reason": "Moderate exam weight but acceptable mastery"
  }
]
```

### Step 3：检索内容和题目

```json
{
  "selected_learning_objects": [
    {
      "type": "mini_lesson",
      "id": "lesson_period_3_causation_war_debt_taxation"
    },
    {
      "type": "worked_example",
      "id": "example_saq_causal_chain"
    },
    {
      "type": "practice_set",
      "id": "drill_period_3_causation_5q"
    },
    {
      "type": "revision_task",
      "id": "rewrite_user_answer_with_evidence"
    }
  ]
}
```

### Step 4：生成用户可执行计划

```json
{
  "daily_plan": {
    "estimated_minutes": 18,
    "mission": "Fix your causation explanation for Period 3",
    "tasks": [
      {
        "type": "mini_lesson",
        "minutes": 4,
        "target": "war debt → taxation → colonial resistance"
      },
      {
        "type": "worked_example",
        "minutes": 3
      },
      {
        "type": "practice_questions",
        "count": 3,
        "minutes": 8
      },
      {
        "type": "answer_revision",
        "minutes": 3
      }
    ]
  }
}
```

---

## 28. 千人千面的体现

同样是 APUSH Period 3，不同学生得到不同计划。

### Student A：基础事实不懂

```text
任务：mini lesson + timeline + 基础 flashcards
原因：基础知识薄弱
```

### Student B：知识懂，但不会写 SAQ

```text
任务：SAQ answer frame + causation explanation drills
原因：skill mastery 低
```

### Student C：DBQ 失分

```text
任务：document sourcing + evidence explanation drill
原因：rubric item evidence/reasoning 低
```

### Student D：快考试了

```text
任务：mixed review + mock section + high-yield weak spots
原因：time urgency 高，不能再按章节慢慢学
```

### Student E：每天只有 10 分钟

```text
任务：micro-mission，1 个概念 + 2 题 + 1 张错题卡
原因：学习时间短，计划必须轻量
```

---

# Part VI：方案 A 的数据架构

## 29. 核心表设计

### Exam Model Layer

```text
exam
exam_version
exam_dimension
exam_relationship
exam_rubric
exam_measurement_rule
exam_state_update_rule
exam_recommendation_rule
```

### Content Layer

```text
learning_object
learning_object_dimension_map
learning_object_prerequisite
learning_object_variant
```

### Question Bank Layer

```text
question
question_dimension_map
question_choice
question_solution
question_common_mistake
mock_exam
mock_exam_question
mock_exam_blueprint
```

### Evidence Layer

```text
raw_user_input
parsed_learning_object
learning_event
learning_evidence
```

### Student State Layer

```text
user_exam_profile
user_dimension_state
user_mistake_pattern
user_memory_state
user_behavior_state
user_score_prediction
```

### Personalization Layer

```text
recommendation
study_plan
study_plan_task
task_result
```

### Evaluation / Flywheel Layer

```text
learning_intervention
intervention_outcome
content_effectiveness
recommendation_feedback
recommendation_experiment
question_calibration_stats
outcome_feedback
```

`outcome_feedback` 不应只是任务完成后的附属记录，而应成为数据飞轮的核心对象。它连接 recommendation、intervention、content、question 和后续学习表现，用来回答：

```text
这次推荐有没有被完成？
完成后相关 dimension 有没有提升？
提升是短期表现，还是 7 天 / 30 天后仍然保留？
是内容有效，还是用户本来就会？
同样干预对哪些用户群体最有效？
```

---

## 30. 核心服务设计

```text
Exam Model Service
- 读取考试结构、版本、rubric、规则

Tagging Service
- 把用户内容映射到 exam dimensions

Scoring Service
- 处理题目、作文、主观题评分

Evidence Service
- 把产品行为标准化为 learning evidence

Student State Service
- 更新 mastery、confidence、memory、prediction

Recommendation Service
- 生成 next best action

AI Orchestration Service
- 调用 LLM 解释、生成、评分、对话

Evaluation Service
- 衡量推荐、内容和学习干预是否有效
- 维护 intervention_outcome、content_effectiveness、question_calibration_stats
```

---

# Part VII：方案 B — Goal-based Learning Architecture

## 31. 为什么需要从 Exam Model 升级到 Goal Model？

Exam Model 适合标准化考试，但真实学习目标远不止考试。

用户可能有这些目标：

```text
本学期 Algebra 拿 A
下个月 Biology quiz 考到 90+
完成 World History research paper
30 天学会 Python 数据分析
6 周内做出个人网站
提高英文写作能力
学习 AI 产品经理能力
了解美国历史
完成摄影入门作品集
```

这些目标不一定有标准考试，但仍然可以被建模。

因此，Exam Model 应进一步抽象为：

> Goal-based Learning Model：围绕任何学习目标，定义“要学什么、如何证明学会了、当前差距在哪里、下一步该做什么”的通用模型。

---

## 32. Exam 是 Goal 的一个子类型

```text
Learning Goal Model
├── Exam Goal Model
│   ├── AP US History
│   ├── SAT Math
│   ├── NCLEX
│   └── CPA
├── Course Goal Model
│   ├── 8th Grade Algebra Semester 1
│   ├── Biology Unit 3
│   └── College Economics Midterm
├── Project Goal Model
│   ├── Build a personal website
│   ├── Write a research paper
│   └── Prepare a science fair project
├── Skill Goal Model
│   ├── Learn Python data analysis
│   ├── Improve academic writing
│   └── Speak Spanish at travel level
└── Interest Goal Model
    ├── Understand World War II
    ├── Learn photography basics
    └── Study personal finance
```

---

## 33. Goal Model 的定义

> Goal Model = 定义一个学习目标的目标结果、能力结构、证据标准、内容结构、状态更新和推荐策略的通用模型。

通用结构：

```json
{
  "goal_id": "string",
  "goal_type": "exam | course | unit | project | skill | interest | career",
  "title": "string",
  "owner": "official | school | teacher | user | platform",
  "target_outcome": {},
  "time_horizon": {},
  "competency_model": {},
  "assessment_model": {},
  "content_model": {},
  "evidence_model": {},
  "state_model": {},
  "recommendation_model": {}
}
```

---

## 34. Goal Model 的七层结构

### 1. Outcome Model：目标结果

回答：最终要达到什么？

```json
{
  "outcome_model": {
    "target_type": "score | grade | mastery | project | habit | performance",
    "target": {
      "score": 5,
      "grade": "A",
      "deliverable": "build_a_portfolio_website",
      "performance": "hold_a_10_minute_conversation"
    },
    "deadline": "2026-05-08",
    "success_criteria": []
  }
}
```

### 2. Competency Model：能力结构

回答：达到目标需要哪些能力？

```json
{
  "competency_model": {
    "competencies": [
      {
        "id": "concept_understanding",
        "type": "knowledge"
      },
      {
        "id": "problem_solving",
        "type": "skill"
      },
      {
        "id": "written_explanation",
        "type": "performance"
      }
    ]
  }
}
```

### 3. Assessment Model：如何证明学会了

回答：什么证据说明用户达成目标？

```json
{
  "assessment_model": {
    "evidence_types": [
      {
        "type": "quiz",
        "measures": [
          "python_syntax"
        ],
        "evidence_strength": 0.4
      },
      {
        "type": "coding_task",
        "measures": [
          "pandas",
          "debugging",
          "data_cleaning"
        ],
        "evidence_strength": 0.85
      },
      {
        "type": "project",
        "measures": [
          "end_to_end_analysis"
        ],
        "evidence_strength": 0.95
      }
    ]
  }
}
```

### 4. Content Model：学习资源结构

回答：有哪些资源可以帮助学习者进步？

```text
mini lesson
worked example
flashcard
quiz
practice task
project
reflection
mock assessment
```

### 5. Evidence Model：行为如何转成证据

```json
{
  "learning_event": {
    "goal_id": "grade_10_algebra_semester_1",
    "event_type": "homework_attempt_submitted",
    "target_competencies": [
      "linear_equations",
      "word_problem_modeling"
    ],
    "result": {
      "score": 0.6,
      "mistake_types": [
        "equation_setup_error"
      ]
    },
    "evidence_strength": 0.75
  }
}
```

### 6. Learner State Model：学习者当前状态

```json
{
  "user_id": "u_123",
  "goal_id": "learn_python_data_analysis_30_days",
  "goal_state": {
    "progress": 0.42,
    "readiness": 0.36,
    "mastery": {
      "python_syntax": 0.72,
      "pandas_dataframe": 0.45,
      "data_cleaning": 0.31,
      "visualization": 0.28
    },
    "behavior": {
      "avg_session_minutes": 18,
      "completion_rate": 0.64
    },
    "constraints": {
      "available_minutes_per_week": 180,
      "preferred_formats": [
        "practice",
        "short_lesson"
      ]
    }
  }
}
```

### 7. Recommendation Model：下一步学习决策

```text
priority =
  goal_importance
+ competency_gap
+ deadline_urgency
+ evidence_confidence
+ prerequisite_need
+ learner_preference_fit
+ expected_progress_gain
```

---

# Part VIII：不同 Goal 类型的处理方式

## 35. 类型 A：标准考试目标

特点：

```text
外部标准强
题库充足
评分明确
deadline 明确
预测分有意义
```

典型体验：

```text
Predicted Score
Weak Spots
Mock Exam
Daily Mission
Score Opportunity
```

---

## 36. 类型 B：学校课程 / 学期目标

特点：

```text
有课程标准，但老师实际进度和作业非常重要
目标通常是 grade / homework / quiz / unit test
用户上传材料价值极高
```

目标示例：

```text
本学期 Algebra 拿 A
下个月 Biology quiz 考好
完成 World History research paper
```

这类目标需要构建 Personal Course Model：

```text
Official / common curriculum
+
User’s classroom materials
+
Teacher assignments
+
User performance
=
Personal Course Goal Model
```

典型体验：

```text
Class Progress
Assignment Coach
Upcoming Test Prep
Grade Risk
Weekly Study Plan
```

---

## 37. 类型 C：个人兴趣 / 终身学习目标

特点：

```text
没有统一考试
目标可能模糊
需要系统帮助澄清目标
assessment 需要设计出来
项目和实践比 quiz 更重要
```

目标示例：

```text
我想学 AI 产品经理
我想学 Python 数据分析
我想了解美国历史
我想提升英文写作
我想学摄影
```

典型体验：

```text
Goal Clarification
Personal Roadmap
Project-based Learning
Progress Portfolio
Milestone Review
```

---

# Part IX：Goal Blueprint

## 38. Goal Blueprint 示例：Python 数据分析

```json
{
  "goal_blueprint_id": "learn_python_data_analysis_beginner",
  "goal_type": "skill",
  "title": "Learn Python Data Analysis",
  "target_outcome": {
    "type": "project",
    "description": "Analyze a real dataset and present insights."
  },
  "competencies": [
    {
      "id": "python_basics",
      "type": "knowledge",
      "weight": 0.15
    },
    {
      "id": "pandas_dataframe",
      "type": "skill",
      "weight": 0.25
    },
    {
      "id": "data_cleaning",
      "type": "skill",
      "weight": 0.20
    },
    {
      "id": "data_visualization",
      "type": "skill",
      "weight": 0.20
    },
    {
      "id": "insight_communication",
      "type": "performance",
      "weight": 0.20
    }
  ],
  "milestones": [
    {
      "id": "m1",
      "title": "Read and inspect a CSV file",
      "target_competencies": [
        "python_basics",
        "pandas_dataframe"
      ]
    },
    {
      "id": "m2",
      "title": "Clean missing and inconsistent data",
      "target_competencies": [
        "data_cleaning"
      ]
    },
    {
      "id": "m3",
      "title": "Create charts and explain insights",
      "target_competencies": [
        "data_visualization",
        "insight_communication"
      ]
    }
  ],
  "assessment_model": {
    "primary_evidence": [
      "coding_task",
      "mini_project",
      "reflection"
    ],
    "secondary_evidence": [
      "quiz",
      "flashcard_review"
    ]
  },
  "recommendation_model": {
    "strategy": "milestone_progression"
  }
}
```

---

## 39. Goal Blueprint 示例：APUSH Score 5

```json
{
  "goal_blueprint_id": "ap_us_history_score_5",
  "goal_type": "exam",
  "target_outcome": {
    "type": "score",
    "score": 5
  },
  "competencies": [
    "period_1",
    "period_2",
    "period_3",
    "causation",
    "contextualization",
    "dbq_evidence",
    "leq_argumentation"
  ],
  "milestones": [
    "diagnostic",
    "unit_review",
    "dbq_practice",
    "mock_exam"
  ],
  "assessment_model": {
    "primary_evidence": [
      "mock_exam",
      "dbq_score",
      "mcq_accuracy"
    ]
  }
}
```

---

## 40. Goal Clarification Agent

对非标准目标，系统需要先把模糊目标转成可执行目标。

Goal Clarification Agent 不只是一个入口功能，而是 Goal-based Learning Architecture 的核心能力。它解决的是“学习目标结构化”问题：用户往往知道自己想变好，但并不知道目标结果、能力地图、证据标准和第一步行动应该如何定义。

如果 Exam Prep 的优势来自外部标准，那么长期 Goal-based Learning 的优势就来自系统能帮助用户把模糊目标变成可计算、可执行、可评估的 Goal Model。

用户输入：

```text
我想学数据分析
```

系统输出：

```json
{
  "raw_goal": "我想学数据分析",
  "clarified_goal": {
    "target_outcome": "完成一个 CSV 数据分析项目",
    "level": "beginner",
    "time_horizon": "6 weeks",
    "available_time": "3 hours/week",
    "preferred_style": "hands-on practice",
    "competency_map": [
      "python_basics",
      "pandas_dataframe",
      "data_cleaning",
      "data_visualization",
      "insight_communication"
    ],
    "milestones": [
      "read_and_inspect_csv",
      "clean_dataset",
      "create_charts",
      "present_3_insights"
    ],
    "evidence_standard": [
      "complete a runnable notebook",
      "explain cleaning decisions",
      "present 3 data-backed insights"
    ],
    "first_action": "Upload or choose a beginner-friendly CSV dataset",
    "success_criteria": [
      "can load and clean a dataset",
      "can create basic charts",
      "can explain 3 insights"
    ]
  }
}
```

这会成为一个重要产品入口：

```text
Tell me what you want to learn.
AI turns it into a learning path.
Then it guides you day by day.
```

该 Agent 的输出至少应包含：

```text
目标结果：最终要完成什么或达到什么水平
时间约束：deadline、每周可用时间、节奏偏好
能力地图：达成目标需要哪些 knowledge / skill / performance dimensions
证据标准：什么行为或产出能证明用户真的学会了
里程碑：中间阶段如何拆分
首个行动：今天立刻应该做什么
```

这使 Goal Clarification Agent 成为从 Exam Prep 扩展到 Personal Learning OS 的关键桥梁：Exam 场景里目标由外部标准定义，Goal 场景里目标需要系统和用户共同定义。

---

# Part X：方案 B 的数据架构

## 41. 核心对象从 exam_id 升级为 goal_id

原本：

```text
exam
exam_dimension
user_exam_state
```

升级为：

```text
learning_goal
learning_goal_blueprint
goal_dimension
user_goal_state
```

Exam 变成 Goal 的一种类型。

---

## 42. 核心表设计

### learning_goal_blueprint

```text
goal_blueprint_id
goal_type
title
description
owner_type        // official, school, teacher, platform, user
source_type       // exam_standard, curriculum, uploaded_material, user_prompt
version
target_outcome
default_time_horizon
metadata
```

### goal_dimension

```text
dimension_id
goal_blueprint_id
dimension_type    // knowledge, skill, behavior, project, rubric, habit
parent_id
name
description
weight
prerequisites
metadata
```

### goal_assessment_model

```text
assessment_id
goal_blueprint_id
evidence_type
measured_dimensions
evidence_strength
scoring_method
rubric
metadata
```

### learning_object

```text
object_id
goal_blueprint_id
object_type       // lesson, flashcard, quiz, project_task, example, drill
target_dimensions
difficulty
estimated_minutes
use_case
content
metadata
```

### learning_event

```text
event_id
user_id
goal_id
event_type
source
target_dimensions
result
evidence_strength
created_at
```

### user_goal_state

```text
user_id
goal_id
goal_blueprint_id
target_outcome
deadline
progress
readiness
risk_level
current_milestone
updated_at
```

### user_goal_dimension_state

```text
user_id
goal_id
dimension_id
mastery
confidence
last_practiced_at
forgetting_risk
evidence_count
metadata
```

### recommendation

```text
recommendation_id
user_id
goal_id
target_dimensions
action_type
reason_codes
priority_score
expected_progress_gain
status
created_at
```

### learning_intervention

```text
intervention_id
user_id
goal_id
recommendation_id
intervention_type
target_dimensions
content_ids
question_ids
reason_codes
created_at
```

### intervention_outcome

```text
intervention_outcome_id
intervention_id
completion_status
before_state_snapshot
after_state_snapshot
post_assessment_result
measured_after_days
outcome_label
metadata
```

### content_effectiveness

```text
content_id
goal_blueprint_id
target_dimensions
user_segment
completion_rate
average_mastery_gain
retention_gain_7d
confidence_interval
updated_at
```

### recommendation_feedback

```text
feedback_id
recommendation_id
user_id
goal_id
accepted
completed
skipped_reason
observed_outcome
created_at
```

### question_calibration_stats

```text
question_id
goal_blueprint_id
attempt_count
observed_difficulty
observed_discrimination
rubric_reliability
top_mistake_tags
quality_status
updated_at
```

---

# Part XI：AI Orchestration Layer

## 43. 大模型在系统里的角色

LLM 适合做：

```text
题目理解
内容标签
错因归类
解释生成
练习题生成
作文评分
学习计划表达
对话辅导
多模态理解
目标澄清
项目任务拆解
```

但 LLM 不应独自负责：

```text
长期状态存储
考试结构真相
评分标准真相
推荐优先级
用户进度计算
最终 learning state 更新
```

正确模式：

```text
LLM proposes
System validates
State engine updates
Decision engine recommends
LLM explains
```

从 mini world model 的角度看，LLM 主要承担 perception、generation 和局部 reasoning；Goal / Evidence / State / Intervention / Outcome 这些结构化系统负责维护长期 belief state、选择 action、观察 outcome，并持续修正 policy。

---

## 44. AI 调用流程示例

```text
用户上传作业照片
↓
Multimodal LLM 解析课堂内容、题目、学生答案
↓
Tagging Service 使用 Exam / Goal Model 约束标签
↓
Scoring Service 评价答案
↓
Evidence Service 生成 learning evidence
↓
State Engine 更新用户状态
↓
Decision Engine 生成 next best action
↓
Intervention / Outcome System 记录行动与结果
↓
LLM 生成用户可读反馈和讲解
```

---

## 45. 所有 AI 输出必须结构化

不要只让 AI 返回自然语言。标签、评分、错因和建议都应结构化。

```json
{
  "goal_relevance": 0.92,
  "content_tags": [
    {
      "id": "period_3",
      "confidence": 0.88
    }
  ],
  "skill_tags": [
    {
      "id": "causation",
      "confidence": 0.81
    }
  ],
  "question_type": {
    "id": "saq",
    "confidence": 0.77
  },
  "difficulty": 0.64,
  "mistake_type": "weak_causal_explanation"
}
```

自然语言用于展示，结构化结果用于状态更新和推荐。

---

# Part XII：工程实施路线图

## 46. Phase 1：Exam Evidence Loop MVP

目标：验证一个可复利的考试备考学习闭环，而不是一开始搭完整 Exam Prep 系统。

建议选择一个样板考试，例如 APUSH 或 SAT Math。

早期应聚焦一个高频场景：

```text
上传作业 / 错题 / 短答
  ↓
结构化诊断
  ↓
生成微型补救练习
  ↓
用户修改 / 重做
  ↓
记录是否真的进步
```

需要完成：

```text
1. 选择一个考试和一个高频题型 / 作业场景
2. 建 30–100 个核心 dimensions
3. 建最小可用 question / task / rubric / remediation content
4. 每道题和每个任务绑定 dimensions、difficulty、mistake_tags
5. 用户行为转成 learning events 和 learning evidence
6. 用规则更新 mastery / confidence / mistake patterns
7. 生成 micro-remediation recommendation
8. 记录 intervention_outcome 和 recommendation_feedback
```

成功标准：

```text
系统知道用户今天学了什么
系统知道用户哪道题错了
系统知道错因是什么
系统知道该更新哪个能力
系统知道下一步最该练什么
系统知道这次推荐之后用户有没有进步
```

---

## 47. Phase 2：Content Quality & Calibration Loop

目标：让内容、题目和补救练习从静态资源变成可校准资产。

需要完成：

```text
1. 建内容供给流程：专家建设 / AI 辅助生成 / 授权题库
2. 建人工审核流程：official alignment、rubric、答案解释、错因标签
3. 建 question_calibration_stats
4. 校准 observed difficulty 和 discrimination
5. 追踪 remediation effectiveness
6. 对低质量题目和内容降权、修订或淘汰
7. 将高效果内容放入核心推荐池
```

---

## 48. Phase 3：Outcome-Calibrated Recommendation

目标：从规则推荐升级到基于结果反馈的推荐。

需要完成：

```text
1. 统一 learning_event schema
2. 区分 raw event、tagged evidence、state update、recommendation、intervention_outcome
3. 建 user_dimension_state
4. 建 mistake pattern tracking
5. 建 forgetting risk
6. 建 recommendation_feedback
7. 建 content_effectiveness 和 intervention_outcome 分析
8. 用 outcome 数据调整 recommendation priority
```

---

## 49. Phase 4：Goal Model 泛化

目标：在考试闭环、内容校准和 outcome 推荐稳定后，从考试扩展到课程、学期目标、项目目标、技能目标。

需要完成：

```text
1. 把 exam_id 抽象为 goal_id
2. 把 exam_dimension 抽象为 goal_dimension
3. 把 user_exam_state 抽象为 user_goal_state
4. 把 Exam Evidence Loop 泛化为 Goal Evidence Loop
5. 建 Goal Clarification Agent
6. 支持 Personal Course Model
7. 支持 Project-based Assessment
```

---

## 50. Phase 5：Adaptive Decision Engine 升级

目标：在积累足够 intervention outcome 数据后，从规则推荐升级到数据驱动推荐。

可逐步引入：

```text
Bayesian Knowledge Tracing
IRT
Deep Knowledge Tracing
Spaced Repetition Optimization
Causal Effect Estimation
Reinforcement Learning Recommendation
```

但早期不要绑定某一种复杂算法。接口设计要预留升级空间。

---

## 51. Phase 6：多产品复用

基于同一底层架构，可以支持多个产品：

```text
AI Exam Tutor
Personalized Exam Prep App
AI Flashcards
AI Essay / FRQ Grader
Mock Exam Simulator
School Semester Learning Coach
Project-based Learning Assistant
Lifelong Learning Coach
```

这些产品共享：

```text
Goal Model
Learning Evidence
Learner State
Recommendation Engine
Learning Intervention
Outcome Measurement
AI Orchestration
```

---

# Part XIII：关键设计原则

## 52. 原则 1：模型无关

底层架构不能依赖某个具体 LLM。

```text
GPT 可以用于解释
Claude 可以用于长文批改
Gemini 可以用于多模态理解
小模型可以用于标签分类
自研模型可以用于状态预测
```

但 Exam / Goal Model、Learning Evidence、Learner State 和 Recommendation Engine 应保持模型无关。

---

## 53. 原则 2：状态更新不能由 LLM 直接决定

LLM 可以生成候选判断，但最终状态更新应由 State Engine 完成。

```text
LLM 输出：候选标签、候选错因、候选评分
System 校验：是否合法、是否可信、是否与模型一致
State Engine：根据 evidence 更新状态
```

---

## 54. 原则 3：区分事实、判断、推断和决策

```text
Fact：用户答错了这道题
Judgment：这道题属于 Period 3 + causation
Inference：用户 causation 能力较弱
Decision：今天推荐 causation drill
```

这四层必须分开，否则长期状态会被污染。

---

## 55. 原则 4：目标、证据、状态、推荐必须可解释

每个推荐都应该能回答：

```text
为什么推荐这个？
它对应哪个目标？
它针对哪个能力缺口？
依据哪些学习证据？
预期产生什么提升？
用户完成后如何判断是否有效？
```

---

## 56. 原则 5：从规则开始，为算法升级留接口

MVP 阶段可使用简单规则：

```text
答对 → mastery 上升
答错 → mastery 下降
连续错误 → weak spot
长时间未复习 → forgetting risk 上升
完成改错 → mastery 上升，mistake risk 下降
```

但接口应支持后续升级到更复杂算法。

---

## 57. 原则 6：内容、题目和用户行为都必须绑定 Goal Dimensions

核心绑定关系：

```text
内容绑定 Goal / Exam Model
题目绑定 Goal / Exam Model
用户行为绑定 Learning Evidence
推荐绑定 Learner State
```

如果这四个绑定做好，系统就能跨产品复用学习智能。

---

# Part XIV：最终建议

## 58. 两个方案的关系

### 方案 A：Exam-specific Architecture

适合先落地、先验证。

优点：

```text
目标清晰
标准明确
题库和评分标准可校准
用户价值容易感知
预测分和提分路径更直观
```

建议作为 MVP 起点。

### 方案 B：Goal-based Learning Architecture

适合长期平台化。

优点：

```text
覆盖所有学习目标
支持多个新产品
支持学校课程和终身学习
能形成长期 Personal Learning OS
```

建议作为长期底层抽象。

---

## 59. 推荐路径

建议不要一开始直接做一个过于抽象的 Goal OS。更稳妥的路径是：

```text
Step 1：用一个标准考试和一个高频场景做 Exam Evidence Loop MVP
Step 2：验证 learning evidence → state update → recommendation → outcome measurement 闭环
Step 3：建立内容质量与题目校准机制
Step 4：用 intervention outcome 数据优化推荐
Step 5：把 exam_id 抽象为 goal_id
Step 6：扩展到学校课程 / 学期目标
Step 7：扩展到个人兴趣 / 技能 / 项目目标
Step 8：沉淀成 Personal Learning OS
```

---

## 60. 最终架构总结

### Exam-specific 版本

```text
Exam Model
  ↓
Question Bank / Learning Content
  ↓
Learning Events
  ↓
Learning Evidence
  ↓
User Exam State
  ↓
Adaptive Recommendation
  ↓
Learning Intervention
  ↓
Outcome Measurement
  ↓
Personalized Exam Prep Experience
```

### Goal-based 通用版本

```text
Learning Goal Model
  ↓
Goal Content / Goal Assessment
  ↓
Learning Events
  ↓
Learning Evidence
  ↓
User Goal State
  ↓
Goal-based Recommendation
  ↓
Learning Intervention
  ↓
Outcome Measurement
  ↓
Personalized Learning Experience
```

---

## 61. 一句话结论

> Exam Model 是 Goal-based Learning Model 的一个子集。真正值得构建的底层技术架构，是一个模型无关、目标可配置、证据驱动、状态持续更新、推荐可验证，并能持续积累学习干预效果数据的 Personal Learning OS。

更本质地说，Personal Learning OS 是一个帮助人类提升自己的 mini world model。它持续建模：

```text
一个人想达到什么目标
他当前处于什么状态
什么行动可能让他变好
行动之后是否真的产生了进步
```

它的核心价值不是让 AI 一次回答得更好，也不是让架构图本身成为壁垒，而是让系统在数周、数月甚至数年的学习过程中，持续理解每个学习者，记录每次学习干预是否真的有效，并把这些结果数据转化为越来越强的诊断、推荐、预测和个性化能力。

模型能力越强，这套系统越有价值：更强的模型会提升理解、生成和评分能力，而结构化的学习轨迹与干预效果数据会告诉模型应该把能力用在谁身上、何时使用、为什么使用，以及如何判断是否真的带来了进步。
