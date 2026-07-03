import type { ContentProject, Platform, ProjectDraftExport, WechatContent } from "./types";
import { hasRealImage } from "./wechat-assets";
import { getPlatformCopyText } from "@/components/preview/PlatformPreview";
import { renderWechatCopyHtml } from "./wechat-html";

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

export function downloadDraftBundle(data: ProjectDraftExport, title: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeTitle = (title || "postcraft").slice(0, 20).replace(/[^\w\u4e00-\u9fff-]+/g, "-");
  anchor.download = `postcraft-draft-${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportWechatHtml(project: ContentProject): void {
  const wechat = project.platforms.wechat;
  const html = renderWechatCopyHtml(wechat, project.cover_assets, resolveImageUrl);
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${wechat.title || project.title}</title></head><body>${html}</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(wechat.title || project.title).slice(0, 20) || "wechat"}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface WechatValidationCheck {
  level: "error" | "warn" | "info";
  message: string;
}

export function validateWechatContent(
  content: WechatContent,
  coverAssets: ContentProject["cover_assets"],
): WechatValidationCheck[] {
  const checks: WechatValidationCheck[] = [];
  if (!content.title.trim()) {
    checks.push({ level: "warn", message: "标题为空，发布前请填写" });
  } else if (content.title.length > 64) {
    checks.push({ level: "warn", message: `标题 ${content.title.length} 字，建议不超过 64 字` });
  }
  if (content.summary.length > 120) {
    checks.push({ level: "warn", message: `摘要 ${content.summary.length} 字，建议不超过 120 字` });
  }
  const bodyLen = content.body.replace(/\s/g, "").length;
  if (bodyLen < 300) {
    checks.push({ level: "info", message: "正文较短，确认是否已写完整" });
  }
  const placements = content.image_placements || [];
  const pendingImages = coverAssets.filter((a) => !hasRealImage(a)).length;
  if (placements.length > 0 && pendingImages > 0) {
    checks.push({
      level: "warn",
      message: `${pendingImages} 张配图尚未上传或生成，复制后需在公众号后台手动上传`,
    });
  }
  if (coverAssets.length > 0) {
    const coverAsset = coverAssets[0];
    if (coverAsset && hasRealImage(coverAsset)) {
      checks.push({
        level: "info",
        message:
          "公众号封面请使用「下载公众号封面」导出 900×383（2.35:1）后再上传；拖动选框确保 1:1 预览也包含主体",
      });
    } else {
      checks.push({
        level: "info",
        message: "封面图需在公众号左侧单独上传；正文配图若粘贴后不显示，请从配图清单下载后手动插入",
      });
    }
  }
  return checks;
}

export function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/api";
  const origin = apiBase.replace(/\/api\/?$/, "");
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function downloadImage(url: string, filename: string): Promise<void> {
  const resolved = resolveImageUrl(url);
  const response = await fetch(resolved);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
