"use client";

import type { ReactNode } from "react";
import { platformLabels } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import type { Platform, TrendAnalysis } from "@/lib/types";

interface TrendAnalysisPanelProps {
  analysis: TrendAnalysis;
  trendTitle?: string;
  trendSourceLabel?: string;
  trendSummary?: string;
  busyAction?: string | null;
  onWriteWithIdea?: (idea: string) => void;
  /** 弹窗内已展示热点卡片时，可隐藏顶部重复摘要 */
  compactHeader?: boolean;
}

const platformOrder: Platform[] = ["wechat", "xiaohongshu", "douyin"];

function SectionTitle({
  icon,
  children,
}: {
  icon: string;
  children: ReactNode;
}) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
      <Icon name={icon} className="text-[16px] text-primary/70" />
      {children}
    </h4>
  );
}

export function TrendAnalysisPanel({
  analysis,
  trendTitle,
  trendSourceLabel,
  trendSummary,
  busyAction = null,
  onWriteWithIdea,
  compactHeader = false,
}: TrendAnalysisPanelProps) {
  const hasHeader = Boolean(trendTitle || trendSourceLabel || trendSummary);
  const platformTips = platformOrder.map((key) => ({
    key,
    label: platformLabels[key],
    tip: analysis.platform_tips[key]?.trim() || "",
  }));
  const hasAnyPlatformTip = platformTips.some((row) => row.tip);

  return (
    <div className="space-y-5 text-sm">
      {hasHeader && !compactHeader && (
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

      <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-4">
        <SectionTitle icon="trending_up">为什么有热度</SectionTitle>
        {analysis.why_hot ? (
          <p className="leading-relaxed text-on-surface">{analysis.why_hot}</p>
        ) : (
          <p className="text-xs text-on-surface-variant/60">暂无分析，可在热点工具重新生成。</p>
        )}
      </section>

      <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-4">
        <SectionTitle icon="person">新号怎么跟</SectionTitle>
        {analysis.account_angle ? (
          <p className="leading-relaxed text-on-surface">{analysis.account_angle}</p>
        ) : (
          <p className="text-xs text-on-surface-variant/60">暂无切入角度建议。</p>
        )}
      </section>

      <section>
        <SectionTitle icon="lightbulb">可写选题</SectionTitle>
        {analysis.topic_ideas.length > 0 ? (
          <ul className="space-y-2">
            {analysis.topic_ideas.map((idea, index) => (
              <li
                key={`${idea}-${index}`}
                className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-3"
              >
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-on-surface">{idea}</p>
                    {onWriteWithIdea && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => onWriteWithIdea(idea)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        用这个选题开写
                        <Icon name="arrow_forward" className="text-[14px]" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-outline-variant/30 px-4 py-3 text-xs text-on-surface-variant/60">
            暂无可写选题，建议回到热点工具重新分析。
          </p>
        )}
      </section>

      <section>
        <SectionTitle icon="share">分平台创作建议</SectionTitle>
        {hasAnyPlatformTip ? (
          <ul className="grid gap-2 sm:grid-cols-1">
            {platformTips.map(({ key, label, tip }) => (
              <li
                key={key}
                className={`rounded-xl px-3 py-2.5 text-xs ${
                  tip
                    ? "border border-outline-variant/20 bg-surface-container-lowest"
                    : "border border-dashed border-outline-variant/20 bg-surface-container-low/30 text-on-surface-variant/50"
                }`}
              >
                <span className="font-semibold text-on-surface">{label}</span>
                <span className="mx-1.5 text-on-surface-variant/40">·</span>
                {tip || "暂无建议"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-outline-variant/30 px-4 py-3 text-xs text-on-surface-variant/60">
            暂无分平台建议。
          </p>
        )}
      </section>

      {analysis.related.length > 0 && (
        <section>
          <SectionTitle icon="link">关联高流量内容</SectionTitle>
          <ul className="space-y-2">
            {analysis.related.map((rel) => (
              <li
                key={rel.url || rel.title}
                className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3"
              >
                {rel.url ? (
                  <a
                    href={rel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Icon name="open_in_new" className="mt-0.5 shrink-0 text-[14px]" />
                    {rel.title}
                  </a>
                ) : (
                  <p className="text-xs font-medium text-on-surface">{rel.title}</p>
                )}
                {rel.summary && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-on-surface-variant">
                    {rel.summary}
                  </p>
                )}
                {rel.metrics && (
                  <p className="mt-1 text-[10px] text-on-surface-variant/70">{rel.metrics}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.caution && (
        <div className="flex gap-2 rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
          <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
          {analysis.caution}
        </div>
      )}
    </div>
  );
}
