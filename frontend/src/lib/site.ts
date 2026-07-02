export const siteConfig = {
  name: "PostCraft · 生活有稿",
  shortName: "生活有稿",
  tagline: "从灵感到发布的个人内容创作工作台",
  description:
    "PostCraft（生活有稿）是个人观察型 AI 内容创作工作台：把生活灵感整理成公众号长文、小红书笔记、抖音口播脚本，通过对话式协作不断打磨至可发布状态。",
  keywords: [
    "AI 内容创作",
    "个人创作者工具",
    "公众号写作",
    "小红书文案",
    "抖音脚本",
    "生活观察写作",
    "多平台内容",
    "灵感管理",
    "内容工作台",
    "PostCraft",
    "生活有稿",
  ],
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://postcraft.app",
  locale: "zh_CN",
  creator: "PostCraft",
} as const;

export function absoluteUrl(path = "/") {
  const base = siteConfig.url.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
