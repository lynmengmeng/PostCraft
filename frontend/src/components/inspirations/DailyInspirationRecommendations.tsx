"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import {
  formatPickForInspiration,
  getDailyInspirationPicks,
  getTodayRhythm,
  type DailyInspirationPick,
} from "@/lib/daily-inspiration-picks";

interface DailyInspirationRecommendationsProps {
  onSaved?: () => void;
  onFillForm?: (content: string, tags: string) => void;
  compact?: boolean;
}

export function DailyInspirationRecommendations({
  onSaved,
  onFillForm,
  compact = false,
}: DailyInspirationRecommendationsProps) {
  const router = useRouter();
  const picks = useMemo(() => getDailyInspirationPicks(), []);
  const rhythm = getTodayRhythm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState("");

  async function saveToLibrary(pick: DailyInspirationPick) {
    setBusyId(`save-${pick.id}`);
    try {
      await api.createInspiration(formatPickForInspiration(pick), pick.tags);
      setActionInfo(`已存入灵感库：${pick.suggestedTitle.slice(0, 20)}…`);
      onSaved?.();
      setTimeout(() => setActionInfo(""), 2500);
    } finally {
      setBusyId(null);
    }
  }

  async function startWriting(pick: DailyInspirationPick) {
    setBusyId(`write-${pick.id}`);
    try {
      const inspiration = await api.createInspiration(formatPickForInspiration(pick), pick.tags);
      const project = await api.inspirationToProject(inspiration.id);
      router.push(`/create/${project.id}`);
    } finally {
      setBusyId(null);
    }
  }

  function fillForm(pick: DailyInspirationPick) {
    onFillForm?.(formatPickForInspiration(pick), pick.tags.join(", "));
    setActionInfo("已填入上方表单，可编辑后保存");
    setTimeout(() => setActionInfo(""), 2500);
  }

  const rhythmHint =
    rhythm === "周一"
      ? "今日侧重搜一搜：AI 学习 / 专业规划"
      : rhythm === "周三"
        ? "今日侧重学霸方法 / 暑假规划"
        : rhythm === "周五"
          ? "今日侧重家长共鸣 / 高互动选题"
          : "周末可提前准备下周选题";

  if (compact) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            今日灵感推荐
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant/80">{rhythmHint}</p>
        </div>
        {actionInfo && <p className="text-[11px] text-primary">{actionInfo}</p>}
        <div className="space-y-3">
          {picks.map((pick) => (
            <div
              key={pick.id}
              className="rounded-xl border border-primary/15 bg-primary/5 p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {pick.pillar}
              </p>
              <p className="mt-2 text-[13px] font-semibold leading-snug text-on-surface">
                {pick.suggestedTitle}
              </p>
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-on-surface-variant">
                {pick.openingHint}
              </p>
              <p className="mt-2 text-[10px] text-on-surface-variant/70">
                互动：{pick.engagementQuestion}
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void startWriting(pick)}
                  className="rounded-lg bg-primary py-2 text-[11px] font-bold text-on-primary disabled:opacity-50"
                >
                  {busyId === `write-${pick.id}` ? "进入中..." : "直接开写"}
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void saveToLibrary(pick)}
                  className="rounded-lg border border-primary/30 py-2 text-[11px] font-semibold text-primary disabled:opacity-50"
                >
                  {busyId === `save-${pick.id}` ? "保存中..." : "存入灵感库"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="mb-10 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-surface p-6 shadow-sm md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="lightbulb" className="text-[22px] text-primary" />
            <h3 className="font-headline text-xl font-semibold text-on-surface">今日灵感推荐</h3>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">{rhythmHint}</p>
          <p className="mt-1 text-xs text-on-surface-variant/70">
            含搜一搜标题方向、痛点开头、文末互动提问，适合公众号冷启动。
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {rhythm === "通用" ? "每日更新" : `${rhythm}推荐`}
        </span>
      </div>

      {actionInfo && (
        <p className="mb-4 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm text-primary">
          {actionInfo}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {picks.map((pick) => (
          <article
            key={pick.id}
            className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface p-5"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {pick.pillar}
            </span>
            <h4 className="mt-2 font-headline text-[15px] font-semibold leading-snug text-on-surface">
              {pick.suggestedTitle}
            </h4>
            <p className="mt-3 flex-1 text-[13px] leading-relaxed text-on-surface-variant">
              {pick.content.split("\n\n")[0]}
            </p>
            <div className="mt-3 space-y-2 rounded-lg bg-surface-container-low/80 p-3 text-[11px] text-on-surface-variant">
              <p>
                <span className="font-semibold text-on-surface">开头：</span>
                {pick.openingHint}
              </p>
              <p>
                <span className="font-semibold text-on-surface">互动：</span>
                {pick.engagementQuestion}
              </p>
              <p>
                <span className="font-semibold text-on-surface">搜一搜：</span>
                {pick.searchKeywords.join("、")}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {onFillForm && (
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => fillForm(pick)}
                  className="rounded-lg border border-outline-variant/50 px-3 py-2 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                >
                  填入表单
                </button>
              )}
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void saveToLibrary(pick)}
                className="rounded-lg border border-primary/30 px-3 py-2 text-[12px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                {busyId === `save-${pick.id}` ? "保存中..." : "存入灵感库"}
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void startWriting(pick)}
                className="rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
              >
                {busyId === `write-${pick.id}` ? "进入中..." : "直接开写"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
