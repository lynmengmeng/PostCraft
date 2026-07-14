export type WechatTitleLabel = "高打开潜力" | "搜索友好" | "情绪向" | "待优化";

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

const SOCIAL_CURRENCY_PATTERNS = [
  /别再|别只|误区|很多人不知道|你以为|其实|最容易踩|值得转|给家人|给家长/,
  /反常识|原来不是|不是.*而是/,
];

const SUSPENSE_PATTERNS = [
  /[？?]/,
  /却|原来|竟然|居然|没想到|先查|先看|先问|藏在|背后/,
  /\d+\s*[个件事项种]/,
];

const EMOTION_ONLY_PATTERNS = [
  /^她?说[，,]/,
  /^那个/,
  /^后来她们/,
  /^原来/,
];

const VAGUE_PATTERNS = [/全面/, /指南/, /必看/, /震惊/, /攻略/, /入门/, /提高/];

const SENSATIONAL_PATTERNS = [
  /震惊|惊呆|必看|不看后悔|疯传|刷屏|绝了|太牛了|炸裂|爆火|火了/,
];

function hasAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

export function scoreWechatTitle(text: string): WechatTitleScore {
  const trimmed = text.trim();
  const reasons: string[] = [];
  let score = 0;

  if (!trimmed) {
    return { score: 0, label: "待优化", reasons: ["标题为空"] };
  }

  if (trimmed.length > 64) {
    score -= 2;
    reasons.push("超过 64 字，信息流易被截断");
  }

  const hasSearch = hasAny(SEARCH_PATTERNS, trimmed);
  const hasAudience = hasAny(AUDIENCE_PATTERNS, trimmed);
  const hasResult = hasAny(RESULT_PATTERNS, trimmed);
  const hasSocialCurrency = hasAny(SOCIAL_CURRENCY_PATTERNS, trimmed);
  const hasSuspense = hasAny(SUSPENSE_PATTERNS, trimmed);
  const hasBenefit = hasResult || (hasSearch && hasAudience);
  const hasVague = hasAny(VAGUE_PATTERNS, trimmed);
  const hasSensational = hasAny(SENSATIONAL_PATTERNS, trimmed);
  const emotionOnly =
    hasAny(EMOTION_ONLY_PATTERNS, trimmed) && !hasSearch && !hasBenefit;

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
  if (hasSocialCurrency) {
    score += 2;
    reasons.push("含社交币（纠误区/反常识）");
  }
  if (hasSuspense) {
    score += 2;
    reasons.push("含悬念");
  }
  if (hasBenefit && !hasResult) {
    score += 1;
    reasons.push("含利益点");
  }
  if (hasVague) {
    score -= 2;
    reasons.push("含空泛营销词");
  }
  if (hasSensational) {
    score -= 4;
    reasons.push("含哗众取宠词，建议改写");
  }
  if (emotionOnly) {
    score -= 2;
    reasons.push("偏纯情绪，缺少利益点");
  }

  const elementCount = [hasSocialCurrency, hasSuspense, hasBenefit].filter(Boolean).length;

  let label: WechatTitleLabel;
  if (hasSensational || score <= 0) {
    label = "待优化";
  } else if (elementCount >= 2 && hasBenefit && hasSuspense && score >= 6) {
    label = "高打开潜力";
  } else if (score >= 5 || (hasSearch && score >= 3)) {
    label = "搜索友好";
  } else if (emotionOnly || (score <= 1 && !hasSearch)) {
    label = emotionOnly ? "情绪向" : "待优化";
  } else if (score >= 3) {
    label = "搜索友好";
  } else {
    label = "待优化";
  }

  if (label === "高打开潜力" && elementCount < 3) {
    reasons.push(`已覆盖 ${elementCount}/3 个高打开要素，可再补社交币或悬念`);
  }

  return { score, label, reasons };
}

export function sortTitlesByScore<T extends { text: string }>(titles: T[]): T[] {
  return [...titles].sort(
    (a, b) => scoreWechatTitle(b.text).score - scoreWechatTitle(a.text).score,
  );
}
