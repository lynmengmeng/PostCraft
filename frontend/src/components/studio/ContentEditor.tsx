"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ContentProject, Platform } from "@/lib/types";

interface ContentEditorProps {
  project: ContentProject;
  platform: Platform;
  onUpdate: (project: ContentProject) => void;
}

export function ContentEditor({ project, platform, onUpdate }: ContentEditorProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function scheduleSave(next: ContentProject) {
    onUpdate(next);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const saved = await api.updateProject(project.id, {
          platforms: next.platforms,
          draft: next.draft,
          humanized: next.humanized,
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
    scheduleSave(next);
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

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-stone-500">当前平台内容（可编辑）</h3>
        <span className="text-xs text-stone-400">
          {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已自动保存" : ""}
        </span>
      </div>

      {platform === "wechat" && (
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
          <textarea
            value={project.platforms.wechat.body}
            onChange={(e) => updateWechat("body", e.target.value)}
            className="min-h-48 w-full rounded-lg border border-stone-200 p-3 text-sm leading-7"
            placeholder="正文 Markdown"
          />
        </div>
      )}

      {platform === "xiaohongshu" && (
        <div className="space-y-3">
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

      {platform === "douyin" && (
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
