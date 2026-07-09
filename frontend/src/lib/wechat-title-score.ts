export type WechatTitleLabel = "搜索友好" | "情绪向" | "待优化";

export interface WechatTitleScore {
  score: number;
  label: WechatTitleLabel;
  reasons: string[];
}

const SEARCH_PATTERNS = [
  /怎么|如何|为什么|会不会|值得吗|要不要|能不能|该不该|是不是|有没有/,
  /判断|方法|建议|安排|准备|识别|选择|规划|逆袭|避坑/,
];

const AUDIENCE_PATTERNS = [
  /学生|家长|普通人|高中生|初中生|大学生|孩子|家庭|新手|职场|程序员/,
];

const RESULT_PATTERNS = [
  /\d+\s*[个件事项种能力趋势判断]/,
  /这\s*\d+/,
  /[一二三四五六七八九十]+[个件事项种]/,
  /判断|方法|建议|步骤|清单|计划|能力|趋势/,
];

const EMOTION_ONLY_PATTERNS = [
  /^她?说[，,]/,
  /^那个/,
  /^后来她们/,
  /^原来/,
];

const VAGUE_PATTERNS = [/全面/, /指南/, /必看/, /震惊/, /攻略/, /入门/];

export function scoreWechatTitle(text: string): WechatTitleScore {
  const trimmed = text.trim();
  const reasons: string[] = [];
  let score = 0;

  if (!trimmed) {
    return { score: 0, label: "待优化", reasons: ["标题为空"] };
  }

  if (trimmed.length > 64) {
    score -= 2;
    reasons.push("超过 64 字");
  }

  const hasSearch = SEARCH_PATTERNS.some((p) => p.test(trimmed));
  const hasAudience = AUDIENCE_PATTERNS.some((p) => p.test(trimmed));
  const hasResult = RESULT_PATTERNS.some((p) => p.test(trimmed));
  const hasVague = VAGUE_PATTERNS.some((p) => p.test(trimmed));
  const emotionOnly = EMOTION_ONLY_PATTERNS.some((p) => p.test(trimmed)) && !hasSearch;

  if (hasSearch) {
    score += 3;
    reasons.push("含搜索/问句词");
  }
  if (hasAudience) {
    score += 2;
    reasons.push("含目标人群");
  }
  if (hasResult) {
    score += 2;
    reasons.push("含明确结果");
  }
  if (hasVague) {
    score -= 2;
    reasons.push("含空泛营销词");
  }
  if (emotionOnly) {
    score -= 2;
    reasons.push("偏纯情绪，搜索词弱");
  }
  if (/[？?]/.test(trimmed)) {
    score += 1;
  }

  let label: WechatTitleLabel;
  if (score >= 5) {
    label = "搜索友好";
  } else if (emotionOnly || (score <= 1 && !hasSearch)) {
    label = emotionOnly ? "情绪向" : "待优化";
  } else if (score >= 3) {
    label = "搜索友好";
  } else {
    label = "待优化";
  }

  return { score, label, reasons };
}

export function sortTitlesByScore<T extends { text: string }>(titles: T[]): T[] {
  return [...titles].sort(
    (a, b) => scoreWechatTitle(b.text).score - scoreWechatTitle(a.text).score,
  );
}
