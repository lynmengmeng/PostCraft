"use client";

import { Icon } from "@/components/ui/Icon";
import { TrendAnalysisPanel } from "@/components/tools/TrendAnalysisPanel";
import type { TrendInspirationSnapshot } from "@/lib/types";

export interface TrendAnalysisModalContext {
  inspirationId?: string;
  inspirationContent?: string;
  inspirationTags?: string[];
  topicId?: string;
}

interface TrendAnalysisDetailModalProps {
  snapshot: TrendInspirationSnapshot;
  onClose: () => void;
  context?: TrendAnalysisModalContext;
  busyAction?: string | null;
  onConvertToTopic?: () => void | Promise<void>;
  onStartWriting?: (idea?: string) => void | Promise<void>;
  onEnterStudio?: () => void | Promise<void>;
}

export function TrendAnalysisDetailModal({
  snapshot,
  onClose,
  context,
  busyAction = null,
  onConvertToTopic,
  onStartWriting,
  onEnterStudio,
}: TrendAnalysisDetailModalProps) {
  const hasActions = Boolean(onConvertToTopic || onStartWriting || onEnterStudio);
  const showInspirationNote =
    context?.inspirationContent &&
    context.inspirationContent.trim() !== snapshot.title.trim() &&
    !context.inspirationContent.includes(snapshot.title.slice(0, 20));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trend-detail-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">热点分析详情</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {snapshot.source_label && (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  {snapshot.source_label}
                </span>
              )}
              {context?.inspirationTags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h2
              id="trend-detail-title"
              className="mt-2 font-headline text-xl font-semibold leading-snug text-on-surface"
            >
              {snapshot.title}
            </h2>
            {snapshot.summary && (
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{snapshot.summary}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="关闭"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {showInspirationNote && (
            <div className="mb-4 rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                灵感备注
              </p>
              <p className="long-text-wrap mt-1 text-xs leading-relaxed text-on-surface-variant">
                {context?.inspirationContent}
              </p>
            </div>
          )}

          <TrendAnalysisPanel
            analysis={snapshot.analysis}
            compactHeader
            busyAction={busyAction}
            onWriteWithIdea={onStartWriting ? (idea) => void onStartWriting(idea) : undefined}
          />
        </div>

        <div className="shrink-0 border-t border-outline-variant/30 bg-surface-container-low/30 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {snapshot.url && (
              <a
                href={snapshot.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:border-primary/30 hover:text-primary"
              >
                <Icon name="open_in_new" className="text-[16px]" />
                打开原文
              </a>
            )}
            {onConvertToTopic && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void onConvertToTopic()}
                className="inline-flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs font-medium disabled:opacity-50"
              >
                <Icon name="topic" className="text-[16px]" />
                {busyAction === "topic" ? "处理中..." : "一键转选题"}
              </button>
            )}
            {onStartWriting && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void onStartWriting()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50 sm:flex-none"
              >
                <Icon name="edit_note" className="text-[16px]" />
                {busyAction === "project" ? "创建中..." : "一键开写"}
              </button>
            )}
            {onEnterStudio && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void onEnterStudio()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50 sm:flex-none"
              >
                <Icon name="edit_note" className="text-[16px]" />
                进入创作室
              </button>
            )}
            {!hasActions && !snapshot.url && (
              <p className="text-xs text-on-surface-variant/60">可在热点工具中重新分析以获取更完整建议。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
