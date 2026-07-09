"use client";

import { platformLabels } from "@/lib/api";
import type { Platform, TrendAnalysis } from "@/lib/types";

interface TrendAnalysisPanelProps {
  analysis: TrendAnalysis;
  trendTitle?: string;
  trendSourceLabel?: string;
  trendSummary?: string;
  busyAction?: string | null;
  onWriteWithIdea?: (idea: string) => void;
}

export function TrendAnalysisPanel({
  analysis,
  trendTitle,
  trendSourceLabel,
  trendSummary,
  busyAction = null,
  onWriteWithIdea,
}: TrendAnalysisPanelProps) {
  return (
    <div className="space-y-4 text-sm">
      {(trendTitle || trendSourceLabel || trendSummary) && (
        <div className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-4">
          {trendSourceLabel && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
              {trendSourceLabel}
            </span>
          )}
          {trendTitle && (
            <h3 className="mt-2 font-headline text-base font-semibold leading-snug text-on-surface">
              {trendTitle}
            </h3>
          )}
          {trendSummary && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{trendSummary}</p>
          )}
        </div>
      )}

      {analysis.why_hot && (
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            为什么有流量
          </h4>
          <p className="leading-relaxed text-on-surface">{analysis.why_hot}</p>
        </section>
      )}

      {analysis.account_angle && (
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            新号怎么跟
          </h4>
          <p className="leading-relaxed text-on-surface">{analysis.account_angle}</p>
        </section>
      )}

      {analysis.topic_ideas.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            可写选题
          </h4>
          <ul className="space-y-2">
            {analysis.topic_ideas.map((idea) => (
              <li
                key={idea}
                className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-3"
              >
                <p className="text-xs leading-relaxed">{idea}</p>
                {onWriteWithIdea && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => onWriteWithIdea(idea)}
                    className="mt-2 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    用这个选题开写 →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(analysis.platform_tips).length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            分平台建议
          </h4>
          <ul className="space-y-2">
            {(Object.keys(platformLabels) as Platform[]).map((key) => {
              const tip = analysis.platform_tips[key];
              if (!tip) return null;
              return (
                <li key={key} className="rounded-lg bg-surface-container/60 px-3 py-2 text-xs">
                  <span className="font-medium">{platformLabels[key]}：</span>
                  {tip}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {analysis.related.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            关联高流量内容
          </h4>
          <ul className="space-y-2">
            {analysis.related.map((rel) => (
              <li key={rel.url || rel.title} className="rounded-lg border border-outline-variant/20 p-2">
                {rel.url ? (
                  <a
                    href={rel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {rel.title}
                  </a>
                ) : (
                  <p className="text-xs font-medium">{rel.title}</p>
                )}
                {rel.metrics && (
                  <p className="mt-0.5 text-[10px] text-on-surface-variant">{rel.metrics}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.caution && (
        <p className="text-[11px] text-on-surface-variant/70">{analysis.caution}</p>
      )}
    </div>
  );
}
