"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ContentEditor, type EditorTab } from "@/components/studio/ContentEditor";
import {
  PreviewPanel,
  getPlatformCopyText,
} from "@/components/preview/PlatformPreview";
import { Icon } from "@/components/ui/Icon";
import { ResizableColumns } from "@/components/ui/ResizableColumns";
import { api, platformLabels, type ChatOptions } from "@/lib/api";
import { exportAllPlatforms, resolveImageUrl } from "@/lib/export";
import type { ContentProject, Platform } from "@/lib/types";

const platformIcons: Record<Platform, string> = {
  wechat: "chat_bubble",
  xiaohongshu: "photo_library",
  douyin: "movie_filter",
};

type StudioViewMode = "split" | "preview" | "edit";

const quickCommands = [
  "更温和一点",
  "去掉说教感",
  "加个人经历，少堆数据",
  "给我 10 个标题",
  "检查敏感表述",
  "撤销上一版",
];

function hasDraft(project: ContentProject) {
  return !!(project.humanized || project.draft);
}

function hasPlatformContent(project: ContentProject, item: Platform) {
  if (item === "wechat") return !!project.platforms.wechat.body;
  if (item === "xiaohongshu") return !!project.platforms.xiaohongshu.body;
  return project.platforms.douyin.script.length > 0;
}

export default function CreateStudioPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const autoStarted = useRef(false);
  const [project, setProject] = useState<ContentProject | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("draft");
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("wechat");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingLines, setStreamingLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<StudioViewMode>("split");

  useEffect(() => {
    api
      .getProject(params.projectId)
      .then(async (loaded) => {
        setProject(loaded);
        if (
          !autoStarted.current &&
          loaded.chat_history.length === 0 &&
          !hasDraft(loaded)
        ) {
          autoStarted.current = true;
          await sendChat("", loaded, { action: "generate_draft" });
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]);

  async function sendChat(text: string, current = project, options?: ChatOptions) {
    if (!current || sending) return;
    if (!text.trim() && !options?.action) return;
    setSending(true);
    setError("");
    setStreamingLines([]);
    try {
      const result = await api.chat(
        current.id,
        text,
        previewPlatform,
        true,
        (delta) => {
          setStreamingLines((prev) => [...prev, delta]);
        },
        options,
      );
      setProject(result.project);
      setMessage("");
      setStreamingLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
      setStreamingLines([]);
    } finally {
      setSending(false);
    }
  }

  async function generatePlatform(target: Platform | "all") {
    if (!project || !hasDraft(project)) {
      setError("请先生成并确认初稿");
      return;
    }
    if (target === "all") {
      await sendChat("", project, { action: "generate_all" });
      setEditorTab("wechat");
      setPreviewPlatform("wechat");
      return;
    }
    await sendChat("", project, {
      action: "generate_platform",
      target_platforms: [target],
    });
    setEditorTab(target);
    setPreviewPlatform(target);
  }

  async function runFactCheck() {
    if (!project) return;
    const result = await api.factCheck(project.id);
    setProject({ ...project, risk_warnings: result.warnings });
  }

  async function applyTitle(index: number) {
    if (!project) return;
    const updated = await api.applyTitle(project.id, index, previewPlatform);
    setProject(updated);
  }

  async function restoreVersion(versionId: string) {
    if (!project) return;
    const updated = await api.restoreVersion(project.id, versionId);
    setProject(updated);
  }

  async function markReady() {
    if (!project) return;
    const updated = await api.updateProject(project.id, { status: "ready" });
    setProject(updated);
  }

  async function copyCurrentPlatform() {
    if (!project) return;
    const text =
      editorTab === "draft"
        ? project.humanized || project.draft || project.inspiration
        : getPlatformCopyText(project, previewPlatform);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return <div className="p-8 text-on-surface-variant">加载创作室...</div>;
  }

  if (!project) {
    return <div className="p-8 text-error">{error || "项目不存在"}</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-outline-variant/30 bg-surface/80 px-gutter py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            返回
          </button>
          <div>
            <h1 className="font-headline font-semibold">{project.title}</h1>
            <p className="text-xs text-on-surface-variant">{project.inspiration.slice(0, 60)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-outline-variant/30 p-0.5">
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
                onClick={() => setViewMode(mode)}
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
          <button
            type="button"
            onClick={copyCurrentPlatform}
            className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low"
          >
            <Icon name="content_copy" className="text-[16px]" />
            {copied ? "已复制" : "复制"}
          </button>
          <button
            type="button"
            onClick={() => exportAllPlatforms(project)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-on-primary hover:opacity-90"
          >
            <Icon name="ios_share" className="text-[16px]" />
            导出
          </button>
          <button
            type="button"
            onClick={markReady}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-container-low"
          >
            标记待发布
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <ResizableColumns
          panels={[
            {
              id: "chat",
              defaultPercent: 25,
              minPercent: 12,
              content: (
        <section
          className="custom-shadow flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest"
        >
          <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-primary">
              <Icon name="smart_toy" className="text-[18px]" />
              AI 协作
            </span>
          </div>
          {hasDraft(project) && (
            <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container-low/50 p-4">
              <p className="mb-3 text-[13px] font-semibold text-on-surface">初稿已就绪</p>
              <p className="mb-4 text-[12px] leading-relaxed text-on-surface-variant">
                继续对话可打磨初稿。满意后，再按需生成各平台内容。
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(platformLabels) as Platform[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => generatePlatform(item)}
                    disabled={sending}
                    className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    生成{platformLabels[item]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => generatePlatform("all")}
                  disabled={sending}
                  className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-on-primary disabled:opacity-50"
                >
                  一键生成三平台
                </button>
              </div>
            </div>
          )}
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
            {project.chat_summary && (
              <p
                className="text-xs text-on-surface-variant/60 line-clamp-2"
                title={project.chat_summary}
              >
                摘要已压缩较早对话
              </p>
            )}
            {project.chat_history.map((item) =>
              item.role === "user" ? (
                <div key={item.id} className="flex justify-end">
                  <div className="max-w-[88%] rounded-[12px] rounded-tr-none bg-primary/12 px-5 py-3 text-left text-sm leading-relaxed text-on-surface">
                    {item.content}
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface shadow-sm"
                >
                  {item.content}
                </div>
              ),
            )}
            {streamingLines.length > 0 && (
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface shadow-sm">
                {streamingLines.map((line, i) => (
                  <div key={`${line}-${i}`}>{line}</div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3 border-t border-outline-variant/10 bg-surface-container-lowest p-4">
            <div className="flex flex-wrap gap-2">
              {quickCommands.slice(0, 4).map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => sendChat(cmd)}
                  disabled={sending}
                  className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-[12px] text-on-surface transition-colors hover:bg-outline-variant/30"
                >
                  <Icon name="auto_awesome" className="text-[14px]" />
                  {cmd}
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat(message);
                  }
                }}
                placeholder="继续打磨初稿，或提出修改意见..."
                className="h-20 w-full resize-none rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => sendChat(message)}
                disabled={sending}
                className="absolute bottom-2 right-2 text-primary disabled:opacity-50"
              >
                <Icon name="send" className="text-[20px]" />
              </button>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        </section>
              ),
            },
            {
              id: "content",
              defaultPercent: viewMode === "edit" ? 75 : (4 / 12) * 100,
              minPercent: 12,
              hidden: viewMode === "preview",
              content: (
        <section
          className="custom-shadow flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest"
        >
          <div className="flex border-b border-outline-variant/10 bg-surface-container-low/20">
            <button
              type="button"
              onClick={() => setEditorTab("draft")}
              className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm transition-all ${
                editorTab === "draft"
                  ? "platform-active"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <Icon name="edit_note" className="text-[20px]" />
              初稿
            </button>
            {(Object.keys(platformLabels) as Platform[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setEditorTab(item);
                  setPreviewPlatform(item);
                }}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm transition-all ${
                  editorTab === item
                    ? "platform-active"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                <Icon name={platformIcons[item]} className="text-[20px]" />
                {platformLabels[item]}
                {hasPlatformContent(project, item) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">
              {editorTab === "draft" ? "初稿编辑" : "平台内容编辑"}
            </span>
            {viewMode === "edit" && (
              <span className="text-xs text-on-surface-variant/60">修改后自动保存并扫描风险</span>
            )}
          </div>
          <div className="space-y-4">
            <ContentEditor project={project} editorTab={editorTab} onUpdate={setProject} />

            {(project.risk_warnings || []).length > 0 ? (
              <div className="rounded-xl border border-secondary-container bg-secondary-container/30 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-secondary">表述风险提示</h3>
                  <button
                    type="button"
                    onClick={runFactCheck}
                    className="text-xs text-primary underline"
                  >
                    重新扫描
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(project.risk_warnings || []).map((warning) => (
                    <div key={`${warning.phrase}-${warning.suggestion}`} className="text-sm">
                      <span className="font-medium text-on-surface">「{warning.phrase}」</span>
                      <span className="text-on-surface-variant"> — {warning.suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant/60">编辑或 AI 修改后会自动扫描表述风险</p>
            )}

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-on-surface-variant">标题备选</h3>
                <button
                  type="button"
                  onClick={runFactCheck}
                  className="text-xs text-primary underline"
                >
                  检查敏感表述
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {project.titles.map((title, index) => (
                  <button
                    key={`${title.text}-${index}`}
                    type="button"
                    onClick={() => applyTitle(index)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                      title.applied
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-surface-container-low hover:bg-surface-container"
                    }`}
                  >
                    <span className="text-xs text-on-surface-variant">{title.style}</span>
                    <div>{title.text}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
              <h3 className="text-sm font-medium text-on-surface-variant">封面与配图</h3>
              {project.cover_assets.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  生成任意平台内容后会自动生成封面。也可在对话中发送「生成封面配图」。
                </p>
              ) : (
                project.cover_assets.map((asset) => (
                  <div key={asset.id} className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm">
                    {asset.image_url ? (
                      <img
                        src={resolveImageUrl(asset.image_url)}
                        alt={asset.headline}
                        className="mb-2 aspect-[3/4] w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-surface-container text-xs text-on-surface-variant">
                        配图生成中或失败，可在对话中发送「生成封面配图」重试
                      </div>
                    )}
                    <div className="font-medium">{asset.headline}</div>
                    <div className="text-on-surface-variant">{asset.subheadline}</div>
                    <div className="mt-2 text-xs text-on-surface-variant/60">{asset.prompt}</div>
                  </div>
                ))
              )}
            </div>

            {(project.versions || []).length > 0 && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
                <h3 className="text-sm font-medium text-on-surface-variant">版本历史</h3>
                <div className="mt-3 space-y-2">
                  {[...(project.versions || [])].reverse().slice(0, 6).map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => restoreVersion(version.id)}
                      className="block w-full rounded-lg bg-surface-container-low px-3 py-2 text-left text-sm hover:bg-surface-container"
                    >
                      <div>{version.label}</div>
                      <div className="text-xs text-on-surface-variant/60">
                        {new Date(version.created_at).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </section>
              ),
            },
            {
              id: "preview",
              defaultPercent: viewMode === "preview" ? 75 : (5 / 12) * 100,
              minPercent: 12,
              hidden: viewMode === "edit",
              content: (
        <section className="custom-shadow flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
          <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
              预览 · {editorTab === "draft" ? "初稿" : platformLabels[previewPlatform]}
            </span>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
            {editorTab === "draft" ? (
              <div className="prose prose-stone max-w-none whitespace-pre-wrap text-[15px] leading-8 text-on-surface">
                {project.humanized || project.draft || "初稿生成后将显示在这里。"}
              </div>
            ) : (
              <PreviewPanel project={project} platform={previewPlatform} />
            )}
          </div>
        </section>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
