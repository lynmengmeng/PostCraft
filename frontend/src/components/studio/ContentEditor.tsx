"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import type { ContentProject, Platform } from "@/lib/types";
import {
  createEmptyAssetSlot,
  insertPlaceholderInBody,
  nextAssetIndex,
  syncImagePlacementsFromBody,
} from "@/lib/wechat-assets";

export type EditorTab = "draft" | Platform;

interface ContentEditorProps {
  project: ContentProject;
  editorTab: EditorTab;
  onUpdate: (project: ContentProject) => void;
}

export function ContentEditor({ project, editorTab, onUpdate }: ContentEditorProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wechatAssetInputRef = useRef<HTMLInputElement>(null);
  const wechatBodyRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function scheduleSave(next: ContentProject, includeAssets = false) {
    onUpdate(next);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const saved = await api.updateProject(project.id, {
          platforms: next.platforms,
          draft: next.draft,
          humanized: next.humanized,
          ...(includeAssets ? { cover_assets: next.cover_assets } : {}),
        });
        onUpdate(saved);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("idle");
      }
    }, 800);
  }

  function updateWechat(field: "title" | "summary" | "body", value: string) {
    const next = structuredClone(project);
    next.platforms.wechat[field] = value;
    if (field === "body") {
      next.platforms.wechat.image_placements = syncImagePlacementsFromBody(
        value,
        next.cover_assets,
      );
    }
    scheduleSave(next, field === "body");
  }

  function insertWechatPlaceholderAtCursor() {
    const index = nextAssetIndex(project.cover_assets);
    const caption = `配图${index + 1}`;
    const placeholder = `![${caption}](__IMAGE_${index}__)`;
    const body = project.platforms.wechat.body || "";
    const textarea = wechatBodyRef.current;
    let nextBody = body;

    if (textarea) {
      const start = textarea.selectionStart ?? body.length;
      const end = textarea.selectionEnd ?? body.length;
      const before = body.slice(0, start);
      const after = body.slice(end);
      const prefix = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
      const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
      nextBody = `${before}${prefix}${placeholder}${suffix}${after}`;
    } else {
      nextBody = insertPlaceholderInBody(body, index, caption);
    }

    const next = structuredClone(project);
    next.platforms.wechat.body = nextBody;
    next.platforms.wechat.image_placements = syncImagePlacementsFromBody(nextBody, [
      ...next.cover_assets,
      createEmptyAssetSlot(index, caption),
    ]);
    if (!next.cover_assets.some((a) => (a.asset_index ?? -1) === index)) {
      next.cover_assets.push(createEmptyAssetSlot(index, caption));
    }
    scheduleSave(next, true);
  }

  async function handleWechatAssetUpload(file: File) {
    setUploading(true);
    try {
      const caption = file.name.replace(/\.[^.]+$/, "").slice(0, 20) || "用户配图";
      const saved = await api.uploadAsset(project.id, file, {
        caption,
        insertPlaceholder: true,
      });
      onUpdate(saved);
    } finally {
      setUploading(false);
      if (wechatAssetInputRef.current) wechatAssetInputRef.current.value = "";
    }
  }

  function updateXhs(field: "title" | "body", value: string) {
    const next = structuredClone(project);
    next.platforms.xiaohongshu[field] = value;
    scheduleSave(next);
  }

  function updateXhsTags(value: string) {
    const next = structuredClone(project);
    next.platforms.xiaohongshu.tags = value
      .split(/[,，\s]+/)
      .map((t) => t.replace(/^#/, ""))
      .filter(Boolean);
    scheduleSave(next);
  }

  function updateDouyinHook(value: string) {
    const next = structuredClone(project);
    next.platforms.douyin.hook = value;
    scheduleSave(next);
  }

  function updateDouyinScene(index: number, narration: string) {
    const next = structuredClone(project);
    const scene = next.platforms.douyin.script.find((s) => s.index === index);
    if (scene) scene.narration = narration;
    scheduleSave(next);
  }

  async function handleCoverUpload(file: File) {
    setUploading(true);
    try {
      const saved = await api.uploadCover(project.id, file);
      onUpdate(saved);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateDraft(value: string) {
    const next = structuredClone(project);
    next.humanized = value;
    next.draft = value;
    scheduleSave(next);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-stone-500">
          {editorTab === "draft" ? "观察型初稿（可编辑）" : "当前平台内容（可编辑）"}
        </h3>
        <span className="text-xs text-stone-400">
          {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已自动保存" : ""}
        </span>
      </div>

      {editorTab === "draft" && (
        <textarea
          value={project.humanized || project.draft || ""}
          onChange={(e) => updateDraft(e.target.value)}
          className="min-h-72 w-full rounded-lg border border-stone-200 p-4 text-sm leading-7"
          placeholder="初稿将显示在这里。可通过对话继续打磨，满意后再生成各平台内容。"
        />
      )}

      {editorTab === "wechat" && (
        <div className="space-y-3">
          <input
            value={project.platforms.wechat.title}
            onChange={(e) => updateWechat("title", e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="公众号标题"
          />
          <input
            value={project.platforms.wechat.summary}
            onChange={(e) => updateWechat("summary", e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="摘要"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={insertWechatPlaceholderAtCursor}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
            >
              插入配图占位
            </button>
            <button
              type="button"
              onClick={() => wechatAssetInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {uploading ? "上传中…" : "上传配图"}
            </button>
            <input
              ref={wechatAssetInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleWechatAssetUpload(file);
              }}
            />
          </div>
          <p className="text-xs leading-relaxed text-stone-400">
            在正文对应位置写 <code className="rounded bg-stone-100 px-1">![图注](__IMAGE_0__)</code>{" "}
            占位，或在聊天中上传素材后说「把这张图放到第 2 段后」。
          </p>
          <textarea
            ref={wechatBodyRef}
            value={project.platforms.wechat.body}
            onChange={(e) => updateWechat("body", e.target.value)}
            className="min-h-48 w-full rounded-lg border border-stone-200 p-3 font-mono text-sm leading-7"
            placeholder="正文 Markdown，可用 ![图注](__IMAGE_0__) 标记配图位置"
          />
        </div>
      )}

      {editorTab === "xiaohongshu" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-stone-500">封面图（建议 3:4）</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg bg-stone-900 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {uploading ? "上传中…" : "上传封面"}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCoverUpload(file);
              }}
            />
            {project.platforms.xiaohongshu.cover_image && (
              <img
                src={resolveImageUrl(project.platforms.xiaohongshu.cover_image)}
                alt="当前封面"
                className="mt-2 aspect-[3/4] w-full max-w-[200px] rounded-lg object-cover"
              />
            )}
          </div>
          <input
            value={project.platforms.xiaohongshu.title}
            onChange={(e) => updateXhs("title", e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="笔记标题"
          />
          <textarea
            value={project.platforms.xiaohongshu.body}
            onChange={(e) => updateXhs("body", e.target.value)}
            className="min-h-48 w-full rounded-lg border border-stone-200 p-3 text-sm leading-7"
            placeholder="笔记正文"
          />
          <input
            value={project.platforms.xiaohongshu.tags.map((t) => `#${t}`).join(" ")}
            onChange={(e) => updateXhsTags(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="#标签1 #标签2"
          />
        </div>
      )}

      {editorTab === "douyin" && (
        <div className="space-y-3">
          <input
            value={project.platforms.douyin.hook}
            onChange={(e) => updateDouyinHook(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="3 秒钩子"
          />
          <div className="space-y-2">
            {project.platforms.douyin.script.map((scene) => (
              <div key={scene.index} className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs text-stone-400">
                  镜号 {scene.index} · {scene.duration}
                </div>
                <textarea
                  value={scene.narration}
                  onChange={(e) => updateDouyinScene(scene.index, e.target.value)}
                  className="mt-1 min-h-16 w-full rounded border border-stone-200 p-2 text-sm"
                />
                <div className="mt-1 text-xs text-stone-500">画面：{scene.visual}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
