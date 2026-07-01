"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ContentEditor } from "@/components/studio/ContentEditor";
import {
  PreviewPanel,
  getPlatformCopyText,
} from "@/components/preview/PlatformPreview";
import { api, platformLabels } from "@/lib/api";
import { exportAllPlatforms, resolveImageUrl } from "@/lib/export";
import type { ContentProject, Platform } from "@/lib/types";

type StudioViewMode = "split" | "preview" | "edit";

const quickCommands = [
  "基于这个选题，生成三个平台初稿",
  "给我 10 个标题",
  "更温和一点",
  "去掉说教感",
  "加个人经历，少堆数据",
  "检查敏感表述",
  "生成封面提示词",
  "撤销上一版",
];

export default function CreateStudioPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const autoStarted = useRef(false);
  const [project, setProject] = useState<ContentProject | null>(null);
  const [platform, setPlatform] = useState<Platform>("wechat");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingLines, setStreamingLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<StudioViewMode>("split");

  const chatCol = "col-span-3";
  const contentCol =
    viewMode === "preview" ? "hidden" : viewMode === "edit" ? "col-span-9" : "col-span-4";
  const previewCol =
    viewMode === "edit" ? "hidden" : viewMode === "preview" ? "col-span-9" : "col-span-5";

  useEffect(() => {
    api
      .getProject(params.projectId)
      .then(async (loaded) => {
        setProject(loaded);
        if (
          !autoStarted.current &&
          loaded.chat_history.length === 0 &&
          !loaded.platforms.wechat.body
        ) {
          autoStarted.current = true;
          await sendChat("基于这个选题，生成三个平台初稿", loaded);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]);

  async function sendChat(text: string, current = project) {
    if (!current || !text.trim() || sending) return;
    setSending(true);
    setError("");
    setStreamingLines([]);
    try {
      const result = await api.chat(current.id, text, platform, true, (delta) => {
        setStreamingLines((prev) => [...prev, delta]);
      });
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

  async function runFactCheck() {
    if (!project) return;
    const result = await api.factCheck(project.id);
    setProject({ ...project, risk_warnings: result.warnings });
  }

  async function applyTitle(index: number) {
    if (!project) return;
    const updated = await api.applyTitle(project.id, index, platform);
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
    await navigator.clipboard.writeText(getPlatformCopyText(project, platform));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return <div className="p-8 text-stone-500">加载创作室...</div>;
  }

  if (!project) {
    return <div className="p-8 text-red-600">{error || "项目不存在"}</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            ← 返回
          </button>
          <div>
            <h1 className="font-semibold">{project.title}</h1>
            <p className="text-xs text-stone-500">{project.inspiration.slice(0, 60)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-stone-200 p-0.5">
            {(
              [
                ["split", "三栏"],
                ["edit", "编辑"],
                ["preview", "预览"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  viewMode === mode ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(Object.keys(platformLabels) as Platform[]).map((item) => (
            <button
              key={item}
              onClick={() => setPlatform(item)}
              className={`rounded-full px-3 py-1 text-sm ${
                platform === item ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >
              {platformLabels[item]}
            </button>
          ))}
          <button
            onClick={markReady}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
          >
            标记待发布
          </button>
          <button
            onClick={() => exportAllPlatforms(project)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
          >
            导出全部
          </button>
          <button
            onClick={copyCurrentPlatform}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white"
          >
            {copied ? "已复制" : "复制当前平台"}
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-12 gap-0 overflow-hidden">
        <section className={`${chatCol} flex flex-col border-r border-stone-200 bg-white`}>
          <div className="border-b border-stone-100 px-4 py-3 text-sm font-medium">
            对话区
            {project.chat_summary && (
              <p className="mt-1 text-xs font-normal text-stone-400 line-clamp-2" title={project.chat_summary}>
                摘要已压缩较早对话
              </p>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {project.chat_history.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl px-3 py-2 text-sm ${
                  item.role === "user"
                    ? "ml-8 bg-amber-50 text-stone-800"
                    : "mr-8 bg-stone-100 text-stone-700"
                }`}
              >
                {item.content}
              </div>
            ))}
            {streamingLines.length > 0 && (
              <div className="mr-8 rounded-2xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
                {streamingLines.map((line, i) => (
                  <div key={`${line}-${i}`}>{line}</div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-stone-100 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickCommands.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => sendChat(cmd)}
                  disabled={sending}
                  className="rounded-full border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
                >
                  {cmd}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat(message)}
                placeholder="例如：公众号开头改成回农村的经历"
                className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <button
                onClick={() => sendChat(message)}
                disabled={sending}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {sending ? "处理中" : "发送"}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </section>

        <section className={`${contentCol} overflow-y-auto border-r border-stone-200 bg-stone-50 p-4`}>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">内容区</span>
            {viewMode === "edit" && (
              <span className="text-xs text-stone-400">编辑模式 · 修改后自动保存并扫描风险</span>
            )}
          </div>
          <div className="space-y-4">
            <ContentEditor project={project} platform={platform} onUpdate={setProject} />

            {(project.risk_warnings || []).length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-amber-800">表述风险提示</h3>
                  <button onClick={runFactCheck} className="text-xs text-amber-700 underline">
                    重新扫描
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(project.risk_warnings || []).map((warning) => (
                    <div key={`${warning.phrase}-${warning.suggestion}`} className="text-sm">
                      <span className="font-medium text-amber-900">「{warning.phrase}」</span>
                      <span className="text-amber-700"> — {warning.suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-400">编辑或 AI 修改后会自动扫描表述风险</p>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-stone-500">标题备选</h3>
                <button onClick={runFactCheck} className="text-xs text-stone-500 underline">
                  检查敏感表述
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {project.titles.map((title, index) => (
                  <button
                    key={`${title.text}-${index}`}
                    onClick={() => applyTitle(index)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                      title.applied ? "bg-amber-100 ring-1 ring-amber-300" : "bg-stone-50 hover:bg-stone-100"
                    }`}
                  >
                    <span className="text-xs text-stone-400">{title.style}</span>
                    <div>{title.text}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-stone-500">封面与配图</h3>
              {project.cover_assets.map((asset) => (
                <div key={asset.id} className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
                  {asset.image_url && (
                    <img
                      src={resolveImageUrl(asset.image_url)}
                      alt={asset.headline}
                      className="mb-2 aspect-[3/4] w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="font-medium">{asset.headline}</div>
                  <div className="text-stone-500">{asset.subheadline}</div>
                  <div className="mt-2 text-xs text-stone-400">{asset.prompt}</div>
                </div>
              ))}
              {project.platforms.xiaohongshu.cover_image && (
                <p className="mt-2 text-xs text-stone-400">
                  当前小红书封面已设置，可在编辑区上传替换
                </p>
              )}
            </div>

            {(project.versions || []).length > 0 && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="text-sm font-medium text-stone-500">版本历史</h3>
                <div className="mt-3 space-y-2">
                  {[...(project.versions || [])].reverse().slice(0, 6).map((version) => (
                    <button
                      key={version.id}
                      onClick={() => restoreVersion(version.id)}
                      className="block w-full rounded-lg bg-stone-50 px-3 py-2 text-left text-sm hover:bg-stone-100"
                    >
                      <div>{version.label}</div>
                      <div className="text-xs text-stone-400">
                        {new Date(version.created_at).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={`${previewCol} overflow-y-auto p-4`}>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">预览区 · {platformLabels[platform]}</span>
            <span className="text-xs text-stone-400">近似预览，复制后可在平台微调</span>
          </div>
          <PreviewPanel project={project} platform={platform} />
        </section>
      </div>
    </div>
  );
}
