"use client";

import { Icon } from "@/components/ui/Icon";
import { TrendAnalysisPanel } from "@/components/tools/TrendAnalysisPanel";
import type { TrendInspirationSnapshot } from "@/lib/types";

interface TrendAnalysisDetailModalProps {
  snapshot: TrendInspirationSnapshot;
  onClose: () => void;
}

export function TrendAnalysisDetailModal({ snapshot, onClose }: TrendAnalysisDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trend-detail-title"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">热点分析详情</p>
            <h2 id="trend-detail-title" className="mt-1 font-headline text-lg font-semibold text-on-surface">
              {snapshot.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="关闭"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        <div className="custom-scrollbar overflow-y-auto p-5">
          <TrendAnalysisPanel
            analysis={snapshot.analysis}
            trendTitle={snapshot.title}
            trendSourceLabel={snapshot.source_label}
            trendSummary={snapshot.summary}
          />
          {snapshot.url && (
            <a
              href={snapshot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="long-text-wrap mt-4 block text-xs text-primary hover:underline"
            >
              {snapshot.url}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
