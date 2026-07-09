import type { EditorTab } from "@/components/studio/ContentEditor";
import type { ContentProject, Platform } from "@/lib/types";

export const ALL_PLATFORMS: Platform[] = ["wechat", "xiaohongshu", "douyin"];

export const platformIcons: Record<Platform, string> = {
  wechat: "chat_bubble",
  xiaohongshu: "photo_library",
  douyin: "movie_filter",
};

export const quickCommands = [
  "更温和一点",
  "去掉说教感",
  "加个人经历，少堆数据",
  "给我 10 个搜一搜友好标题",
  "优化开头，前 3 段直接说痛点",
  "加一条具体互动提问",
  "给我 10 个标题",
  "检查敏感表述",
  "调整配图位置",
  "一键生成全部轮播图",
  "撤销上一版",
];

export function hasDraft(project: ContentProject) {
  return !!(project.humanized || project.draft);
}

export function hasPlatformContent(project: ContentProject, item: Platform) {
  if (item === "wechat") return !!project.platforms.wechat.body;
  if (item === "xiaohongshu") return !!project.platforms.xiaohongshu.body;
  return project.platforms.douyin.script.length > 0;
}

export function hasAnyPlatformContent(project: ContentProject) {
  return ALL_PLATFORMS.some((p) => hasPlatformContent(project, p));
}

/** 对话/免责声明等 API 上下文：初稿 Tab 时取首个有内容的平台，否则取当前 Tab */
export function getChatContextPlatform(editorTab: EditorTab, project: ContentProject): Platform {
  if (editorTab !== "draft") return editorTab;
  for (const p of ALL_PLATFORMS) {
    if (hasPlatformContent(project, p)) return p;
  }
  return "wechat";
}

export function getActivePlatform(editorTab: EditorTab): Platform | null {
  return editorTab === "draft" ? null : editorTab;
}

export type StudioViewMode = "split" | "preview" | "edit";
export type MobileStudioPanel = "chat" | "edit" | "preview";
