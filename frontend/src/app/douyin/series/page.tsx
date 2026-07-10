"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import type { SeriesEpisodeDetail, SeriesStudio } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "待创作",
  scripted: "已有口播",
  covered: "已配图",
  published: "已发布",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-surface-container text-on-surface-variant",
  scripted: "bg-amber-500/10 text-amber-800",
  covered: "bg-sky-500/10 text-sky-800",
  published: "bg-emerald-500/10 text-emerald-800",
};

export default function SeriesStudioPage() {
  const { data, error, loading, reload, setData } = useBackendQuery(
    () => api.getSeriesStudio(),
    [],
  );

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [introDraft, setIntroDraft] = useState("");
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>("all");

  const introText = introDraft || data?.intro_copy || "";

  const filteredEpisodes = useMemo(() => {
    if (!data) return [];
    if (phaseFilter === "all") return data.episodes;
    const phase = data.phases.find((p) => p.name === phaseFilter);
    if (!phase) return data.episodes;
    return data.episodes.filter(
      (ep) => ep.episode >= phase.start_episode && ep.episode <= phase.end_episode,
    );
  }, [data, phaseFilter]);

  const completedCount = useMemo(
    () => data?.episodes.filter((ep) => ep.status === "covered" || ep.status === "published").length ?? 0,
    [data?.episodes],
  );

  async function handleExtendSeries() {
    setBusyAction("extend");
    setActionError("");
    try {
      const updated = await api.extendSeries(5);
      setData(updated);
      setActionMsg(`已扩展 ${updated.total_episodes} 期，可继续创作`);
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "扩展失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerateSeriesCover() {
    if (!data) return;
    setBusyAction("series-cover");
    setActionError("");
    try {
      const result = await api.generateSeriesCover({
        cover_prompt: data.series_cover_prompt,
      });
      setData((prev) => (prev ? { ...prev, series_cover_url: result.cover_url } : prev));
      setActionMsg(result.placeholder ? "系列封面：已生成占位图" : "系列封面已生成");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerateEpisodeCover(ep: SeriesEpisodeDetail) {
    setBusyAction(`cover:${ep.episode}`);
    setActionError("");
    try {
      const result = await api.generateSeriesCover({
        episode: ep.episode,
        title: ep.title,
        cover_prompt: ep.cover_prompt,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              episodes: prev.episodes.map((row) =>
                row.episode === ep.episode
                  ? { ...row, cover_url: result.cover_url, status: "covered" }
                  : row,
              ),
            }
          : prev,
      );
      setActionMsg(`第 ${ep.episode} 期封面已生成`);
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerateScript(ep: SeriesEpisodeDetail) {
    setBusyAction(`script:${ep.episode}`);
    setActionError("");
    try {
      const result = await api.generateEpisodeScript(ep.episode);
      setData((prev) =>
        prev
          ? {
              ...prev,
              episodes: prev.episodes.map((row) =>
                row.episode === ep.episode
                  ? { ...row, hook: result.hook, status: "scripted" }
                  : row,
              ),
            }
          : prev,
      );
      setActionMsg(`第 ${ep.episode} 期口播钩子已生成`);
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveIntro() {
    if (!introText.trim()) return;
    setBusyAction("intro");
    setActionError("");
    try {
      const updated = await api.updateSeriesStudio({ intro_copy: introText });
      setData(updated);
      setIntroDraft("");
      setActionMsg("系列简介已保存");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyIntro() {
    if (!introText) return;
    await navigator.clipboard.writeText(introText);
    setActionMsg("简介已复制");
    setTimeout(() => setActionMsg(""), 2000);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-on-surface-variant/50">加载系列创作台...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-8">
        <Link href="/douyin" className="text-sm text-primary hover:underline">
          ← 返回抖音运营
        </Link>
        <LoadError message={error ?? "加载失败"} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/douyin"
              className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Icon name="arrow_back" className="text-sm" />
              返回抖音运营
            </Link>
            <h1 className="font-headline text-2xl font-semibold">{data.series_name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{data.tagline}</p>
            <p className="mt-2 text-xs text-on-surface-variant/70">
              共 {data.total_episodes} 期 · 已完成配图 {completedCount} 期
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant/80">
              {data.description}
            </p>
          </div>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleExtendSeries()}
            className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
          >
            <Icon name="add" className="text-base" />
            {busyAction === "extend" ? "扩展中..." : "30期后继续扩展"}
          </button>
        </header>

        {(actionMsg || actionError) && (
          <div
            className={`rounded-xl px-4 py-2 text-sm ${
              actionError
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {actionError || actionMsg}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4">
            <p className="text-xs font-semibold text-on-surface">系列合辑封面</p>
            <div className="relative mt-3 aspect-[9/16] overflow-hidden rounded-xl bg-surface-container">
              {data.series_cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={resolveImageUrl(data.series_cover_url)}
                  alt="系列封面"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <Icon name="collections" className="text-3xl text-on-surface-variant/30" />
                  <p className="text-[11px] text-on-surface-variant">尚未生成系列封面</p>
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleGenerateSeriesCover()}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-medium text-on-primary disabled:opacity-50"
            >
              <Icon name="image" className="text-sm" />
              {busyAction === "series-cover" ? "生成中..." : data.series_cover_url ? "重新生成" : "生成系列封面"}
            </button>
          </section>

          <section className="space-y-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-5">
            <div>
              <p className="text-xs font-semibold text-on-surface">系列简介（置顶/合集说明）</p>
              <textarea
                value={introText}
                onChange={(e) => setIntroDraft(e.target.value)}
                rows={5}
                className="mt-2 w-full resize-none rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleSaveIntro()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-on-primary disabled:opacity-50"
                >
                  保存简介
                </button>
                <button
                  type="button"
                  onClick={() => void copyIntro()}
                  className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px]"
                >
                  复制
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-on-surface">小红书系列标签</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.xhs_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-rose-500/8 px-2.5 py-0.5 text-[11px] text-rose-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhaseFilter("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${
              phaseFilter === "all" ? "bg-on-surface text-surface" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            全部 ({data.total_episodes})
          </button>
          {(data.phases ?? []).map((phase) => (
            <button
              key={phase.name}
              type="button"
              onClick={() => setPhaseFilter(phase.name)}
              title={phase.note}
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                phaseFilter === phase.name
                  ? "bg-on-surface text-surface"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {phase.name} ({phase.start_episode}-{phase.end_episode})
            </button>
          ))}
        </div>

        <section>
          <h2 className="mb-3 font-headline text-lg font-semibold">分集创作</h2>
          <ul className="space-y-3">
            {filteredEpisodes.map((ep) => (
              <EpisodeCard
                key={ep.episode}
                episode={ep}
                expanded={expandedEpisode === ep.episode}
                busyAction={busyAction}
                onToggle={() =>
                  setExpandedEpisode(expandedEpisode === ep.episode ? null : ep.episode)
                }
                onGenerateCover={() => void handleGenerateEpisodeCover(ep)}
                onGenerateScript={() => void handleGenerateScript(ep)}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function EpisodeCard({
  episode: ep,
  expanded,
  busyAction,
  onToggle,
  onGenerateCover,
  onGenerateScript,
}: {
  episode: SeriesEpisodeDetail;
  expanded: boolean;
  busyAction: string | null;
  onToggle: () => void;
  onGenerateCover: () => void;
  onGenerateScript: () => void;
}) {
  const statusLabel = STATUS_LABELS[ep.status] ?? ep.status;
  const statusColor = STATUS_COLORS[ep.status] ?? STATUS_COLORS.pending;

  return (
    <li className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-start gap-3">
        {ep.cover_url ? (
          <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveImageUrl(ep.cover_url)} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-container text-lg font-bold text-primary/40">
            {ep.episode}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-primary">第 {ep.episode} 期</span>
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant">
              {ep.pillar}
            </span>
            <span className="text-[10px] text-on-surface-variant/70">{ep.expression_type}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-on-surface">{ep.title}</p>
          {ep.hook && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
              口播钩子：{ep.hook}
            </p>
          )}
        </div>
      </div>

      {expanded && ep.hook && (
        <p className="mt-3 rounded-lg bg-surface-container/60 px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
          {ep.hook}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={onGenerateScript}
          className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-on-primary disabled:opacity-50"
        >
          {busyAction === `script:${ep.episode}` ? "生成中..." : ep.hook ? "重新生成口播" : "生成本期口播"}
        </button>
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={onGenerateCover}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px] disabled:opacity-50"
        >
          <Icon name="image" className="text-sm" />
          {busyAction === `cover:${ep.episode}` ? "生成中..." : ep.cover_url ? "重新配图" : "生成分集封面"}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px]"
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>
    </li>
  );
}
