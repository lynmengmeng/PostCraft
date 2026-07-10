import type { EditorTab } from "@/components/studio/ContentEditor";
import type { ContentProject, Platform } from "@/lib/types";
import { platformLabels } from "@/lib/api";

export type ChatScope = "draft" | Platform | "all";

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

export function resolveEditTarget(chatScope: ChatScope): "draft" | "platform" {
  return chatScope === "draft" ? "draft" : "platform";
}

export function getDefaultChatScope(editorTab: EditorTab): ChatScope {
  return editorTab === "draft" ? "draft" : editorTab;
}

export function getChatScopeHint(chatScope: ChatScope, hasDraft: boolean): string {
  if (chatScope === "draft") {
    return hasDraft
      ? "修改观察型初稿（humanized），不会直接改动各平台预览"
      : "记录写作要求与素材；生成初稿前不会改写内容";
  }
  if (chatScope === "all") {
    return "根据指令更新初稿，并同步到已有平台版本";
  }
  return `只修改${platformLabels[chatScope]}平台内容，初稿与其他平台不变`;
}

export function getChatScopePlaceholder(chatScope: ChatScope, hasDraft: boolean): string {
  if (chatScope === "draft") {
    return hasDraft
      ? "继续打磨初稿，例如：更温和一点、加个人经历…"
      : "补充角度、素材或语气，例如：从回农村经历切入、语气温和…";
  }
  if (chatScope === "all") {
    return "说明要同步到三平台的修改，例如：开头更犀利、整体精简…";
  }
  return `说明要修改的${platformLabels[chatScope]}内容，例如：标题更吸引人、第二段缩短…`;
}

export function appendStreamingDelta(prev: string, delta: string): string {
  return prev ? `${prev}\n${delta}` : delta;
}

export function hasLaterChatMessages(
  chatHistory: ContentProject["chat_history"],
  assistantMessageId: string,
): boolean {
  const idx = chatHistory.findIndex((item) => item.id === assistantMessageId);
  return idx >= 0 && idx < chatHistory.length - 1;
}

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
