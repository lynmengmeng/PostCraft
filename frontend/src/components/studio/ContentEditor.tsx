"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ContentProject, Platform, WechatLayoutPreset } from "@/lib/types";
import {
  createEmptyAssetSlot,
  insertPlaceholderInBody,
  nextAssetIndex,
  syncImagePlacementsFromBody,
} from "@/lib/wechat-assets";
import { LAYOUT_PRESET_LABELS, normalizeStyleTheme } from "@/lib/wechat-html";
import { editableInputClassName, editableInputProps } from "@/lib/editable-input";

export type EditorTab = "draft" | Platform;

interface ContentEditorProps {
  project: ContentProject;
  editorTab: EditorTab;
  onUpdate: (project: ContentProject) => void;
  onSaveError?: (message: string) => void;
}

export function ContentEditor({ project, editorTab, onUpdate, onSaveError }: ContentEditorProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const wechatBodyRef = useRef<HTMLTextAreaElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTokenRef = useRef(0);
  const projectRef = useRef(project);
  projectRef.current = project;

  const [localDraft, setLocalDraft] = useState(() => project.humanized || project.draft || "");
  const localDraftRef = useRef(localDraft);
  localDraftRef.current = localDraft;

  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const external = project.humanized || project.draft || "";
    if (external === localDraftRef.current) return;
    setLocalDraft(external);
  }, [project.humanized, project.draft]);

  useLayoutEffect(() => {
    const textarea = draftTextareaRef.current;
    const selection = selectionRef.current;
    if (!textarea || !selection) return;
    textarea.setSelectionRange(selection.start, selection.end);
    selectionRef.current = null;
  }, [localDraft]);

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
        onSaveError?.("自动保存失败，请检查网络后重试");
      }
    }, 800);
  }

  function scheduleDraftSave(next: ContentProject) {
    const savingDraft = next.humanized || "";
    const token = ++draftSaveTokenRef.current;

    onUpdate(next);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (token !== draftSaveTokenRef.current) return;
      try {
        const saved = await api.updateProject(project.id, {
          platforms: next.platforms,
          draft: next.draft,
          humanized: next.humanized,
        });
        if (token !== draftSaveTokenRef.current) return;

        const localStillMatchesSave = localDraftRef.current === savingDraft;
        if (localStillMatchesSave) {
          onUpdate(saved);
        } else {
          // 用户仍在编辑：只同步风险扫描等元数据，不覆盖本地初稿
          onUpdate({
            ...projectRef.current,
            risk_warnings: saved.risk_warnings,
            updated_at: saved.updated_at,
          });
        }
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        if (token === draftSaveTokenRef.current) {
          setSaveState("idle");
          onSaveError?.("自动保存失败，请检查网络后重试");
        }
      }
    }, 800);
  }

  function updateWechatPreset(preset: WechatLayoutPreset) {
    const next = structuredClone(project);
    next.platforms.wechat.style_theme = {
      ...normalizeStyleTheme(next.platforms.wechat.style_theme),
      layout_preset: preset,
    };
    scheduleSave(next);
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

  function updateDraft(value: string) {
    const textarea = draftTextareaRef.current;
    if (textarea) {
      selectionRef.current = {
        start: textarea.selectionStart ?? value.length,
        end: textarea.selectionEnd ?? value.length,
      };
    }
    setLocalDraft(value);
    const next = structuredClone(project);
    next.humanized = value;
    next.draft = value;
    scheduleDraftSave(next);
  }

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-on-surface-variant">
          {editorTab === "draft" ? "观察型初稿（可编辑）" : "当前平台内容（可编辑）"}
        </h3>
        <span className="text-xs text-on-surface-variant/60">
          {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已自动保存" : ""}
        </span>
      </div>

      {editorTab === "draft" && (
        <textarea
          ref={draftTextareaRef}
          value={localDraft}
          onChange={(e) => updateDraft(e.target.value)}
          className={`${editableInputClassName} min-h-72 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-sm leading-7 text-on-surface`}
          placeholder="初稿将显示在这里。可通过对话继续打磨，满意后再生成各平台内容。"
          {...editableInputProps}
        />
      )}

      {editorTab === "wechat" && (
        <div className={`space-y-3 ${editableInputClassName}`} translate="no">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-on-surface-variant">排版预设</label>
            <select
              value={normalizeStyleTheme(project.platforms.wechat.style_theme).layout_preset}
              onChange={(e) => updateWechatPreset(e.target.value as WechatLayoutPreset)}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface"
            >
              {(Object.entries(LAYOUT_PRESET_LABELS) as [WechatLayoutPreset, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
            {project.platforms.wechat.style_theme?.mood && (
              <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant">
                {project.platforms.wechat.style_theme.mood}
              </span>
            )}
          </div>
          <input
            value={project.platforms.wechat.title}
            onChange={(e) => updateWechat("title", e.target.value)}
            className={`${editableInputClassName} w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface`}
            placeholder="公众号标题"
            {...editableInputProps}
          />
          <input
            value={project.platforms.wechat.summary}
            onChange={(e) => updateWechat("summary", e.target.value)}
            className={`${editableInputClassName} w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface`}
            placeholder="摘要"
            {...editableInputProps}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={insertWechatPlaceholderAtCursor}
              className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-low"
            >
              插入配图占位
            </button>
          </div>
          <p className="text-xs leading-relaxed text-on-surface-variant/70">
            在正文对应位置写 <code className="rounded bg-surface-container px-1">![图注](__IMAGE_0__)</code>{" "}
            占位；上传或 AI 生成请在右侧预览区对应占位处操作。
          </p>
          <textarea
            ref={wechatBodyRef}
            value={project.platforms.wechat.body}
            onChange={(e) => updateWechat("body", e.target.value)}
            className={`${editableInputClassName} min-h-48 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 font-mono text-sm leading-7 text-on-surface`}
            placeholder="正文 Markdown，可用 ![图注](__IMAGE_0__) 标记配图位置"
            {...editableInputProps}
          />
        </div>
      )}

      {editorTab === "xiaohongshu" && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-on-surface-variant/80">
            轮播配图（3:4 竖版）请在右侧「小红书轮播配图」区管理，系统会按内容规划 1–6 张图。
          </p>
          <input
            value={project.platforms.xiaohongshu.title}
            onChange={(e) => updateXhs("title", e.target.value)}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
            placeholder="笔记标题"
          />
          <textarea
            value={project.platforms.xiaohongshu.body}
            onChange={(e) => updateXhs("body", e.target.value)}
            className="min-h-48 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 text-sm leading-7 text-on-surface"
            placeholder="笔记正文"
          />
          <input
            value={project.platforms.xiaohongshu.tags.map((t) => `#${t}`).join(" ")}
            onChange={(e) => updateXhsTags(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
            placeholder="#标签1 #标签2"
          />
        </div>
      )}

      {editorTab === "douyin" && (
        <div className="space-y-3">
          <input
            value={project.platforms.douyin.hook}
            onChange={(e) => updateDouyinHook(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
            placeholder="3 秒钩子"
          />
          <div className="space-y-2">
            {project.platforms.douyin.script.map((scene) => (
              <div key={scene.index} className="rounded-lg bg-surface-container-low p-3">
                <div className="text-xs text-on-surface-variant/70">
                  镜号 {scene.index} · {scene.duration}
                </div>
                <textarea
                  value={scene.narration}
                  onChange={(e) => updateDouyinScene(scene.index, e.target.value)}
                  className="mt-1 min-h-16 w-full rounded border border-outline-variant/30 bg-surface-container-lowest p-2 text-sm text-on-surface"
                />
                <div className="mt-1 text-xs text-on-surface-variant">画面：{scene.visual}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
