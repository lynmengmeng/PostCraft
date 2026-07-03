"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorTab } from "@/components/studio/ContentEditor";
import { Icon } from "@/components/ui/Icon";
import {
  hasAnyPlatformContent,
  hasDraft,
  hasPlatformContent,
  type StudioViewMode,
} from "@/lib/studio-utils";
import type { ContentProject } from "@/lib/types";

interface StudioHeaderActionsProps {
  viewMode: StudioViewMode;
  onViewModeChange: (mode: StudioViewMode) => void;
  editorTab: EditorTab;
  project: ContentProject;
  copied: boolean;
  copiedTitleKey: string | null;
  copyMode: "rich" | "markdown";
  onCopyModeChange: (mode: "rich" | "markdown") => void;
  exportingDraft: boolean;
  onCopyPlatform: () => void;
  onCopyWechatTitle: () => void;
  onExportWechatHtml: () => void;
  onExportDraftBundle: () => void;
  onExportAll: () => void;
  onMarkReady: () => void;
}

export function StudioHeaderActions({
  viewMode,
  onViewModeChange,
  editorTab,
  project,
  copied,
  copiedTitleKey,
  copyMode,
  onCopyModeChange,
  exportingDraft,
  onCopyPlatform,
  onCopyWechatTitle,
  onExportWechatHtml,
  onExportDraftBundle,
  onExportAll,
  onMarkReady,
}: StudioHeaderActionsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const isPlatformTab = editorTab !== "draft";
  const showWechatExtras = isPlatformTab && editorTab === "wechat";
  const showCopy = hasDraft(project) || hasAnyPlatformContent(project);
  const showDraftExport = project.inspiration || hasDraft(project);
  const isReady = project.status === "ready";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="hidden rounded-lg border border-outline-variant/30 p-0.5 md:flex">
        {(
          [
            ["split", "三栏"],
            ["edit", "编辑"],
            ["preview", "预览"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              viewMode === mode
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showWechatExtras && (
        <>
          <button
            type="button"
            onClick={onCopyWechatTitle}
            disabled={!project.platforms.wechat.title.trim()}
            className="hidden items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40 sm:flex"
          >
            <Icon name="title" className="text-[16px]" />
            {copiedTitleKey === "current-title" ? "标题已复制" : "复制标题"}
          </button>
          <select
            value={copyMode}
            onChange={(e) => onCopyModeChange(e.target.value as "rich" | "markdown")}
            className="hidden rounded-lg border border-outline-variant px-2 py-1.5 text-xs text-on-surface-variant sm:block"
          >
            <option value="rich">富文本</option>
            <option value="markdown">Markdown</option>
          </select>
        </>
      )}

      {showCopy && (
        <button
          type="button"
          onClick={onCopyPlatform}
          className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low"
        >
          <Icon name="content_copy" className="text-[16px]" />
          {copied
            ? "已复制"
            : showWechatExtras && copyMode === "rich"
              ? "复制富文本"
              : "复制"}
        </button>
      )}

      {showWechatExtras && hasPlatformContent(project, "wechat") && (
        <button
          type="button"
          onClick={onExportWechatHtml}
          className="hidden items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low lg:flex"
        >
          <Icon name="code" className="text-[16px]" />
          导出 HTML
        </button>
      )}

      {showDraftExport && (
        <button
          type="button"
          onClick={onExportDraftBundle}
          disabled={exportingDraft}
          className="hidden items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50 sm:flex"
        >
          <Icon name="upload_file" className="text-[16px]" />
          {exportingDraft ? "导出中…" : "导出初稿包"}
        </button>
      )}

      <div ref={moreRef} className="relative">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low"
        >
          更多
          <Icon name="expand_more" className="text-[16px]" />
        </button>
        {moreOpen && (
          <div className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onExportAll();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low"
            >
              <Icon name="ios_share" className="text-[16px]" />
              导出全部
            </button>
            {showDraftExport && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onExportDraftBundle();
                }}
                disabled={exportingDraft}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50 sm:hidden"
              >
                <Icon name="upload_file" className="text-[16px]" />
                导出初稿包
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onMarkReady();
              }}
              disabled={isReady}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50"
            >
              <Icon name="check_circle" className="text-[16px]" />
              {isReady ? "已标记待发布 ✓" : "标记待发布"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
