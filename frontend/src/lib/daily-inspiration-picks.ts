/**
 * 今日灵感推荐：按发布节奏（周一搜一搜 / 周三方法 / 周五共鸣）轮换，
 * 文案含搜索型标题方向、痛点开头、文末互动提问。
 */

export type InspirationRhythm = "周一" | "周三" | "周五" | "通用";

export interface DailyInspirationPick {
  id: string;
  pillar: string;
  rhythm: InspirationRhythm;
  suggestedTitle: string;
  content: string;
  openingHint: string;
  engagementQuestion: string;
  tags: string[];
  searchKeywords: string[];
}

export const DAILY_INSPIRATION_POOL: DailyInspirationPick[] = [
  {
    id: "ai-major-choice",
    pillar: "AI时代学生规划",
    rhythm: "周一",
    suggestedTitle: "AI会让程序员失业吗？给学生选专业前的3个判断",
    content:
      "很多家长问：孩子还要不要学计算机？AI 都能写代码了，程序员是不是没前途了？\n\n" +
      "核心观察：低水平重复编码会被替代，但懂业务、能解决问题的人反而更值钱。学生现在要准备的不是「逃离编程」，而是补上判断业务、沟通需求、持续学习这 3 种能力。\n\n" +
      "单篇只回答：普通高中生选专业前，怎么用 3 个简单问题判断「计算机还值不值得学」。",
    openingHint: "最近很多家长问：孩子还要不要学计算机？",
    engagementQuestion: "你觉得 AI 会影响孩子选专业吗？留言区打：会 / 不会",
    tags: ["AI时代学生规划", "搜一搜", "家长"],
    searchKeywords: ["程序员失业", "选专业", "计算机专业"],
  },
  {
    id: "start-doing",
    pillar: "学霸方法与逆袭",
    rhythm: "周三",
    suggestedTitle: "普通学生怎么逆袭？真正拉开差距的是「先做起来」",
    content:
      "那个学姐反复说「先做起来」，后来成绩和人脉都变了。很多人以为逆袭靠天赋或补课，其实最先拉开差距的是：敢在没准备好时迈出第一步。\n\n" +
      "可写角度：普通学生不是缺方法，而是总在等「完美计划」。先做起来 = 先完成最小动作（每天 20 分钟阅读 / 一道错题复盘 / 一次主动提问）。\n\n" +
      "单篇只讲：为什么「先做起来」比「等准备好了」更有效，给 3 个普通学生明天就能试的动作。",
    openingHint: "很多普通学生不是不努力，而是一直在等一个「准备好了再开始」的信号。",
    engagementQuestion: "你觉得自己最难「先做起来」的是哪件事？留言区打：学习 / 运动 / 社交",
    tags: ["学霸方法", "逆袭", "学生"],
    searchKeywords: ["普通学生逆袭", "先做起来", "学习方法"],
  },
  {
    id: "summer-three-blocks",
    pillar: "学霸方法与暑假规划",
    rhythm: "周三",
    suggestedTitle: "清华学霸的暑假怎么安排？每天抓住这3块时间最关键",
    content:
      "清华学霸的暑假不是全天补课，而是把一天切成 3 块：上午专注学习、下午运动或社交、晚上阅读或复盘。普通学生不需要复制名校强度，但可以复制「块状时间」结构。\n\n" +
      "单篇只回答：暑假每天怎么划分 3 块时间，让学习、休息、成长都不互相挤掉。给出可参考的时间段模板（不必精确到分钟）。",
    openingHint: "暑假一到，家长最容易犯的错是：只盯作业，不管节奏。",
    engagementQuestion: "你家孩子暑假最难坚持的是哪一块？留言区打：学习 / 运动 / 阅读",
    tags: ["暑假规划", "学霸方法", "家长"],
    searchKeywords: ["暑假怎么安排", "清华学霸暑假", "暑假计划表"],
  },
  {
    id: "ai-four-skills",
    pillar: "AI时代学生规划",
    rhythm: "周一",
    suggestedTitle: "AI时代，孩子最该培养的不是刷题，而是这4种能力",
    content:
      "刷题能提分，但 AI 时代真正拉开差距的是：提问能力、批判性思维、跨学科整合、与 AI 协作的能力。很多家长还在用「多刷题 = 有出路」的旧地图。\n\n" +
      "单篇只讲清 4 种能力分别是什么、普通家庭怎么在日常里练（不必报贵班）。",
    openingHint: "AI 能解题，但孩子未来更值钱的，可能不是「会做题」。",
    engagementQuestion: "你最想培养孩子哪一项？留言区打：提问 / 思辨 / 整合 / 协作",
    tags: ["AI时代学生规划", "能力培养", "家长"],
    searchKeywords: ["AI时代孩子能力", "刷题", "未来教育"],
  },
  {
    id: "summer-five-things",
    pillar: "学霸方法与暑假规划",
    rhythm: "周三",
    suggestedTitle: "暑假别只补课，普通学生最该完成这5件事",
    content:
      "暑假如果只补课，孩子可能分数略涨，但开学后容易反弹。普通学生暑假更值得完成的 5 件事：固定作息、每天阅读、一项运动、一次社会实践或家务承担、开学前一周复盘。\n\n" +
      "单篇用清单体，每件写「为什么 + 怎么做 15 分钟版」。",
    openingHint: "暑假补课排满，孩子反而更累——因为缺的不是课时，是节奏。",
    engagementQuestion: "你家暑假已经安排了哪几项？留言区打：阅读 / 运动 / 补课 / 都没开始",
    tags: ["暑假规划", "普通学生", "家长"],
    searchKeywords: ["暑假做什么", "暑假别只补课", "暑假安排"],
  },
  {
    id: "self-discipline",
    pillar: "家长焦虑与学生成长",
    rhythm: "周五",
    suggestedTitle: "孩子不自律怎么办？家长越催，孩子越容易放弃",
    content:
      "孩子拖延、玩手机、不写作业——家长第一反应是催。但越催，孩子越容易把学习当成「和父母的战争」。不自律背后常常是：任务太大、没有正反馈、或家长焦虑传染。\n\n" +
      "单篇只回答：家长怎么从「催」改成「拆任务 + 给选择 + 约定复盘」，给 3 个可执行话术。",
    openingHint: "孩子不是懒，很多时候是不知道从哪里开始，而家长的催促又让他更想逃。",
    engagementQuestion: "你家用过最有效的一招是什么？留言区聊聊：约定时间 / 拆小任务 / 其他",
    tags: ["家长焦虑", "自律", "学生成长"],
    searchKeywords: ["孩子不自律", "家长越催", "孩子拖延"],
  },
  {
    id: "english-ai-era",
    pillar: "AI时代学生规划",
    rhythm: "周一",
    suggestedTitle: "孩子现在学英语还有用吗？AI翻译时代的真实答案",
    content:
      "AI 翻译越来越准，很多家长问：孩子还要苦学英语吗？有用，但理由变了——不是为了当翻译，而是为了读一手资料、表达复杂想法、以及在未来工作中判断 AI 输出是否靠谱。\n\n" +
      "单篇只讲：AI 时代学英语的 3 个现实理由 + 1 个不必焦虑的误区。",
    openingHint: "「AI 都能翻译了，还学英语干嘛？」——这个问题背后，其实是家长对路径的焦虑。",
    engagementQuestion: "你觉得孩子还要不要学英语？留言区打：要 / 不必死磕 / 看情况",
    tags: ["AI时代学生规划", "学英语", "家长"],
    searchKeywords: ["学英语还有用吗", "AI翻译", "英语教育"],
  },
  {
    id: "major-ai-proof",
    pillar: "AI时代学生规划",
    rhythm: "周一",
    suggestedTitle: "未来5年，哪些专业更不容易被AI替代？给高中生家长的参考",
    content:
      "选专业不能追热点，但可以问：这个方向培养的是「可替代的技能」还是「难替代的判断力」？结合 AI 趋势，可讨论：强依赖重复操作的专业风险更高，强依赖人际、复杂决策、身体现场的领域相对稳。\n\n" +
      "单篇给 3–4 个判断维度，不做人身攻击式「某专业必死」结论。",
    openingHint: "选专业时最危险的，不是选错一次，而是用上一代的经验硬套 AI 时代。",
    engagementQuestion: "你最担心哪个专业方向？留言区说说，我可以按留言写下一篇",
    tags: ["选专业", "AI时代", "家长"],
    searchKeywords: ["专业选择", "AI替代", "高中生选专业"],
  },
  {
    id: "daily-study-time",
    pillar: "学霸方法与暑假规划",
    rhythm: "周三",
    suggestedTitle: "孩子暑假每天学多久才合适？家长别再只盯作业量",
    content:
      "暑假学习不是越长越好。小学生连续专注 25–40 分钟、初中生 45–60 分钟、高中生可分段 90 分钟，中间必须休息。家长只盯「学了几个小时」容易变成表演式学习。\n\n" +
      "单篇给分学段参考时长 + 怎么判断「今天学够了」。",
    openingHint: "暑假里最常见的一句吵架是：「你今天才学了几小时？」——但小时数不等于效果。",
    engagementQuestion: "你家暑假每天学习大概多久？留言区打：1小时内 / 2小时 / 3小时以上",
    tags: ["暑假规划", "学习时间", "家长"],
    searchKeywords: ["暑假每天学多久", "学习时间", "作业量"],
  },
  {
    id: "parent-three-mistakes",
    pillar: "家长焦虑与学生成长",
    rhythm: "周五",
    suggestedTitle: "家长最容易踩的3个教育误区：越用力，孩子越抗拒",
    content:
      "误区一：把分数当唯一 KPI；误区二：用恐吓驱动（考不好就怎样）；误区三：替孩子做所有决定。每个误区背后都有家长的焦虑，但孩子接收到的是压力而非支持。\n\n" +
      "单篇每个误区配一个「可以改成什么」的具体说法。",
    openingHint: "很多教育问题，不是孩子不听话，而是家长用力用错了方向。",
    engagementQuestion: "你觉得自己最容易踩哪一条？留言区打：1 / 2 / 3",
    tags: ["家长焦虑", "教育误区", "学生成长"],
    searchKeywords: ["教育误区", "家长焦虑", "孩子抗拒"],
  },
  {
    id: "long-term-plan",
    pillar: "家长焦虑与学生成长",
    rhythm: "周五",
    suggestedTitle: "普通家庭怎么帮孩子做长期规划？不用砸钱也能做的3件事",
    content:
      "长期规划不是从小规划好一条路，而是：帮孩子建立「我会持续变好」的信念、保留 1–2 个可坚持的爱好、每年一次「我们想成为什么样的人」的家庭对话。\n\n" +
      "单篇强调普通家庭可执行，避免精英叙事。",
    openingHint: "长期规划听起来很贵，其实最需要的是连续的小选择，而不是一次大的投入。",
    engagementQuestion: "你家有固定做的「成长小事」吗？留言区聊聊",
    tags: ["长期规划", "普通家庭", "家长"],
    searchKeywords: ["长期规划", "普通家庭", "孩子教育"],
  },
  {
    id: "why-push-backfires",
    pillar: "家长焦虑与学生成长",
    rhythm: "周五",
    suggestedTitle: "为什么越催孩子，孩子越不想学？可能不是懒",
    content:
      "催促会激活孩子的防御：学习变成证明「我没让你失望」的负担。更常见的原因是任务模糊、失败体验多、或家庭气氛紧张。单篇从「催」背后的 3 种机制讲起，给家长可替换的 2 句开场白。",
    openingHint: "你越催，孩子越慢——很多时候不是叛逆，而是大脑在逃避压力。",
    engagementQuestion: "你被催的时候最想做什么？留言区打：反抗 / 逃避 / 假装在做",
    tags: ["家长焦虑", "学习动力", "学生成长"],
    searchKeywords: ["越催越不学", "孩子不想学", "学习动力"],
  },
];

const RHYTHM_BY_WEEKDAY: Record<number, InspirationRhythm> = {
  1: "周一",
  3: "周三",
  5: "周五",
};

export function getTodayRhythm(date = new Date()): InspirationRhythm {
  return RHYTHM_BY_WEEKDAY[date.getDay()] ?? "通用";
}

export function getDailyInspirationPicks(date = new Date(), limit = 3): DailyInspirationPick[] {
  const rhythm = getTodayRhythm(date);
  const daySeed = date.getFullYear() * 1000 + date.getMonth() * 50 + date.getDate();

  const primary = DAILY_INSPIRATION_POOL.filter((p) => p.rhythm === rhythm);
  const fallback = DAILY_INSPIRATION_POOL.filter((p) => p.rhythm === "通用");
  const pool = primary.length > 0 ? primary : DAILY_INSPIRATION_POOL;

  const sorted = [...pool].sort((a, b) => {
    const hashA = (daySeed + a.id.charCodeAt(0) * 7) % pool.length;
    const hashB = (daySeed + b.id.charCodeAt(0) * 7) % pool.length;
    return hashA - hashB;
  });

  const seen = new Set<string>();
  const picks: DailyInspirationPick[] = [];
  for (const item of sorted) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picks.push(item);
    if (picks.length >= limit) break;
  }

  if (picks.length < limit && rhythm !== "通用") {
    for (const item of fallback) {
      if (picks.length >= limit) break;
      if (!seen.has(item.id)) picks.push(item);
    }
  }

  return picks;
}

export function formatPickForInspiration(pick: DailyInspirationPick): string {
  return [
    `【推荐标题】${pick.suggestedTitle}`,
    "",
    pick.content,
    "",
    `【开头方向】${pick.openingHint}`,
    `【文末互动】${pick.engagementQuestion}`,
    `【搜一搜词】${pick.searchKeywords.join("、")}`,
  ].join("\n");
}
