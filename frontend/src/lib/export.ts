import type { ContentProject, Platform } from "./types";
import { getPlatformCopyText } from "@/components/preview/PlatformPreview";

export function exportAllPlatforms(project: ContentProject): void {
  const sections = (["wechat", "xiaohongshu", "douyin"] as Platform[]).map(
    (platform) => `=== ${platform} ===\n${getPlatformCopyText(project, platform)}`,
  );
  const content = [
    `# ${project.title}`,
    "",
    `灵感: ${project.inspiration}`,
    "",
    ...sections,
    "",
    "## 标题备选",
    ...project.titles.map((t) => `- [${t.style}] ${t.text}`),
  ].join("\n");

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.title.slice(0, 20) || "postcraft"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/api";
  const origin = apiBase.replace(/\/api\/?$/, "");
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}
