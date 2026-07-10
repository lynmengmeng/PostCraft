"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ContentEditor, type EditorTab } from "@/components/studio/ContentEditor";
import { ChatComposer, type ChatScope } from "@/components/studio/ChatComposer";
import { ChatMessageList } from "@/components/studio/ChatMessageList";
import { ChatSummaryExpandable } from "@/components/studio/ChatSummaryExpandable";
import { CascadeBanner } from "@/components/studio/CascadeBanner";
import { DraftReadyPanel } from "@/components/studio/DraftReadyPanel";
import { PreviewPlatformTabs } from "@/components/studio/PreviewPlatformTabs";
import { QuickCommandsPopover } from "@/components/studio/QuickCommandsPopover";
import { StudioHeaderActions } from "@/components/studio/StudioHeaderActions";
import { StudioMobileTabs } from "@/components/studio/StudioMobileTabs";
import { StudioTitleEditor } from "@/components/studio/StudioTitleEditor";
import { CategoryPicker } from "@/components/content/CategoryPicker";
import { ProjectSourceBadges } from "@/components/content/ProjectSourceBadges";
import { TrendAnalysisPanel } from "@/components/tools/TrendAnalysisPanel";
import { useContentCategories } from "@/hooks/useContentCategories";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import {
  PreviewPanel,
  getPlatformCopyText,
} from "@/components/preview/PlatformPreview";
import { Icon } from "@/components/ui/Icon";
import { ResizableColumns } from "@/components/ui/ResizableColumns";
import { api, platformLabels, type ChatOptions } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { trackEvent } from "@/lib/metrics";
import { XiaohongshuCarouselPanel } from "@/components/studio/XiaohongshuCarouselPanel";
import { WechatCoverAssetsPanel } from "@/components/studio/WechatCoverAssetsPanel";
import {
  exportAllPlatforms,
  downloadDraftBundle,
  exportWechatHtml,
  resolveImageUrl,
  validateWechatContent,
} from "@/lib/export";
import {
  ALL_PLATFORMS,
  appendStreamingDelta,
  getChatContextPlatform,
  hasDraft,
  hasLaterChatMessages,
  hasPlatformContent,
  platformIcons,
  type MobileStudioPanel,
  type StudioViewMode,
} from "@/lib/studio-utils";
import type { ChatMessage, ContentProject, Platform } from "@/lib/types";
import { copyWechatRichHtml } from "@/lib/wechat-html";
import { scoreWechatTitle } from "@/lib/wechat-title-score";

const HEALTH_DISCLAIMER =
  "以上仅为个人观察与生活记录，不构成医疗建议。如有健康问题，请咨询专业医生。";

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

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

export default function CreateStudioPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { config } = useAuth();
  const standaloneViewport = config?.auth_required === false;
  const autoStarted = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const [project, setProject] = useState<ContentProject | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("draft");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedTitleKey, setCopiedTitleKey] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<"rich" | "markdown">("rich");
  const [viewMode, setViewMode] = useState<StudioViewMode>("split");
  const [mobilePanel, setMobilePanel] = useState<MobileStudioPanel>("chat");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [cascadePrompt, setCascadePrompt] = useState(false);
  const [cascading, setCascading] = useState(false);
  const [exportingDraft, setExportingDraft] = useState(false);
  const [generatingXhsCarousel, setGeneratingXhsCarousel] = useState(false);
  const [actionInfo, setActionInfo] = useState("");
  const [autoDraftPending, setAutoDraftPending] = useState(false);
  const { categories, findByName } = useContentCategories();
  const { data: styleProfile } = useBackendQuery(() => api.getStyleProfile(), []);
  const [chatScope, setChatScope] = useState<ChatScope>("auto");

  const sortedTitleEntries = useMemo(() => {
    if (!project?.titles.length) return [];
    return project.titles
      .map((title, index) => ({ title, index }))
      .sort(
        (a, b) =>
          scoreWechatTitle(b.title.text).score - scoreWechatTitle(a.title.text).score,
      );
  }, [project?.titles]);

  const selectEditorTab = useCallback((tab: EditorTab) => {
    setEditorTab(tab);
  }, []);

  function beginAbortableRequest() {
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    return controller.signal;
  }

  function stopChat() {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setSending(false);
    setCascading(false);
    setRegeneratingId(null);
    setStreamingText("");
    setAutoDraftPending(false);
    setActionInfo("已停止生成");
    setTimeout(() => setActionInfo(""), 3000);
  }

  function handleSaveError(message: string) {
    setSaveError(message);
    setTimeout(() => setSaveError(""), 4000);
  }

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
          setAutoDraftPending(true);
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

    const signal = beginAbortableRequest();
    const chatPlatform =
      chatScope === "auto"
        ? getChatContextPlatform(editorTab, current)
        : chatScope === "all"
          ? "wechat"
          : chatScope;
    const scopeTargets =
      chatScope === "all"
        ? (["wechat", "xiaohongshu", "douyin"] as Platform[])
        : chatScope !== "auto"
          ? [chatScope]
          : options?.target_platforms;

    setProject({ ...current, chat_history: [...historyBefore, optimisticUser] });
    setChatMessage("");
    setPendingAttachments([]);
    setSending(true);
    setError("");
    setStreamingText("");

    try {
      const result = await api.chat(
        current.id,
        text.trim() ||
          (attachmentUrls.length > 0 ? "请处理我上传的配图素材，插入公众号合适位置" : ""),
        chatPlatform,
        true,
        (delta) => {
          setStreamingText((prev) => appendStreamingDelta(prev, delta));
        },
        {
          ...options,
          ...(scopeTargets?.length ? { target_platforms: scopeTargets } : {}),
          ...(attachmentUrls.length ? { attachment_urls: attachmentUrls } : {}),
          signal,
        },
      );
      setProject(result.project);
      setStreamingText("");
      setAutoDraftPending(false);
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
      if (isAbortError(err)) return false;
      setProject({ ...current, chat_history: historyBefore });
      if (text.trim()) setChatMessage(text);
      setError(err instanceof Error ? err.message : "发送失败");
      setStreamingText("");
      setAutoDraftPending(false);
      return false;
    } finally {
      setSending(false);
      chatAbortRef.current = null;
    }
  }

  async function regenerateAssistantMessage(assistantMessageId: string) {
    if (!project || sending || regeneratingId) return;
    if (
      hasLaterChatMessages(project.chat_history, assistantMessageId) &&
      !window.confirm("重新生成将删除此条回复之后的所有对话记录，是否继续？")
    ) {
      return;
    }
    const signal = beginAbortableRequest();
    const chatPlatform = getChatContextPlatform(editorTab, project);
    setRegeneratingId(assistantMessageId);
    setSending(true);
    setError("");
    setStreamingText("");
    try {
      const result = await api.regenerateChat(
        project.id,
        assistantMessageId,
        chatPlatform,
        true,
        (delta) => {
          setStreamingText((prev) => appendStreamingDelta(prev, delta));
        },
        signal,
      );
      setProject(result.project);
      setStreamingText("");
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : "重新生成失败");
      }
      setStreamingText("");
    } finally {
      setSending(false);
      setRegeneratingId(null);
      chatAbortRef.current = null;
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
    const signal = beginAbortableRequest();
    setCascading(true);
    setSending(true);
    setError("");
    setStreamingText("");
    try {
      const result = await api.cascadePlatforms(
        project.id,
        targets,
        true,
        (delta) => {
          setStreamingText((prev) => appendStreamingDelta(prev, delta));
        },
        signal,
      );
      setProject(result.project);
      setCascadePrompt(false);
      setStreamingText("");
      trackEvent("cascade_platforms", { projectId: project.id, platforms: targets });
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : "同步失败");
      }
      setStreamingText("");
    } finally {
      setCascading(false);
      setSending(false);
      chatAbortRef.current = null;
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
    const platform = getChatContextPlatform(editorTab, project);
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
      selectEditorTab("wechat");
      return;
    }
    await sendChat("", project, {
      action: "generate_platform",
      target_platforms: [target],
    });
    selectEditorTab(target);
  }

  async function runFactCheck() {
    if (!project) return;
    const result = await api.factCheck(project.id);
    setProject({ ...project, risk_warnings: result.warnings });
  }

  async function applyTitle(index: number) {
    if (!project) return;
    const platform = getChatContextPlatform(editorTab, project);
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
    const version = project.versions?.find((v) => v.id === versionId);
    if (!window.confirm("恢复后将覆盖当前内容，是否继续？")) return;
    const updated = await api.restoreVersion(project.id, versionId);
    setProject(updated);
    setActionInfo(`已恢复到：${version?.label ?? "历史版本"}`);
    setTimeout(() => setActionInfo(""), 4000);
  }

  async function markReady() {
    if (!project || project.status === "ready") return;
    const updated = await api.updateProject(project.id, { status: "ready" });
    setProject(updated);
    setActionInfo("已标记待发布，可在草稿箱查看");
    setTimeout(() => setActionInfo(""), 4000);
    trackEvent("project_ready", {
      projectId: project.id,
      rounds: project.chat_history.filter((m) => m.role === "user").length,
    });
  }

  async function saveProjectTitle(title: string) {
    if (!project) return;
    try {
      const updated = await api.updateProject(project.id, { title });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "标题保存失败");
      throw err;
    }
  }

  async function saveProjectCategory(content_pillar: string) {
    if (!project) return;
    const previous = project.content_pillar ?? "";
    if (content_pillar === previous) return;
    const hadDraft = Boolean(project.draft?.trim() || project.humanized?.trim());
    let regenerate = false;
    if (hadDraft && content_pillar) {
      regenerate = window.confirm(
        `切换为「${content_pillar}」栏目。\n\n确定 = 按新栏目重写初稿\n取消 = 仅更新栏目标签`,
      );
    }
    try {
      const updated = await api.updateProject(project.id, { content_pillar });
      setProject(updated);
      const cat = findByName(content_pillar);
      const hasPositioning = Boolean(styleProfile?.account_positioning?.trim());
      if (cat?.title_style?.includes("情绪") && hasPositioning) {
        setActionInfo("该栏目偏情绪标题，冷启动期可优先用搜一搜友好标题");
        setTimeout(() => setActionInfo(""), 5000);
      }
      if (regenerate) {
        await sendChat("按新栏目重写观察型初稿", updated, { action: "generate_draft" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "分类保存失败");
    }
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
      const activePlatform = editorTab === "draft" ? null : editorTab;
      if (activePlatform === "wechat" || (editorTab === "draft" && hasPlatformContent(project, "wechat"))) {
        if (copyMode === "rich" && activePlatform === "wechat") {
          await copyWechatRichHtml(
            project.platforms.wechat,
            project.cover_assets,
            resolveImageUrl,
          );
        } else {
          const platform = activePlatform ?? "wechat";
          await navigator.clipboard.writeText(getPlatformCopyText(project, platform));
        }
      } else {
        const text =
          editorTab === "draft"
            ? project.humanized || project.draft || project.inspiration
            : getPlatformCopyText(project, editorTab);
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

  const chatPanel = (
    <section
      className="custom-shadow notranslate flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest"
      translate="no"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-primary">
          <Icon name="smart_toy" className="text-[18px]" />
          AI 协作
        </span>
      </div>
      {hasDraft(project) && (
        <DraftReadyPanel sending={sending} onGenerate={(t) => void generatePlatform(t)} />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {project.chat_summary && (
          <div className="shrink-0 px-4 pt-4">
            <ChatSummaryExpandable summary={project.chat_summary} />
          </div>
        )}
        <ChatMessageList
          chatHistory={project.chat_history}
          sending={sending}
          streamingText={streamingText}
          regeneratingId={regeneratingId}
          autoDraftPending={autoDraftPending}
          onRegenerate={(id) => void regenerateAssistantMessage(id)}
        />
      </div>
      <div className="shrink-0 space-y-3 border-t border-outline-variant/10 bg-surface-container-lowest p-4">
        <QuickCommandsPopover sending={sending} onSelect={(cmd) => void sendChat(cmd)} />
        <ChatComposer
          message={chatMessage}
          onMessageChange={setChatMessage}
          sending={sending}
          pendingAttachments={pendingAttachments}
          chatScope={chatScope}
          onChatScopeChange={setChatScope}
          onSend={(text) => sendChat(text)}
          onUploadAsset={(file) => void handleChatAssetUpload(file)}
          onRemoveAttachment={(url) =>
            setPendingAttachments((prev) => prev.filter((u) => u !== url))
          }
          onClearAttachments={() => setPendingAttachments([])}
          onStop={stopChat}
        />
        {actionInfo && <p className="text-xs text-primary">{actionInfo}</p>}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    </section>
  );

  const contentPanel = (
    <section className="custom-shadow flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
      <div className="flex shrink-0 border-b border-outline-variant/10 bg-surface-container-low/20">
        <button
          type="button"
          onClick={() => selectEditorTab("draft")}
          className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm transition-all ${
            editorTab === "draft"
              ? "platform-active"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <Icon name="edit_note" className="text-[20px]" />
          初稿
        </button>
        {ALL_PLATFORMS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => selectEditorTab(item)}
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
        {saveError && (
          <p className="mb-3 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
            {saveError}
          </p>
        )}
        <div className="space-y-4">
          <ContentEditor
            project={project}
            editorTab={editorTab}
            onUpdate={setProject}
            onSaveError={handleSaveError}
          />

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
                  onClick={() => sendChat("给我 10 个搜一搜友好标题")}
                  disabled={sending}
                  className="text-xs text-primary underline disabled:opacity-50"
                >
                  搜一搜标题
                </button>
                <button
                  type="button"
                  onClick={() => sendChat("给我 20 个标题")}
                  disabled={sending}
                  className="text-xs text-primary underline disabled:opacity-50"
                >
                  {project.titles.length > 0 ? "重新生成" : "生成标题"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant/70">
              点击标题应用到当前平台；标签「搜索友好」更适合新号冷启动；点右侧复制图标可单独复制。
            </p>
            {project.titles.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                尚未生成标题备选。点击「搜一搜标题」或「生成标题」，或在 AI 协作中发送快捷指令。
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {sortedTitleEntries.map(({ title, index }) => {
                  const { label } = scoreWechatTitle(title.text);
                  const labelClass =
                    label === "搜索友好"
                      ? "bg-primary/15 text-primary"
                      : label === "情绪向"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-on-surface-variant/10 text-on-surface-variant";
                  return (
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-on-surface-variant">{title.style}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${labelClass}`}>
                          {label}
                        </span>
                      </div>
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
                  );
                })}
              </div>
            )}
          </div>

          {editorTab === "xiaohongshu" && (
            <XiaohongshuCarouselPanel
              project={project}
              generating={generatingXhsCarousel}
              onGeneratingChange={setGeneratingXhsCarousel}
              onUpdate={(saved) => setProject(saved)}
              onError={setError}
            />
          )}

          {editorTab === "wechat" && (
            <WechatCoverAssetsPanel project={project} onUpdate={(saved) => setProject(saved)} />
          )}

          {editorTab === "draft" && project.cover_assets.length > 0 && (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4 text-sm text-on-surface-variant">
              切换到「公众号」或「小红书」Tab 管理对应平台的配图。
            </div>
          )}

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
  );

  const previewPanel = (
    <section className="custom-shadow flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
      <PreviewPlatformTabs
        editorTab={editorTab}
        project={project}
        onSelectTab={selectEditorTab}
      />
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        {editorTab === "draft" ? (
          <div className="prose prose-stone max-w-none whitespace-pre-wrap text-[15px] leading-8 text-on-surface">
            {project.humanized || project.draft || "初稿生成后将显示在这里。"}
          </div>
        ) : (
          <PreviewPanel
            project={project}
            platform={editorTab}
            onProjectUpdate={setProject}
          />
        )}
      </div>
    </section>
  );

  const desktopColumns = (
    <ResizableColumns
      persistKey={`postcraft:studio-ratios:${viewMode}`}
      panels={[
        {
          id: "chat",
          defaultPercent: 25,
          minPercent: 12,
          content: chatPanel,
        },
        {
          id: "content",
          defaultPercent: viewMode === "edit" ? 75 : (4 / 12) * 100,
          minPercent: 12,
          hidden: viewMode === "preview",
          content: contentPanel,
        },
        {
          id: "preview",
          defaultPercent: viewMode === "preview" ? 75 : (5 / 12) * 100,
          minPercent: 12,
          hidden: viewMode === "edit",
          content: previewPanel,
        },
      ]}
    />
  );

  const mobilePanels: Record<MobileStudioPanel, ReactNode> = {
    chat: chatPanel,
    edit: contentPanel,
    preview: previewPanel,
  };

  const activeCategory = categories.find((c) => c.name === (project?.content_pillar ?? ""));

  return (
    <div
      className={`flex flex-col overflow-hidden bg-background ${
        standaloneViewport ? "h-dvh" : "min-h-0 flex-1"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface/80 px-gutter py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/workspace")}
            className="flex shrink-0 items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            返回
          </button>
          <div className="min-w-0">
            <StudioTitleEditor title={project.title} onSave={saveProjectTitle} />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CategoryPicker
                categories={categories}
                value={project.content_pillar ?? ""}
                onChange={(name) => void saveProjectCategory(name)}
                size="sm"
                showHint
              />
              <ProjectSourceBadges project={project} />
              <p className="truncate text-xs text-on-surface-variant">
                {project.inspiration.slice(0, 60)}
              </p>
            </div>
            {(project.source_url || project.image_url) && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                {project.source_url && (
                  <a
                    href={project.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Icon name="link" className="text-[14px]" />
                    参考链接
                  </a>
                )}
                {project.image_url && (
                  <a
                    href={resolveImageUrl(project.image_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Icon name="image" className="text-[14px]" />
                    参考截图
                  </a>
                )}
              </div>
            )}
            {project.trend_snapshot?.analysis?.why_hot && (
              <details className="mt-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-on-surface-variant">
                <summary className="cursor-pointer font-semibold text-primary">热点分析背景</summary>
                <div className="mt-2">
                  <TrendAnalysisPanel analysis={project.trend_snapshot.analysis} compactHeader />
                </div>
              </details>
            )}
            {activeCategory &&
              (activeCategory.platform_hints.wechat ||
                activeCategory.platform_hints.xiaohongshu ||
                activeCategory.platform_hints.douyin) && (
                <details className="mt-1 text-xs text-on-surface-variant/70">
                  <summary className="cursor-pointer text-primary/80">三平台风格差异</summary>
                  <ul className="mt-1 space-y-0.5 pl-2">
                    {activeCategory.platform_hints.wechat && (
                      <li>公众号：{activeCategory.platform_hints.wechat}</li>
                    )}
                    {activeCategory.platform_hints.xiaohongshu && (
                      <li>小红书：{activeCategory.platform_hints.xiaohongshu}</li>
                    )}
                    {activeCategory.platform_hints.douyin && (
                      <li>抖音：{activeCategory.platform_hints.douyin}</li>
                    )}
                  </ul>
                </details>
              )}
          </div>
        </div>
        <StudioHeaderActions
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          editorTab={editorTab}
          project={project}
          copied={copied}
          copiedTitleKey={copiedTitleKey}
          copyMode={copyMode}
          onCopyModeChange={setCopyMode}
          exportingDraft={exportingDraft}
          onCopyPlatform={() => void copyCurrentPlatform()}
          onCopyWechatTitle={() => void copyCurrentWechatTitle()}
          onExportWechatHtml={() => exportWechatHtml(project)}
          onExportDraftBundle={() => void exportDraftBundle()}
          onExportAll={() => exportAllPlatforms(project)}
          onMarkReady={() => void markReady()}
        />
      </header>

      {cascadePrompt && hasDraft(project) && (
        <CascadeBanner
          project={project}
          cascading={cascading}
          sending={sending}
          onDismiss={() => setCascadePrompt(false)}
          onCascadeAll={() =>
            void cascadeToPlatforms(ALL_PLATFORMS.filter((p) => hasPlatformContent(project, p)))
          }
          onCascadePlatform={(p) => void cascadeToPlatforms([p])}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-0 md:pb-4 md:p-4">
        <div className="hidden min-h-0 flex-1 md:flex">{desktopColumns}</div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          {mobilePanels[mobilePanel]}
        </div>
      </div>

      <StudioMobileTabs value={mobilePanel} onChange={setMobilePanel} />
    </div>
  );
}
