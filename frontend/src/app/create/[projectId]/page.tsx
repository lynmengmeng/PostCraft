"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ContentEditor, type EditorTab } from "@/components/studio/ContentEditor";
import { ChatComposer } from "@/components/studio/ChatComposer";
import {
  PreviewPanel,
  getPlatformCopyText,
} from "@/components/preview/PlatformPreview";
import { Icon } from "@/components/ui/Icon";
import { ResizableColumns } from "@/components/ui/ResizableColumns";
import { api, platformLabels, type ChatOptions } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { trackEvent } from "@/lib/metrics";
import { CoverAssetSlot } from "@/components/studio/CoverAssetSlot";
import {
  exportAllPlatforms,
  downloadDraftBundle,
  exportWechatHtml,
  resolveImageUrl,
  validateWechatContent,
} from "@/lib/export";
import { isWechatCoverAsset } from "@/lib/wechat-cover";
import type { ChatMessage, ContentProject, Platform } from "@/lib/types";
import { copyWechatRichHtml, getImagePlacementLabel } from "@/lib/wechat-html";

const HEALTH_DISCLAIMER =
  "以上仅为个人观察与生活记录，不构成医疗建议。如有健康问题，请咨询专业医生。";

const ALL_PLATFORMS: Platform[] = ["wechat", "xiaohongshu", "douyin"];

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
  "调整配图位置",
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

function buildOutgoingUserContent(
  text: string,
  attachmentUrls: string[],
  current: ContentProject,
  options?: ChatOptions,
): string {
  const trimmed = text.trim();
  if (trimmed) {
    let content = trimmed;
    if (attachmentUrls.length) {
      content += `\n[附件: ${attachmentUrls.join(", ")}]`;
    }
    return content;
  }
  if (attachmentUrls.length > 0) {
    return "请处理我上传的配图素材，插入公众号合适位置";
  }
  if (options?.action === "generate_draft" && current.inspiration.trim()) {
    return current.inspiration.trim();
  }
  const actionLabels: Record<NonNullable<ChatOptions["action"]>, string> = {
    generate_draft: "撰写观察型初稿",
    generate_all: "一键生成三平台内容",
    generate_platform: "生成平台内容",
    refine_draft: "继续完善初稿",
    layout_images: "调整公众号配图布局",
  };
  if (options?.action) {
    return actionLabels[options.action] ?? options.action;
  }
  return trimmed;
}

export default function CreateStudioPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { config } = useAuth();
  const standaloneViewport = config?.auth_required === false;
  const autoStarted = useRef(false);
  const [project, setProject] = useState<ContentProject | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("draft");
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("wechat");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingLines, setStreamingLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedTitleKey, setCopiedTitleKey] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<"rich" | "markdown">("rich");
  const [viewMode, setViewMode] = useState<StudioViewMode>("split");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [cascadePrompt, setCascadePrompt] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [exportingDraft, setExportingDraft] = useState(false);
  const [actionInfo, setActionInfo] = useState("");

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
          const seed = loaded.inspiration.trim();
          await sendChat(seed, loaded, { action: "generate_draft" });
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]);

  async function sendChat(text: string, current = project, options?: ChatOptions): Promise<boolean> {
    if (!current || sending) return false;
    const attachmentUrls = options?.attachment_urls ?? pendingAttachments;
    if (!text.trim() && !options?.action && attachmentUrls.length === 0) return false;

    const outgoing = buildOutgoingUserContent(text, attachmentUrls, current, options);
    const historyBefore = current.chat_history;
    const optimisticUser: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: outgoing,
      created_at: new Date().toISOString(),
      action: options?.action ?? null,
      target_platforms: options?.target_platforms ?? [],
      attachment_urls: attachmentUrls,
    };

    setProject({ ...current, chat_history: [...historyBefore, optimisticUser] });
    setChatMessage("");
    setPendingAttachments([]);
    setSending(true);
    setError("");
    setStreamingLines([]);

    try {
      const result = await api.chat(
        current.id,
        text.trim() ||
          (attachmentUrls.length > 0 ? "请处理我上传的配图素材，插入公众号合适位置" : ""),
        previewPlatform,
        true,
        (delta) => {
          setStreamingLines((prev) => [...prev, delta]);
        },
        {
          ...options,
          ...(attachmentUrls.length ? { attachment_urls: attachmentUrls } : {}),
        },
      );
      setProject(result.project);
      setStreamingLines([]);
      trackEvent("chat_message", {
        projectId: current.id,
        intent: result.patch?.intent,
        rounds: result.project.chat_history.filter((m) => m.role === "user").length,
      });
      if (
        result.patch?.intent === "refine_draft" &&
        result.patch.preview_hints?.includes("cascade_available")
      ) {
        setCascadePrompt(true);
      } else if (result.patch?.intent === "cascade") {
        setCascadePrompt(false);
      }
      if (result.patch?.intent === "generate_all") {
        trackEvent("multi_platform_generate", { projectId: current.id, platforms: 3 });
      }
      return true;
    } catch (err) {
      setProject({ ...current, chat_history: historyBefore });
      if (text.trim()) setChatMessage(text);
      setError(err instanceof Error ? err.message : "发送失败");
      setStreamingLines([]);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function regenerateAssistantMessage(assistantMessageId: string) {
    if (!project || sending || regeneratingId) return;
    setRegeneratingId(assistantMessageId);
    setSending(true);
    setError("");
    setStreamingLines([]);
    try {
      const result = await api.regenerateChat(
        project.id,
        assistantMessageId,
        previewPlatform,
        true,
        (delta) => {
          setStreamingLines((prev) => [...prev, delta]);
        },
      );
      setProject(result.project);
      setStreamingLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新生成失败");
      setStreamingLines([]);
    } finally {
      setSending(false);
      setRegeneratingId(null);
    }
  }

  async function handleChatAssetUpload(file: File) {
    if (!project) return;
    setError("");
    try {
      const saved = await api.uploadAsset(project.id, file, { insertPlaceholder: false });
      setProject(saved);
      const latest = saved.cover_assets[saved.cover_assets.length - 1];
      if (latest?.image_url) {
        setPendingAttachments((prev) => [...prev, latest.image_url!]);
      }
      setChatMessage((prev) =>
        prev.trim() ? prev : "请把这张素材插入公众号合适的位置，并写上图注",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function cascadeToPlatforms(targets: Platform[]) {
    if (!project || cascading || sending) return;
    setCascading(true);
    setSending(true);
    setError("");
    setStreamingLines([]);
    try {
      const result = await api.cascadePlatforms(project.id, targets, true, (delta) => {
        setStreamingLines((prev) => [...prev, delta]);
      });
      setProject(result.project);
      setCascadePrompt(false);
      setStreamingLines([]);
      trackEvent("cascade_platforms", { projectId: project.id, platforms: targets });
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败");
      setStreamingLines([]);
    } finally {
      setCascading(false);
      setSending(false);
    }
  }

  async function insertHealthDisclaimer() {
    if (!project) return;
    const disclaimer =
      project.risk_warnings?.find((w) => w.warning_type === "health")?.suggested_insert ||
      HEALTH_DISCLAIMER;
    const block = `\n\n---\n\n${disclaimer}`;
    const payload: Partial<ContentProject> = {};
    if (project.humanized || project.draft) {
      const base = project.humanized || project.draft || "";
      payload.humanized = base.includes(disclaimer) ? base : `${base}${block}`;
      payload.draft = payload.humanized;
    }
    const platform = previewPlatform;
    if (platform === "wechat" && project.platforms.wechat.body) {
      const body = project.platforms.wechat.body;
      payload.platforms = {
        ...project.platforms,
        wechat: {
          ...project.platforms.wechat,
          body: body.includes(disclaimer) ? body : `${body}${block}`,
        },
      };
    } else if (platform === "xiaohongshu" && project.platforms.xiaohongshu.body) {
      const body = project.platforms.xiaohongshu.body;
      payload.platforms = {
        ...project.platforms,
        xiaohongshu: {
          ...project.platforms.xiaohongshu,
          body: body.includes(disclaimer) ? body : `${body}${block}`,
        },
      };
    }
    const updated = await api.updateProject(project.id, payload);
    setProject(updated);
    trackEvent("insert_health_disclaimer", { projectId: project.id });
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
    const platform =
      editorTab === "draft" ? previewPlatform : (editorTab as Platform);
    const updated = await api.applyTitle(project.id, index, platform);
    setProject(updated);
  }

  async function copyTextToClipboard(text: string, feedbackKey?: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (feedbackKey) {
      setCopiedTitleKey(feedbackKey);
      setTimeout(() => setCopiedTitleKey(null), 1500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function copyTitleAt(index: number) {
    if (!project) return;
    const title = project.titles[index]?.text;
    if (!title) return;
    await copyTextToClipboard(title, `title-${index}`);
  }

  async function copyAllTitles() {
    if (!project || project.titles.length === 0) return;
    const text = project.titles
      .map((t, i) => `${i + 1}. [${t.style}] ${t.text}`)
      .join("\n");
    await copyTextToClipboard(text, "all-titles");
  }

  async function copyCurrentWechatTitle() {
    if (!project) return;
    const title = project.platforms.wechat.title.trim();
    if (!title) return;
    await copyTextToClipboard(title, "current-title");
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
    trackEvent("project_ready", {
      projectId: project.id,
      rounds: project.chat_history.filter((m) => m.role === "user").length,
    });
  }

  async function exportDraftBundle() {
    if (!project) return;
    setExportingDraft(true);
    setError("");
    setActionInfo("");
    try {
      const bundle = await api.exportDraftBundle(project.id);
      downloadDraftBundle(
        { ...bundle, source_env: typeof window !== "undefined" ? window.location.hostname : "" },
        project.title,
      );
      setActionInfo("初稿包已下载，可在测试环境工作台导入");
      setTimeout(() => setActionInfo(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出初稿包失败");
    } finally {
      setExportingDraft(false);
    }
  }

  async function copyCurrentPlatform() {
    if (!project) return;
    try {
      if (editorTab === "wechat" || (editorTab !== "draft" && previewPlatform === "wechat")) {
        if (copyMode === "rich") {
          await copyWechatRichHtml(
            project.platforms.wechat,
            project.cover_assets,
            resolveImageUrl,
          );
        } else {
          await navigator.clipboard.writeText(getPlatformCopyText(project, "wechat"));
        }
      } else {
        const text =
          editorTab === "draft"
            ? project.humanized || project.draft || project.inspiration
            : getPlatformCopyText(project, previewPlatform);
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败，请检查浏览器剪贴板权限");
    }
  }

  const wechatChecks =
    project && editorTab === "wechat"
      ? validateWechatContent(project.platforms.wechat, project.cover_assets)
      : [];

  if (loading) {
    return <div className="p-8 text-on-surface-variant">加载创作室...</div>;
  }

  if (!project) {
    return <div className="p-8 text-error">{error || "项目不存在"}</div>;
  }

  return (
    <div
      className={`flex flex-col overflow-hidden bg-background ${
        standaloneViewport ? "h-dvh" : "min-h-0 flex-1"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface/80 px-gutter py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/workspace")}
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
          <div className="flex items-center gap-1">
            {(editorTab === "wechat" || previewPlatform === "wechat") && editorTab !== "draft" && (
              <>
                <button
                  type="button"
                  onClick={copyCurrentWechatTitle}
                  disabled={!project.platforms.wechat.title.trim()}
                  className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40"
                >
                  <Icon name="title" className="text-[16px]" />
                  {copiedTitleKey === "current-title" ? "标题已复制" : "复制标题"}
                </button>
                <select
                  value={copyMode}
                  onChange={(e) => setCopyMode(e.target.value as "rich" | "markdown")}
                  className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs text-on-surface-variant"
                >
                  <option value="rich">富文本</option>
                  <option value="markdown">Markdown</option>
                </select>
              </>
            )}
            <button
              type="button"
              onClick={copyCurrentPlatform}
              className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="content_copy" className="text-[16px]" />
              {copied
                ? "已复制"
                : editorTab === "wechat" && copyMode === "rich"
                  ? "复制富文本"
                  : "复制"}
            </button>
          </div>
          {editorTab === "wechat" && (
            <button
              type="button"
              onClick={() => exportWechatHtml(project)}
              className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="code" className="text-[16px]" />
              导出 HTML
            </button>
          )}
          {(project.inspiration || hasDraft(project)) && (
            <button
              type="button"
              onClick={exportDraftBundle}
              disabled={exportingDraft}
              className="flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
            >
              <Icon name="upload_file" className="text-[16px]" />
              {exportingDraft ? "导出中…" : "导出初稿包"}
            </button>
          )}
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
          className="custom-shadow notranslate flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest"
          translate="no"
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
          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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
                  <div
                    className={`max-w-[88%] rounded-[12px] rounded-tr-none bg-primary/12 px-5 py-3 text-left text-sm leading-relaxed text-on-surface ${
                      item.id.startsWith("pending-") ? "opacity-90" : ""
                    }`}
                  >
                    {item.content}
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface shadow-sm ${
                    regeneratingId === item.id ? "ring-2 ring-primary/30" : ""
                  }`}
                >
                  {item.content}
                  <div className="absolute right-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => regenerateAssistantMessage(item.id)}
                      disabled={sending}
                      title="重新生成此回复"
                      className="flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface/95 px-2 py-1 text-[11px] text-on-surface-variant shadow-sm backdrop-blur hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <Icon
                        name={regeneratingId === item.id ? "progress_activity" : "refresh"}
                        className={`text-[14px] ${regeneratingId === item.id ? "animate-spin" : ""}`}
                      />
                      {regeneratingId === item.id ? "生成中" : "重新生成"}
                    </button>
                  </div>
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
            {cascadePrompt && hasDraft(project) && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm text-on-surface">初稿已更新。是否同步到已有平台版本？</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCascadePrompt(false)}
                    disabled={cascading}
                    className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:border-primary disabled:opacity-50"
                  >
                    仅保留初稿
                  </button>
                  <button
                    type="button"
                    onClick={() => cascadeToPlatforms(ALL_PLATFORMS.filter((p) => hasPlatformContent(project, p)))}
                    disabled={cascading || sending}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
                  >
                    {cascading ? "同步中…" : "同步全部平台"}
                  </button>
                  {(Object.keys(platformLabels) as Platform[])
                    .filter((p) => hasPlatformContent(project, p))
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => cascadeToPlatforms([p])}
                        disabled={cascading || sending}
                        className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:border-primary disabled:opacity-50"
                      >
                        仅{platformLabels[p]}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="shrink-0 space-y-3 border-t border-outline-variant/10 bg-surface-container-lowest p-4">
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
            <ChatComposer
              message={chatMessage}
              onMessageChange={setChatMessage}
              sending={sending}
              pendingAttachments={pendingAttachments}
              onSend={(text) => sendChat(text)}
              onUploadAsset={(file) => void handleChatAssetUpload(file)}
            />
            {actionInfo && <p className="text-xs text-primary">{actionInfo}</p>}
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
          <div className="flex shrink-0 border-b border-outline-variant/10 bg-surface-container-low/20">
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
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-secondary">表述风险提示</h3>
                  <div className="flex items-center gap-3">
                    {(project.risk_warnings || []).some((w) => w.warning_type === "health") && (
                      <button
                        type="button"
                        onClick={() => void insertHealthDisclaimer()}
                        className="text-xs font-medium text-primary underline"
                      >
                        一键插入免责声明
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={runFactCheck}
                      className="text-xs text-primary underline"
                    >
                      重新扫描
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {(project.risk_warnings || []).map((warning) => (
                    <div key={`${warning.phrase}-${warning.suggestion}`} className="text-sm">
                      <span className="font-medium text-on-surface">「{warning.phrase}」</span>
                      <span className="text-on-surface-variant"> — {warning.suggestion}</span>
                      {warning.suggested_insert && (
                        <p className="mt-1 text-xs text-on-surface-variant/80">
                          建议插入：{warning.suggested_insert}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant/60">编辑或 AI 修改后会自动扫描表述风险</p>
            )}

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-on-surface-variant">标题备选</h3>
                <div className="flex items-center gap-3">
                  {project.titles.length > 0 && (
                    <button
                      type="button"
                      onClick={copyAllTitles}
                      className="text-xs text-primary underline"
                    >
                      {copiedTitleKey === "all-titles" ? "已复制全部" : "复制全部"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => sendChat("给我 10 个标题")}
                    disabled={sending}
                    className="text-xs text-primary underline disabled:opacity-50"
                  >
                    {project.titles.length > 0 ? "重新生成" : "生成标题"}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant/70">
                点击标题应用到当前平台；点右侧复制图标可单独复制到剪贴板（公众号标题需粘贴到后台标题栏）。
              </p>
              {project.titles.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  尚未生成标题备选。点击「生成标题」，或在 AI 协作中发送「给我 10 个标题」。
                </p>
              ) : (
              <div className="mt-3 space-y-2">
                {project.titles.map((title, index) => (
                  <div
                    key={`${title.text}-${index}`}
                    className={`flex items-stretch gap-1 rounded-lg ${
                      title.applied
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-surface-container-low"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => applyTitle(index)}
                      className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-container"
                    >
                      <span className="text-xs text-on-surface-variant">{title.style}</span>
                      <div className="break-words">{title.text}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyTitleAt(index)}
                      title="复制此标题"
                      className="flex shrink-0 items-center px-3 text-on-surface-variant hover:text-primary"
                    >
                      <Icon
                        name={copiedTitleKey === `title-${index}` ? "check" : "content_copy"}
                        className="text-[18px]"
                      />
                    </button>
                  </div>
                ))}
              </div>
              )}
            </div>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
              <h3 className="text-sm font-medium text-on-surface-variant">封面与配图</h3>
              <p className="mt-2 text-xs leading-relaxed text-on-surface-variant/70">
                生成平台内容后会先出现默认占位图。确认正文无误后，在每张占位上「上传图片」或「AI 生成」。
              </p>
              {project.cover_assets.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  生成任意平台内容后会自动创建封面与配图占位。也可在对话中发送「生成封面配图」。
                </p>
              ) : (
                project.cover_assets.map((asset, index) => {
                  const placement = project.platforms.wechat.image_placements?.find(
                    (p) => p.asset_index === (asset.asset_index ?? index),
                  );
                  const placementLabel = placement
                    ? getImagePlacementLabel(placement, asset)
                    : asset.after_paragraph != null && asset.after_paragraph >= 0
                      ? getImagePlacementLabel(
                          { after_paragraph: asset.after_paragraph, asset_index: index, caption: asset.caption || "" },
                          asset,
                        )
                      : index === 0
                        ? "封面候选"
                        : "正文配图";
                  const isCover = isWechatCoverAsset(
                    asset,
                    index,
                    project.platforms.wechat.image_placements,
                  );
                  return (
                    <CoverAssetSlot
                      key={asset.id}
                      projectId={project.id}
                      asset={asset}
                      index={index}
                      placementLabel={placementLabel}
                      isCover={isCover}
                      onUpdate={(saved) => setProject(saved)}
                    />
                  );
                })
              )}
            </div>

            {editorTab === "wechat" && wechatChecks.length > 0 && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
                <h3 className="text-sm font-medium text-on-surface-variant">发布前校验</h3>
                <ul className="mt-3 space-y-2">
                  {wechatChecks.map((check) => (
                    <li
                      key={check.message}
                      className={`text-sm ${
                        check.level === "warn"
                          ? "text-amber-800"
                          : check.level === "error"
                            ? "text-error"
                            : "text-on-surface-variant"
                      }`}
                    >
                      {check.level === "warn" ? "⚠ " : check.level === "info" ? "· " : ""}
                      {check.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
              <PreviewPanel
                project={project}
                platform={editorTab === "draft" ? previewPlatform : (editorTab as Platform)}
                onProjectUpdate={setProject}
              />
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
