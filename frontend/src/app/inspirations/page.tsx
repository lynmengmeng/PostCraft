"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import type { Inspiration } from "@/lib/types";

const sourceLabels: Record<Inspiration["source_type"], string> = {
  manual: "手动录入",
  screenshot: "截图",
  link: "网页剪藏",
};

type SortKey = "newest" | "oldest";
type CreateMode = "manual" | "screenshot" | "link";

function parseTagsInput(input: string): string[] {
  return input
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatCardDate(dateStr: string) {
  const d = new Date(dateStr);
  return d
    .toLocaleString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .toUpperCase();
}

export default function InspirationsPage() {
  const router = useRouter();
  const { searchQuery } = useShell();
  const formRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { data: items, error, loading, reload } = useBackendQuery(
    () => api.listInspirations(),
    [],
  );
  const [createMode, setCreateMode] = useState<CreateMode>("manual");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [actionError, setActionError] = useState("");
  const [actionInfo, setActionInfo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<string | null>(null);

  const sourceCounts = useMemo(() => {
    const counts: Record<Inspiration["source_type"], number> = {
      manual: 0,
      screenshot: 0,
      link: 0,
    };
    (items ?? []).forEach((item) => {
      counts[item.source_type] += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.content.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          (item.source_url ?? "").toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortKey === "newest" ? diff : -diff;
    });
    return list;
  }, [items, searchQuery, sortKey]);

  const recentItems = useMemo(
    () =>
      [...(items ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3),
    [items],
  );

  async function createItem() {
    setActionError("");
    setActionInfo("");
    setSubmitting(true);
    try {
      const tags = parseTagsInput(tagsInput);
      if (createMode === "screenshot") {
        if (!screenshotFile) {
          setActionError("请选择截图文件");
          return;
        }
        await api.uploadInspirationScreenshot(screenshotFile, content.trim(), tags);
        setScreenshotFile(null);
      } else if (createMode === "link") {
        if (!linkUrl.trim()) {
          setActionError("请输入链接地址");
          return;
        }
        await api.createInspirationFromLink(linkUrl.trim(), content.trim(), tags);
        setLinkUrl("");
      } else {
        if (!content.trim()) {
          setActionError("请输入灵感内容");
          return;
        }
        await api.createInspiration(content.trim(), tags);
      }
      setContent("");
      setTagsInput("");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    setActionError("");
    setActionInfo("");
    try {
      const data = await api.exportInspirations();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `postcraft-inspirations-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setActionInfo(`已导出 ${data.items.length} 条灵感`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "导出失败");
    }
  }

  async function handleImport(file: File) {
    setActionError("");
    setActionInfo("");
    try {
      const parsed = JSON.parse(await file.text()) as {
        items?: Array<{ content: string; tags?: string[]; source_type?: Inspiration["source_type"] }>;
      };
      const itemsToImport = parsed.items ?? [];
      if (itemsToImport.length === 0) {
        setActionError("导入文件中没有有效条目");
        return;
      }
      const result = await api.importInspirations(itemsToImport);
      await reload();
      setActionInfo(`成功导入 ${result.imported} 条灵感`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "导入失败，请检查 JSON 格式");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  function startEdit(item: Inspiration) {
    setEditingId(item.id);
    setEditContent(item.content);
    setEditTagsInput(item.tags.join(", "));
    setActionError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent("");
    setEditTagsInput("");
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return;
    setActionError("");
    setSavingId(id);
    try {
      await api.updateInspiration(id, {
        content: editContent.trim(),
        tags: parseTagsInput(editTagsInput),
      });
      cancelEdit();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleHighlight(item: Inspiration) {
    setActionError("");
    try {
      await api.updateInspiration(item.id, { is_highlight: !item.is_highlight });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新失败");
    }
  }

  async function convertToTopic(id: string) {
    setActionError("");
    setActionInfo("");
    setConvertingId(id);
    try {
      await api.inspirationToTopic(id);
      await reload();
      setActionInfo("已转入选题库");
      setTimeout(() => setActionInfo(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "转换失败");
    } finally {
      setConvertingId(null);
    }
  }

  async function startWriting(id: string) {
    setActionError("");
    setWritingId(id);
    try {
      const project = await api.inspirationToProject(id);
      router.push(`/create/${project.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "进入创作室失败");
    } finally {
      setWritingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除这条灵感吗？")) return;
    setActionError("");
    try {
      await api.deleteInspiration(id);
      if (editingId === id) cancelEdit();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCardActions(item: Inspiration) {
    return (
      <div className="flex gap-1">
        {editingId !== item.id && (
          <>
            <button
              type="button"
              onClick={() => toggleHighlight(item)}
              title={item.is_highlight ? "取消高亮" : "标记高亮"}
              className={`rounded-lg p-1.5 transition-colors ${
                item.is_highlight
                  ? "text-primary hover:bg-primary/10"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <Icon name="star" className="text-[18px]" filled={item.is_highlight} />
            </button>
            <button
              type="button"
              onClick={() => startEdit(item)}
              title="编辑"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <Icon name="edit" className="text-[18px]" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => remove(item.id)}
          title="删除"
          className="rounded-lg p-1.5 text-error transition-colors hover:bg-error-container"
        >
          <Icon name="delete" className="text-[18px]" />
        </button>
      </div>
    );
  }

  function renderCardPreview(item: Inspiration) {
    return (
      <>
        <p
          className={`long-text-wrap font-headline leading-relaxed text-on-surface ${
            item.is_highlight
              ? "text-[24px] font-semibold italic text-primary"
              : "text-[22px] font-medium"
          }`}
        >
          {item.content}
        </p>
        <div className="mb-4" />
      </>
    );
  }

  function renderCardButtons(item: Inspiration, isHighlight = false) {
    const isConverting = convertingId === item.id;
    const isWriting = writingId === item.id;
    const busy = isConverting || isWriting;

    return (
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => convertToTopic(item.id)}
            disabled={busy}
            className={`flex-1 rounded-lg border py-2.5 text-[12px] font-bold transition-all hover:opacity-90 disabled:opacity-50 ${
              isHighlight
                ? "border-primary/30 bg-surface text-primary"
                : "border-outline-variant/40 bg-surface text-on-surface"
            }`}
          >
            {isConverting ? "保存中..." : "一键转选题"}
          </button>
          <button
            type="button"
            onClick={() => startWriting(item.id)}
            disabled={busy}
            className={`flex-1 rounded-lg py-2.5 text-[12px] font-bold transition-all hover:opacity-90 disabled:opacity-50 ${
              isHighlight
                ? "bg-primary text-on-primary"
                : "bg-inverse-surface text-inverse-on-surface"
            }`}
          >
            {isWriting ? "进入中..." : "转选题并开写"}
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant/60">
          「转选题并开写」会自动建选题、进入创作室，并从灵感库移除该条。
        </p>
      </div>
    );
  }

  function renderCardFooter(item: Inspiration) {
    return (
      <div className="mt-auto flex items-center justify-between border-t border-outline-variant/30 pt-6">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {formatCardDate(item.created_at)}
        </span>
        {item.tags.length > 0 && (
          <span className="rounded-full bg-primary/5 px-3 py-1 text-[12px] font-bold text-primary">
            #{item.tags[0]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <div className="custom-scrollbar flex-1 overflow-y-auto p-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-headline text-[40px] leading-tight text-on-surface">灵感库</h2>
              <p className="mt-2 text-[17px] text-on-surface-variant/80">
                收集观察，为后续选题提供原料。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSortKey((prev) => (prev === "newest" ? "oldest" : "newest"))}
              className="flex items-center gap-2 rounded-xl border border-outline px-5 py-2.5 text-on-surface-variant transition-all hover:bg-surface-container-low"
            >
              <Icon name="tune" className="text-[20px]" />
              <span className="text-[13px] font-semibold">
                {sortKey === "newest" ? "最新优先" : "最早优先"}
              </span>
            </button>
          </header>

          <div
            ref={formRef}
            className="mb-12 rounded-xl border border-outline-variant/40 bg-surface p-8 shadow-sm"
          >
            <div className="mb-6 flex flex-wrap gap-2">
              {(
                [
                  ["manual", "手动记录"],
                  ["screenshot", "上传截图"],
                  ["link", "网页剪藏"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCreateMode(mode)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    createMode === mode
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {createMode === "link" && (
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="粘贴链接，如 https://..."
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-4 text-[15px] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              )}

              {createMode === "screenshot" && (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/50 bg-surface-container-lowest px-6 py-8 transition-colors hover:border-primary/40">
                  <Icon name="image" className="mb-2 text-[32px] text-on-surface-variant" />
                  <span className="text-sm text-on-surface-variant">
                    {screenshotFile ? screenshotFile.name : "点击选择截图（JPEG/PNG/WebP，最大 5MB）"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  createMode === "manual"
                    ? "记录灵感..."
                    : createMode === "screenshot"
                      ? "补充说明（可选）..."
                      : "补充观察笔记（可选）..."
                }
                className="min-h-[120px] w-full resize-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-[15px] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              <div className="relative">
                <Icon
                  name="tag"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
                />
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="标签（逗号分隔，如：社会观察, 农村生活）"
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-4 pl-12 pr-6 text-[15px] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="button"
                onClick={createItem}
                disabled={submitting}
                className="rounded-xl bg-secondary px-10 py-3 text-[13px] font-bold text-on-secondary transition-all hover:shadow-md disabled:opacity-50"
              >
                {submitting ? "保存中..." : "保存灵感"}
              </button>
            </div>
          </div>

          {actionError && (
            <p className="mb-6 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-error">
              {actionError}
            </p>
          )}
          {actionInfo && (
            <p className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              {actionInfo}
            </p>
          )}

          {error ? (
            <LoadError message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <p className="text-sm text-on-surface-variant/50">加载中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-on-surface-variant/50">暂无灵感，在上方记录第一条吧。</p>
          ) : (
            <div className="masonry-grid">
              {filtered.map((item) => {
                const isHighlight = item.is_highlight;
                const cardClass = isHighlight
                  ? "snippet-card flex flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low p-8 shadow-sm"
                  : item.source_type === "screenshot" && item.image_url
                    ? "snippet-card flex flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface shadow-sm"
                    : "snippet-card flex min-w-0 flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface p-8 shadow-sm";

                if (item.source_type === "screenshot" && item.image_url && editingId !== item.id) {
                  return (
                    <div key={item.id} className={cardClass}>
                      <div className="group relative h-56 overflow-hidden">
                        <img
                          src={resolveImageUrl(item.image_url)}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <span className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                          {sourceLabels.screenshot}
                        </span>
                        <div className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100">
                          {renderCardActions(item)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-8">
                        <p className="long-text-wrap mb-6 line-clamp-3 text-[15px] leading-relaxed text-on-surface-variant">
                          {item.content}
                        </p>
                        {renderCardButtons(item)}
                        {renderCardFooter(item)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className={cardClass}>
                    <div className="mb-6 flex items-start justify-between">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                          isHighlight
                            ? "bg-primary/10 text-primary"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {isHighlight ? "高亮" : sourceLabels[item.source_type]}
                      </span>
                      {renderCardActions(item)}
                    </div>

                    {editingId === item.id ? (
                      <div className="mb-6 space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[120px] w-full resize-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <input
                          value={editTagsInput}
                          onChange={(e) => setEditTagsInput(e.target.value)}
                          placeholder="标签（逗号分隔）"
                          className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2.5 text-sm outline-none focus:border-primary"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(item.id)}
                            disabled={savingId === item.id || !editContent.trim()}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
                          >
                            {savingId === item.id ? "保存中..." : "保存"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingId === item.id}
                            className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface-variant"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {item.source_type === "link" && item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="long-text-wrap mb-3 block text-xs text-primary hover:underline"
                          >
                            {item.source_url}
                          </a>
                        )}
                        {renderCardPreview(item)}
                      </>
                    )}

                    {editingId !== item.id && (
                      <>
                        {renderCardButtons(item, isHighlight)}
                        {renderCardFooter(item)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col gap-10 border-l border-outline-variant/50 bg-surface p-8 2xl:flex">
        <div>
          <h3 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            最近浏览
          </h3>
          <div className="space-y-3">
            {recentItems.length === 0 ? (
              <p className="text-sm text-on-surface-variant/50">暂无记录</p>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex cursor-pointer items-center gap-4 rounded-xl p-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container transition-transform group-hover:scale-105">
                    <Icon
                      name={item.source_type === "screenshot" ? "image" : "format_quote"}
                      className="text-[20px]"
                    />
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p className="truncate text-[13px] font-bold">{item.content.slice(0, 28)}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                      {formatCardDate(item.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-outline-variant/40 pt-10">
          <h3 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            库容量概览
          </h3>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6">
            <div className="mb-3 flex justify-between text-[12px] font-semibold">
              <span>条目</span>
              <span className="text-on-surface-variant">{items?.length ?? 0} 条</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(((items?.length ?? 0) / 50) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-on-surface-variant/80">
              手动 {sourceCounts.manual} · 截图 {sourceCounts.screenshot} · 剪藏{" "}
              {sourceCounts.link}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-outline-variant/40 pt-10">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant py-3 text-[13px] font-semibold text-on-surface-variant transition-all hover:bg-surface-container"
          >
            <Icon name="cloud_upload" className="text-[20px]" />
            导入灵感库
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant py-3 text-[13px] font-semibold text-on-surface-variant transition-all hover:bg-surface-container"
          >
            <Icon name="download" className="text-[20px]" />
            导出归档
          </button>
        </div>
      </aside>

      <button
        type="button"
        onClick={scrollToForm}
        title="新建灵感"
        className="group fixed bottom-10 right-10 z-[100] flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-all hover:scale-105 active:scale-95"
      >
        <Icon name="add" className="text-[32px]" />
        <span className="pointer-events-none absolute right-20 whitespace-nowrap rounded-xl bg-inverse-surface px-4 py-2 text-sm font-bold text-inverse-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          新建灵感
        </span>
      </button>
    </div>
  );
}
