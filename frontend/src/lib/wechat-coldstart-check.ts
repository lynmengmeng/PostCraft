import type { WechatContent } from "./types";
import { scoreWechatTitle } from "./wechat-title-score";

export interface WechatValidationCheck {
  level: "error" | "warn" | "info";
  message: string;
}

const MACRO_OPENING_PATTERNS = [
  /随着.{0,12}越来越/,
  /近年来/,
  /最近很火/,
  /朋友圈里到处/,
  /全文.{0,6}字/,
  /阅读约需/,
];

const PAIN_PATTERNS = [
  /[？?]/,
  /怎么|如何|为什么|会不会|要不要|焦虑|困惑|担心|难题|痛点|误区/,
];

const VAGUE_ENDING_PATTERNS = [/欢迎留言/, /希望对你有帮助/, /感谢阅读/, /欢迎关注/];

const SPECIFIC_QUESTION_PATTERNS = [
  /留言区/,
  /评论区/,
  /你觉得/,
  /你会选/,
  /打[：:]/,
  /A\s*\/\s*B/,
  /会\s*\/\s*不会/,
];

const ACTION_ENDING_PATTERNS = [
  /你可以先/,
  /建议先/,
  /不妨先/,
  /先做这一步/,
  /你可以先做/,
];

function plainText(body: string): string {
  return body.replace(/[#*_`>\[\]()!-]/g, "").replace(/\s+/g, "");
}

function openingText(body: string, maxChars = 120): string {
  const plain = plainText(body);
  return plain.slice(0, maxChars);
}

function endingText(body: string, maxChars = 200): string {
  const plain = plainText(body);
  return plain.slice(-maxChars);
}

export function validateWechatColdstart(
  content: WechatContent,
): WechatValidationCheck[] {
  const checks: WechatValidationCheck[] = [];
  const title = content.title.trim();
  const body = content.body || "";

  if (title) {
    const { score, label } = scoreWechatTitle(title);
    if (label === "待优化" || score < 3) {
      checks.push({
        level: "warn",
        message:
          "标题打开率要素不足，建议套用「数字+结果+悬念」，并加入人群、问句与可执行利益点",
      });
    } else if (label === "情绪向") {
      checks.push({
        level: "warn",
        message: "标题偏纯情绪故事型，建议补上利益点或悬念，或改用搜索问题型",
      });
    } else if (label === "搜索友好") {
      checks.push({
        level: "info",
        message: "标题搜索友好度不错，若再加强悬念或社交币（纠误区/反常识），打开率可能更高",
      });
    }
  }

  if (body.trim()) {
    const opening = openingText(body);
    if (MACRO_OPENING_PATTERNS.some((p) => p.test(opening))) {
      checks.push({
        level: "warn",
        message: "开头有宏观铺垫，建议前 3 段直接说痛点场景",
      });
    } else if (!PAIN_PATTERNS.some((p) => p.test(opening))) {
      checks.push({
        level: "info",
        message: "开头可加一句具体痛点或问句，更容易留住搜一搜进来的读者",
      });
    }

    const ending = endingText(body);
    const hasVagueEnding = VAGUE_ENDING_PATTERNS.some((p) => p.test(ending));
    const hasSpecificQuestion = SPECIFIC_QUESTION_PATTERNS.some((p) => p.test(ending));
    if (hasVagueEnding && !hasSpecificQuestion) {
      checks.push({
        level: "warn",
        message: "结尾互动较泛泛，建议加具体 A/B 式提问（如「留言区打：会 / 不会」）",
      });
    } else if (!hasSpecificQuestion && !/[？?]/.test(ending.slice(-80))) {
      checks.push({
        level: "info",
        message: "可在文末加一条具体互动提问，提升评论与在看",
      });
    }

    if (!ACTION_ENDING_PATTERNS.some((p) => p.test(ending))) {
      checks.push({
        level: "info",
        message: "结尾可给 1 个明确可执行行动（如「你可以先…」）",
      });
    }

    const sectionCount = (body.match(/^##\s+/gm) || []).length;
    if (sectionCount > 6) {
      checks.push({
        level: "info",
        message: `正文有 ${sectionCount} 个小节，冷启动建议单篇只讲 1 个核心问题`,
      });
    }
  }

  return checks;
}
