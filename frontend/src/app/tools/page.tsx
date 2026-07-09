"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { TrendAnalysisPanel } from "@/components/tools/TrendAnalysisPanel";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";
import {
  analysisFromPick,
  buildTrendSnapshot,
  inspirationPreviewFromSnapshot,
  snapshotFromPick,
} from "@/lib/trend-snapshot";
import type { TrendAnalysis, TrendItem, TrendSource, WechatInspirationPick } from "@/lib/types";

type SourceFilter = "all" | TrendSource;

const sourceFilters: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "全部热度" },
  { key: "wechat_hot", label: "公众号热文" },
  { key: "wechat_search", label: "搜一搜热词" },
  { key: "weibo_hot", label: "微博热搜" },
  { key: "xiaohongshu_hot", label: "小红书参考" },
  { key: "douyin_hot", label: "抖音热搜" },
  { key: "douyin_popular", label: "抖音热门" },
  { key: "bilibili_hot", label: "B站热搜" },
  { key: "bilibili_popular", label: "B站热门" },
];

function heatColor(heat: number) {
  if (heat >= 85) return "bg-red-500/90";
  if (heat >= 70) return "bg-orange-500/90";
  if (heat >= 55) return "bg-amber-500/90";
  return "bg-emerald-600/90";
}

function formatFetchedAt(iso: string | null | undefined) {
  if (!iso) return "尚未拉取";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ToolsPage() {
  const router = useRouter();
  const { searchQuery } = useShell();
  const { data, error, loading, reload, setData } = useBackendQuery(
    () => api.getTrends(),
    [],
  );

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [selected, setSelected] = useState<TrendItem | null>(null);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionMsgError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savedPickIds, setSavedPickIds] = useState<Set<string>>(new Set());

  const savedTrendIds = useMemo(() => {
    const ids = new Set(data?.saved_trend_ids ?? []);
    savedPickIds.forEach((id) => ids.add(id));
    return ids;
  }, [data?.saved_trend_ids, savedPickIds]);

  const filtered = useMemo(() => {
    let list = data?.items ?? [];
    if (sourceFilter !== "all") {
      list = list.filter((item) => item.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.source_label.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.heat - a.heat);
  }, [data?.items, sourceFilter, searchQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    setActionMsgError("");
    try {
      const board = await api.refreshTrends();
      setData(board);
      setActionMsg("热点已刷新");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSelectPick(pick: WechatInspirationPick) {
    const item =
      data?.items.find((row) => row.id === pick.trend_id) ??
      ({
        id: pick.trend_id,
        title: pick.title,
        source: pick.source,
        source_label: pick.source_label,
        rank: 0,
        heat: pick.heat,
        heat_label: "",
        url: pick.url,
        summary: pick.angle,
      } satisfies TrendItem);
    await handleSelect(item);
  }

  async function resolveAnalysisForPick(pick: WechatInspirationPick): Promise<TrendAnalysis> {
    if (selected?.id === pick.trend_id && analysis) {
      return analysis;
    }
    try {
      return await api.analyzeTrend({
        title: pick.title,
        source: pick.source_label,
        summary: pick.angle,
        platform: pick.source,
      });
    } catch {
      return analysisFromPick(pick);
    }
  }

  async function saveTrendToInspiration(payload: {
    title: string;
    snapshot: ReturnType<typeof buildTrendSnapshot>;
    sourceUrl?: string;
  }) {
    const inspiration = inspirationPreviewFromSnapshot(payload.snapshot);
    await api.trendToInspiration({
      title: payload.title,
      inspiration,
      content_pillar: "热点观察",
      source_url: payload.sourceUrl ?? payload.snapshot.url,
      trend_id: payload.snapshot.trend_id,
      trend_snapshot: payload.snapshot,
    });
  }

  async function startWritingFromPick(pick: WechatInspirationPick) {
    setBusyAction("project");
    setActionMsgError("");
    try {
      const inspiration = [
        `热点：${pick.title}`,
        `推荐标题：${pick.article_title}`,
        pick.angle,
        pick.url ? `链接：${pick.url}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const project = await api.trendToProject({
        title: pick.article_title,
        inspiration,
        content_pillar: "热点观察",
        source_url: pick.url,
        trend_id: pick.trend_id,
        cover_headline: pick.article_title.slice(0, 20),
        cover_subheadline: pick.angle.slice(0, 40) || pick.title.slice(0, 40),
      });
      router.push(`/create/${project.id}`);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function savePickToInspiration(pick: WechatInspirationPick) {
    const actionKey = `inspiration:${pick.trend_id}`;
    setBusyAction(actionKey);
    setActionMsgError("");
    try {
      const resolvedAnalysis = await resolveAnalysisForPick(pick);
      const snapshot = snapshotFromPick(pick, resolvedAnalysis);
      await saveTrendToInspiration({
        title: pick.article_title,
        snapshot,
        sourceUrl: pick.url,
      });
      setSavedPickIds((prev) => new Set(prev).add(pick.trend_id));
      setData((prev) =>
        prev
          ? {
              ...prev,
              saved_trend_ids: Array.from(new Set([...(prev.saved_trend_ids ?? []), pick.trend_id])),
            }
          : prev,
      );
      setActionMsg("已存入灵感库");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveAllPicksToInspiration() {
    const picks = data?.wechat_picks ?? [];
    if (!picks.length) return;
    setBusyAction("inspiration:all");
    setActionMsgError("");
    try {
      let saved = 0;
      for (const pick of picks) {
        if (savedTrendIds.has(pick.trend_id)) continue;
        const resolvedAnalysis = analysisFromPick(pick);
        const snapshot = snapshotFromPick(pick, resolvedAnalysis);
        await saveTrendToInspiration({
          title: pick.article_title,
          snapshot,
          sourceUrl: pick.url,
        });
        saved += 1;
      }
      const allIds = picks.map((pick) => pick.trend_id);
      setSavedPickIds(new Set(allIds));
      setData((prev) =>
        prev ? { ...prev, saved_trend_ids: Array.from(new Set([...(prev.saved_trend_ids ?? []), ...allIds])) } : prev,
      );
      setActionMsg(saved > 0 ? `已收藏 ${saved} 条到灵感库` : "已全部收藏过");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "批量收藏失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelect(item: TrendItem) {
    setSelected(item);
    setAnalysis(null);
    setAnalyzing(true);
    setActionMsgError("");
    try {
      const result = await api.analyzeTrend({
        title: item.title,
        source: item.source_label,
        summary: item.summary,
        platform: item.source,
      });
      setAnalysis(result);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveToTopic(item: TrendItem, idea?: string) {
    setBusyAction("topic");
    setActionMsgError("");
    try {
      if (!analysis) {
        setActionMsgError("请等待热点分析完成后再存选题");
        return;
      }
      const title = idea || item.title;
      const snapshot = buildTrendSnapshot(item, analysis);
      if (idea) {
        snapshot.analysis = {
          ...analysis,
          topic_ideas: [idea, ...analysis.topic_ideas.filter((row) => row !== idea)].slice(0, 5),
        };
      }
      const inspiration = inspirationPreviewFromSnapshot(snapshot);
      await api.trendToTopic({
        title,
        inspiration,
        content_pillar: "热点观察",
        trend_id: item.id,
        source_url: item.url,
        trend_snapshot: snapshot,
      });
      setActionMsg("已存入选题库");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveToInspiration(item: TrendItem) {
    setBusyAction("inspiration");
    setActionMsgError("");
    try {
      if (!analysis) {
        setActionMsgError("请等待热点分析完成后再收藏");
        return;
      }
      const snapshot = buildTrendSnapshot(item, analysis);
      await saveTrendToInspiration({
        title: item.title,
        snapshot,
        sourceUrl: item.url,
      });
      setActionMsg("已存入灵感库");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function startWriting(item: TrendItem, idea?: string) {
    setBusyAction("project");
    setActionMsgError("");
    try {
      const title = idea || item.title;
      const inspiration = [
        `热点：${item.title}`,
        item.summary,
        analysis?.why_hot ? `为什么热：${analysis.why_hot}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const topic = await api.trendToTopic({
        title,
        inspiration,
        content_pillar: "热点观察",
      });
      const project = await api.topicToProject(topic.id);
      router.push(`/create/${project.id}`);
    } catch (err) {
      setActionMsgError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-on-surface-variant/50">加载热点...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-8">
        <h1 className="font-headline text-2xl font-semibold">热点工具</h1>
        <LoadError message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl font-semibold">热点工具</h1>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              聚合公众号、小红书、抖音、B 站等平台热点，一键分析新号角度、关联内容与可写选题。
            </p>
            <p className="mt-2 text-xs text-on-surface-variant/70">
              更新于 {formatFetchedAt(data?.fetched_at)}
              {data?.cache_hit ? " · 今日缓存" : " · 刚刚拉取"}
              {data?.sources?.length ? ` · 来源：${data.sources.join("、")}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon name="refresh" className={`text-base ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "刷新中..." : "刷新热点"}
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

        {(data?.wechat_picks?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-headline text-lg font-semibold text-on-surface">
                  公众号灵感推荐
                </h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  抓取热点后自动筛选 10 条适合写搜索型长文、新号冷启动的选题。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                  Top {data?.wechat_picks.length}
                </span>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void saveAllPicksToInspiration()}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-surface-container-lowest px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  <Icon name="bookmark" className="text-sm" />
                  {busyAction === "inspiration:all" ? "收藏中..." : "全部收藏"}
                </button>
              </div>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {data?.wechat_picks.map((pick, index) => (
                <li
                  key={pick.trend_id}
                  className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-on-primary">
                      {index + 1}
                    </span>
                    <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant">
                      {pick.source_label}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/70">热度 {pick.heat}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug text-on-surface">{pick.article_title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant/80">
                    原热点：{pick.title}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
                    {pick.angle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => void startWritingFromPick(pick)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-on-primary disabled:opacity-50"
                    >
                      一键开写
                    </button>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => void savePickToInspiration(pick)}
                      className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px] disabled:opacity-50"
                    >
                      <Icon name="bookmark" className="text-sm" />
                      {busyAction === `inspiration:${pick.trend_id}`
                        ? "收藏中..."
                        : savedTrendIds.has(pick.trend_id)
                          ? "已收藏"
                          : "收藏"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSelectPick(pick)}
                      className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px] disabled:opacity-50"
                    >
                      查看详情
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="sticky top-0 z-10 -mx-6 border-b border-outline-variant/20 bg-background/95 px-6 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {sourceFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSourceFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  sourceFilter === f.key
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-outline-variant/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b border-outline-variant/20 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            <span>热度</span>
            <span>话题</span>
            <span className="hidden sm:block">来源</span>
            <span className="text-right">操作</span>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-on-surface-variant">
              没有匹配的热点，试试刷新或换个筛选。
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/15">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors ${
                    selected?.id === item.id ? "bg-primary/5" : "hover:bg-surface-container/50"
                  }`}
                >
                  <div className="flex w-12 flex-col items-center gap-1">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white ${heatColor(item.heat)}`}
                    >
                      {item.heat}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/60">{item.heat_label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSelect(item)}
                    className="min-w-0 text-left"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-on-surface">{item.title}</p>
                    {item.summary && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">{item.summary}</p>
                    )}
                  </button>
                  <span className="hidden rounded bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant sm:block">
                    {item.source_label}
                  </span>
                  <div className="flex justify-end gap-1">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container"
                        title="打开原文"
                      >
                        <Icon name="open_in_new" className="text-base" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSelect(item)}
                      className="rounded-lg bg-surface-container px-2 py-1 text-[11px] font-medium text-on-surface hover:bg-outline-variant/20"
                    >
                      分析
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </div>

      <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-outline-variant/30 bg-surface-container-low lg:w-[400px] lg:border-l lg:border-t-0">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Icon name="insights" className="mb-3 text-4xl text-on-surface-variant/30" />
            <p className="text-sm font-medium text-on-surface">选择一条热点</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              查看 AI 经营建议、关联内容与可写选题
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-outline-variant/20 p-5">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                {selected.source_label}
              </span>
              <h2 className="mt-2 font-headline text-lg font-semibold leading-snug">{selected.title}</h2>
              {selected.summary && (
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{selected.summary}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void startWriting(selected)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-on-primary disabled:opacity-50"
                >
                  <Icon name="edit_note" className="text-sm" />
                  一键开写
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void saveToTopic(selected)}
                  className="rounded-xl border border-outline-variant/30 px-3 py-2 text-xs disabled:opacity-50"
                >
                  存选题
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void saveToInspiration(selected)}
                  className="rounded-xl border border-outline-variant/30 px-3 py-2 text-xs disabled:opacity-50"
                >
                  存灵感
                </button>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
              {analyzing ? (
                <p className="text-sm text-on-surface-variant/60">正在分析经营角度...</p>
              ) : analysis ? (
                <TrendAnalysisPanel
                  analysis={analysis}
                  busyAction={busyAction}
                  onWriteWithIdea={(idea) => void startWriting(selected, idea)}
                />
              ) : null}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
