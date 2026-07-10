"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import {
  analysisFromDouyinPick,
  inspirationPreviewFromSnapshot,
  snapshotFromDouyinPick,
} from "@/lib/trend-snapshot";
import type { DouyinInspirationPick, DouyinOpsBoard } from "@/lib/types";

type ViewFilter = "all" | "saved" | "series";
type PillarFilter = "all" | string;
type PlatformTab = "douyin" | "xiaohongshu";

const PILLARS = [
  "成年人情绪观察",
  "低耗生活实验",
  "普通女生的清醒时刻",
] as const;

const EXPRESSION_COLORS: Record<string, string> = {
  共鸣型: "bg-rose-500/10 text-rose-700",
  故事型: "bg-amber-500/10 text-amber-800",
  方法型: "bg-sky-500/10 text-sky-800",
};

function formatFetchedAt(iso: string | null | undefined) {
  if (!iso) return "尚未生成";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPickInspiration(pick: DouyinInspirationPick, platform: PlatformTab) {
  if (platform === "xiaohongshu") {
    const lines = [
      `【小红书标题】${pick.xiaohongshu.title}`,
      "",
      pick.xiaohongshu.opening,
      pick.xiaohongshu.methods.length
        ? `\n【方法清单】\n${pick.xiaohongshu.methods.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
        : "",
      pick.xiaohongshu.closing_question
        ? `\n【结尾互动】${pick.xiaohongshu.closing_question}`
        : "",
      (pick.xiaohongshu.tags?.length ?? 0) > 0
        ? `\n【话题标签】\n${pick.xiaohongshu.tags.map((t) => `#${t}`).join(" ")}`
        : "",
    ];
    return lines.filter(Boolean).join("\n");
  }

  return [
    `【栏目】${pick.pillar} · ${pick.expression_type}`,
    pick.series_episode ? `【系列】${pick.series_name} 第 ${pick.series_episode} 期` : "",
    "",
    `【前3秒】${pick.douyin.opening}`,
    `【场景】${pick.douyin.scene}`,
    `【反转】${pick.douyin.reversal}`,
    `【互动】${pick.douyin.question}`,
    "",
    `【完整口播】\n${pick.copy_text}`,
    `【画面形式】${pick.douyin.visual_style}，${pick.douyin.duration}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function DouyinOpsPage() {
  const router = useRouter();
  const { searchQuery } = useShell();
  const { data, error, loading, reload, setData } = useBackendQuery(
    () => api.getDouyinOps(),
    [],
  );

  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>("all");
  const [showPositioning, setShowPositioning] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [savedPickIds, setSavedPickIds] = useState<Set<string>>(new Set());
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [platformTabs, setPlatformTabs] = useState<Record<string, PlatformTab>>({});

  const savedIds = useMemo(() => {
    const ids = new Set(data?.saved_pick_ids ?? []);
    savedPickIds.forEach((id) => ids.add(id));
    return ids;
  }, [data?.saved_pick_ids, savedPickIds]);

  const filteredPicks = useMemo(() => {
    let list = data?.picks ?? [];
    if (viewFilter === "saved") {
      list = list.filter((pick) => savedIds.has(pick.trend_id));
    } else if (viewFilter === "series") {
      list = list.filter((pick) => pick.series_episode);
    }
    if (pillarFilter !== "all") {
      list = list.filter((pick) => pick.pillar === pillarFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (pick) =>
          pick.hook.toLowerCase().includes(q) ||
          pick.title.toLowerCase().includes(q) ||
          pick.pillar.toLowerCase().includes(q) ||
          pick.xiaohongshu.title.toLowerCase().includes(q) ||
          (pick.xiaohongshu.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
          pick.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [data?.picks, viewFilter, pillarFilter, savedIds, searchQuery]);

  function getPlatformTab(pickId: string): PlatformTab {
    return platformTabs[pickId] ?? "douyin";
  }

  function markPickSaved(trendId: string) {
    setSavedPickIds((prev) => new Set(prev).add(trendId));
    setData((prev) =>
      prev
        ? {
            ...prev,
            saved_pick_ids: Array.from(new Set([...(prev.saved_pick_ids ?? []), trendId])),
          }
        : prev,
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    setActionError("");
    try {
      const board = await api.refreshDouyinOps();
      setData(board);
      setCoverUrls({});
      setActionMsg("已按账号定位重新生成内容");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setRefreshing(false);
    }
  }

  async function savePick(pick: DouyinInspirationPick) {
    const actionKey = `save:${pick.trend_id}`;
    setBusyAction(actionKey);
    setActionError("");
    try {
      const analysis = analysisFromDouyinPick(pick);
      const snapshot = snapshotFromDouyinPick(pick, analysis);
      const inspiration = [
        inspirationPreviewFromSnapshot(snapshot),
        "",
        buildPickInspiration(pick, "douyin"),
        "",
        "--- 小红书改编 ---",
        buildPickInspiration(pick, "xiaohongshu"),
      ].join("\n");

      await api.douyinPickToTopic({
        title: pick.xiaohongshu.title || pick.hook,
        inspiration,
        content_pillar: pick.pillar || "抖音运营",
        trend_id: pick.trend_id,
        trend_snapshot: snapshot,
      });
      markPickSaved(pick.trend_id);
      setActionMsg("已收藏到选题库");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "收藏失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function startWriting(pick: DouyinInspirationPick, platform: PlatformTab) {
    setBusyAction(`write:${pick.trend_id}`);
    setActionError("");
    try {
      const title =
        platform === "xiaohongshu"
          ? pick.xiaohongshu.title || pick.hook
          : pick.hook;
      const project = await api.douyinPickToProject({
        title,
        inspiration: buildPickInspiration(pick, platform),
        content_pillar: pick.pillar || "抖音运营",
        trend_id: pick.trend_id,
        cover_headline: pick.hook,
      });
      router.push(`/create/${project.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function generateCover(pick: DouyinInspirationPick) {
    const actionKey = `cover:${pick.trend_id}`;
    setBusyAction(actionKey);
    setActionError("");
    try {
      const result = await api.generateDouyinCover({
        hook: pick.hook,
        cover_prompt: pick.cover_prompt,
        pick_id: pick.trend_id,
      });
      setCoverUrls((prev) => ({ ...prev, [pick.trend_id]: result.cover_url }));
      setActionMsg(result.placeholder ? "配图 API 暂不可用，已生成占位图" : "配图已生成");
      setTimeout(() => setActionMsg(""), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "配图生成失败");
    } finally {
      setBusyAction(null);
    }
  }

  function getCoverUrl(pick: DouyinInspirationPick): string | undefined {
    return coverUrls[pick.trend_id] || pick.cover_url || undefined;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-on-surface-variant/50">加载账号运营内容...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-8">
        <h1 className="font-headline text-2xl font-semibold">抖音运营</h1>
        <LoadError message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl font-semibold">抖音运营</h1>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              女性成长＋低耗生活＋情绪共鸣账号。每条内容含抖音口播结构和小红书改编，按三栏目配比生成。
            </p>
            <p className="mt-2 text-xs text-on-surface-variant/70">
              更新于 {formatFetchedAt(data?.fetched_at)}
              {data?.cache_hit ? " · 今日缓存" : " · 刚刚生成"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon name="refresh" className={`text-base ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "重新生成中..." : "刷新重新生成"}
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

        {data && <PositioningPanel board={data} open={showPositioning} onToggle={() => setShowPositioning((v) => !v)} />}

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", `今日推荐 (${data?.picks.length ?? 0})`],
              ["series", `系列 (${data?.picks.filter((p) => p.series_episode).length ?? 0})`],
              ["saved", `已收藏 (${savedIds.size})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "series") {
                  router.push("/douyin/series");
                  return;
                }
                setViewFilter(key);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                viewFilter === key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-outline-variant/20"
              }`}
            >
              {key === "saved" && <Icon name="bookmark" className="mr-1 inline text-sm" />}
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPillarFilter("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${
              pillarFilter === "all" ? "bg-on-surface text-surface" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            全部栏目
          </button>
          {PILLARS.map((pillar) => (
            <button
              key={pillar}
              type="button"
              onClick={() => setPillarFilter(pillar)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                pillarFilter === pillar
                  ? "bg-on-surface text-surface"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {pillar}
            </button>
          ))}
        </div>

        {filteredPicks.length === 0 ? (
          <EmptyState viewFilter={viewFilter} />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {filteredPicks.map((pick, index) => (
              <PickCard
                key={pick.trend_id}
                pick={pick}
                index={index}
                isSaved={savedIds.has(pick.trend_id)}
                isExpanded={expandedId === pick.trend_id}
                platformTab={getPlatformTab(pick.trend_id)}
                coverUrl={getCoverUrl(pick)}
                busyAction={busyAction}
                onToggleExpand={() =>
                  setExpandedId(expandedId === pick.trend_id ? null : pick.trend_id)
                }
                onPlatformTab={(tab) =>
                  setPlatformTabs((prev) => ({ ...prev, [pick.trend_id]: tab }))
                }
                onSave={() => void savePick(pick)}
                onWrite={(platform) => void startWriting(pick, platform)}
                onCover={() => void generateCover(pick)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PositioningPanel({
  board,
  open,
  onToggle,
}: {
  board: DouyinOpsBoard;
  open: boolean;
  onToggle: () => void;
}) {
  const { positioning, content_ratio, weekly_schedule, series } = board;

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h2 className="font-headline text-base font-semibold text-on-surface">账号定位</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">{positioning.tagline}</p>
        </div>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-xl text-on-surface-variant" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-primary/15 px-5 pb-5 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                目标用户
              </p>
              <p className="mt-1 text-sm text-on-surface">{positioning.target_audience}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                简介参考
              </p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface">{positioning.bio}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {positioning.keywords.map((kw) => (
              <span key={kw} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
                {kw}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <RatioCard label="情绪内耗/职场" value={content_ratio.emotion_work} />
            <RatioCard label="独处/低耗生活" value={content_ratio.solitude_life} />
            <RatioCard label="家庭/人际关系" value={content_ratio.family_relation} />
          </div>
          <p className="text-[11px] text-on-surface-variant/80">{content_ratio.note}</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="text-xs font-semibold text-on-surface">本周排期（每周 5 条）</p>
              <ul className="mt-2 space-y-1.5">
                {weekly_schedule.map((item) => (
                  <li key={item.weekday} className="text-[11px] text-on-surface-variant">
                    <span className="font-medium text-on-surface">{item.weekday}</span>
                    {" · "}
                    {item.topic}
                    <span className="ml-1 text-on-surface-variant/60">({item.pillar})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-on-surface">系列：{series.name}</p>
                <Link
                  href="/douyin/series"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  进入系列创作
                  <Icon name="arrow_forward" className="text-xs" />
                </Link>
              </div>
              <ol className="mt-2 max-h-36 space-y-1 overflow-y-auto text-[11px] text-on-surface-variant">
                {series.episodes.map((ep, i) => (
                  <li key={ep}>
                    <span className="font-medium text-on-surface">{i + 1}.</span> {ep}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-on-surface-variant">账号名方向</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {positioning.name_suggestions.map((name) => (
                <span
                  key={name}
                  className="rounded-lg border border-outline-variant/25 bg-surface px-2.5 py-1 text-[11px] text-on-surface"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RatioCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-center">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] text-on-surface-variant">{label}</p>
    </div>
  );
}

function EmptyState({ viewFilter }: { viewFilter: ViewFilter }) {
  const messages: Record<ViewFilter, [string, string]> = {
    all: ["暂无匹配内容", "试试换个栏目筛选或搜索词"],
    saved: ["还没有收藏", "收藏后会同步到选题库"],
    series: ["暂无系列内容", "刷新后会匹配「停止内耗30天」系列"],
  };
  const [title, hint] = messages[viewFilter];
  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-16 text-center">
      <Icon name="movie_filter" className="mb-3 text-4xl text-on-surface-variant/30" />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
    </div>
  );
}

function PickCard({
  pick,
  index,
  isSaved,
  isExpanded,
  platformTab,
  coverUrl,
  busyAction,
  onToggleExpand,
  onPlatformTab,
  onSave,
  onWrite,
  onCover,
}: {
  pick: DouyinInspirationPick;
  index: number;
  isSaved: boolean;
  isExpanded: boolean;
  platformTab: PlatformTab;
  coverUrl?: string;
  busyAction: string | null;
  onToggleExpand: () => void;
  onPlatformTab: (tab: PlatformTab) => void;
  onSave: () => void;
  onWrite: (platform: PlatformTab) => void;
  onCover: () => void;
}) {
  const exprColor = EXPRESSION_COLORS[pick.expression_type] ?? "bg-surface-container text-on-surface-variant";

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest">
      {coverUrl && (
        <div className="relative aspect-[9/16] max-h-44 w-full overflow-hidden bg-surface-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveImageUrl(coverUrl)} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-on-primary">
            {index + 1}
          </span>
          <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface">
            {pick.pillar}
          </span>
          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${exprColor}`}>
            {pick.expression_type}
          </span>
          {pick.series_episode && (
            <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-700">
              系列第{pick.series_episode}期
            </span>
          )}
          {isSaved && <Icon name="bookmark" className="ml-auto text-sm text-primary" />}
        </div>

        <p className="text-[11px] text-on-surface-variant/70">选题：{pick.title}</p>

        <div className="mt-3 flex gap-1 rounded-lg bg-surface-container p-0.5">
          {(["douyin", "xiaohongshu"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onPlatformTab(tab)}
              className={`flex-1 rounded-md py-1 text-[11px] font-medium transition-colors ${
                platformTab === tab
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant"
              }`}
            >
              {tab === "douyin" ? "抖音口播" : "小红书"}
            </button>
          ))}
        </div>

        {platformTab === "douyin" ? (
          <DouyinContent pick={pick} expanded={isExpanded} />
        ) : (
          <XhsContent pick={pick} expanded={isExpanded} />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => onWrite(platformTab)}
            className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-on-primary disabled:opacity-50"
          >
            {busyAction === `write:${pick.trend_id}` ? "创建中..." : "一键开写"}
          </button>
          {platformTab === "douyin" && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={onCover}
              className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              <Icon name="image" className="text-sm" />
              {busyAction === `cover:${pick.trend_id}` ? "生成中..." : coverUrl ? "重新配图" : "生成配图"}
            </button>
          )}
          <button
            type="button"
            disabled={busyAction !== null || isSaved}
            onClick={onSave}
            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px] disabled:opacity-50"
          >
            <Icon name="bookmark" className="text-sm" />
            {busyAction === `save:${pick.trend_id}` ? "收藏中..." : isSaved ? "已收藏" : "收藏"}
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-[11px]"
          >
            {isExpanded ? "收起" : "展开全文"}
          </button>
        </div>
      </div>
    </li>
  );
}

function DouyinContent({ pick, expanded }: { pick: DouyinInspirationPick; expanded: boolean }) {
  const blocks = [
    { label: "前3秒", text: pick.douyin.opening },
    { label: "场景", text: pick.douyin.scene },
    { label: "反转", text: pick.douyin.reversal },
    { label: "互动", text: pick.douyin.question },
  ];

  return (
    <div className="mt-3 space-y-2">
      {blocks.map((block) => (
        <div key={block.label}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            {block.label}
          </span>
          <p
            className={`mt-0.5 text-sm leading-relaxed text-on-surface ${
              expanded ? "" : block.label === "前3秒" ? "" : "line-clamp-2"
            }`}
          >
            {block.text}
          </p>
        </div>
      ))}
      <p className="text-[10px] text-on-surface-variant/60">
        {pick.douyin.visual_style} · {pick.douyin.duration}
      </p>
    </div>
  );
}

function XhsContent({ pick, expanded }: { pick: DouyinInspirationPick; expanded: boolean }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold leading-snug text-on-surface">{pick.xiaohongshu.title}</p>
      <p className={`text-sm leading-relaxed text-on-surface-variant ${expanded ? "" : "line-clamp-3"}`}>
        {pick.xiaohongshu.opening}
      </p>
      {pick.xiaohongshu.methods.length > 0 && (expanded || pick.xiaohongshu.methods.length <= 2) && (
        <ul className="space-y-1 border-t border-outline-variant/15 pt-2">
          {pick.xiaohongshu.methods.map((method, i) => (
            <li key={i} className="text-xs text-on-surface-variant">
              <span className="font-medium text-on-surface">{i + 1}.</span> {method}
            </li>
          ))}
        </ul>
      )}
      {pick.xiaohongshu.closing_question && (
        <p className="text-xs italic text-on-surface-variant/80">{pick.xiaohongshu.closing_question}</p>
      )}
      {(pick.xiaohongshu.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-outline-variant/15 pt-2">
          {pick.xiaohongshu.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-rose-500/8 px-2 py-0.5 text-[10px] text-rose-700"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
