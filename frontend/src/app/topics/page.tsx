"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/layout/AppShell";
import { TrendAnalysisDetailModal } from "@/components/tools/TrendAnalysisDetailModal";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/LoadError";
import { CategoryPicker } from "@/components/content/CategoryPicker";
import { useContentCategories } from "@/hooks/useContentCategories";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api, platformLabels } from "@/lib/api";
import { topicDisplayTitle } from "@/lib/trend-snapshot";
import {
  resolveTopicSourceType,
  topicSourceFilterOptions,
  topicSourceLabels,
} from "@/lib/topic-source";
import type { Platform, Topic, TopicSourceType, TrendInspirationSnapshot } from "@/lib/types";

const PAGE_SIZE = 10;

const platformIcons: Record<Platform, string> = {
  wechat: "forum",
  xiaohongshu: "photo_library",
  douyin: "movie",
};

const materialLabels: Record<Topic["material_status"], string> = {
  idea: "仅想法",
  cases: "有素材",
  ready: "可开写",
};

const priorityLabels: Record<Topic["priority"], string> = {
  soon: "优先",
  later: "稍后",
};

const topicStatusLabels: Record<NonNullable<Topic["status"]>, string> = {
  open: "待写",
  writing: "创作中",
  done: "已完成",
};

const materialColors: Record<Topic["material_status"], string> = {
  idea: "bg-surface-container text-on-surface-variant",
  cases: "bg-amber-500/10 text-amber-800",
  ready: "bg-emerald-500/10 text-emerald-800",
};

function materialProgress(status: Topic["material_status"]) {
  if (status === "ready") return 80;
  if (status === "cases") return 50;
  return 20;
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚编辑";
  if (hours < 24) return `${hours} 小时前编辑`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天编辑";
  return `编辑于 ${new Date(dateStr).toLocaleDateString("zh-CN")}`;
}

export default function TopicsPage() {
  const router = useRouter();
  const { searchQuery } = useShell();
  const { data: items, error, loading, reload } = useBackendQuery(() => api.listTopics(), []);
  const { data: stats } = useBackendQuery(() => api.topicStats(), []);
  const { categories, findByName } = useContentCategories();
  const pillarNames = categories.map((c) => c.name);

  function handlePillarChange(name: string) {
    setPillar(name);
    const cat = findByName(name);
    if (cat?.default_tone) setTone(cat.default_tone);
  }
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState("");
  const [tone, setTone] = useState("温和共情");
  const [filterPillar, setFilterPillar] = useState("全部");
  const [filterSource, setFilterSource] = useState<"全部" | TopicSourceType>("全部");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<TrendInspirationSnapshot | null>(null);
  const [detailTopicId, setDetailTopicId] = useState<string | null>(null);

  const pillarCounts = useMemo(() => {
    const counts: Record<string, number> = { 未分类: 0 };
    pillarNames.forEach((name) => {
      counts[name] = 0;
    });
    (items ?? []).forEach((item) => {
      if (item.content_pillar) {
        counts[item.content_pillar] = (counts[item.content_pillar] ?? 0) + 1;
      } else {
        counts["未分类"] += 1;
      }
    });
    return counts;
  }, [items, pillarNames]);

  const sourceCounts = useMemo(() => {
    const counts: Record<TopicSourceType, number> = {
      direct: 0,
      manual: 0,
      screenshot: 0,
      link: 0,
      trend: 0,
    };
    (items ?? []).forEach((item) => {
      const source = resolveTopicSourceType(item);
      counts[source] += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (filterPillar !== "全部") {
      if (filterPillar === "未分类") {
        list = list.filter((item) => !item.content_pillar);
      } else {
        list = list.filter((item) => item.content_pillar === filterPillar);
      }
    }
    if (filterSource !== "全部") {
      list = list.filter((item) => resolveTopicSourceType(item) === filterSource);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          topicDisplayTitle(item).toLowerCase().includes(q) ||
          item.content_pillar.toLowerCase().includes(q) ||
          item.tone.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, filterPillar, filterSource, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const readyTopics = useMemo(
    () => (items ?? []).filter((t) => t.material_status === "ready").slice(0, 3),
    [items],
  );

  const platformDistribution = useMemo(() => {
    const counts = stats?.by_platform ?? {};
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0) || 1;
    return (Object.keys(platformLabels) as Platform[]).map((key) => ({
      key,
      label: platformLabels[key],
      percent: Math.round(((counts[key] ?? 0) / total) * 100),
    }));
  }, [stats]);

  async function createTopic() {
    if (!title.trim()) return;
    setActionError("");
    try {
      await api.createTopic({
        title: title.trim(),
        content_pillar: pillar,
        direction: "社会观察",
        tone,
        platforms: ["wechat", "xiaohongshu", "douyin"],
        audience: "普通家庭",
        material_status: "idea",
        priority: "soon",
        series: "",
        inspiration: title.trim(),
      });
      setTitle("");
      setPage(1);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function enterStudio(topicId: string) {
    setActionError("");
    try {
      const project = await api.topicToProject(topicId);
      router.push(`/create/${project.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "进入创作室失败");
    }
  }

  async function updateMaterialStatus(id: string, material_status: Topic["material_status"]) {
    setUpdatingId(id);
    setActionError("");
    try {
      await api.updateTopic(id, { material_status });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateContentPillar(id: string, content_pillar: string) {
    setUpdatingId(id);
    setActionError("");
    try {
      await api.updateTopic(id, { content_pillar });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新栏目失败");
    } finally {
      setUpdatingId(null);
    }
  }

  async function updatePriority(id: string, priority: Topic["priority"]) {
    setUpdatingId(id);
    setActionError("");
    try {
      await api.updateTopic(id, { priority });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新优先级失败");
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateSeries(id: string, series: string) {
    setUpdatingId(id);
    setActionError("");
    try {
      await api.updateTopic(id, { series });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新系列失败");
    } finally {
      setUpdatingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除这个选题吗？")) return;
    setActionError("");
    try {
      await api.deleteTopic(id);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-background">
      <aside className="hidden w-64 shrink-0 space-y-10 border-r border-outline-variant/50 bg-surface p-8 xl:block">
        <div>
          <h3 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            内容栏目
          </h3>
          <ul className="space-y-2">
            <li>
              <button
                type="button"
                onClick={() => {
                  setFilterPillar("全部");
                  setPage(1);
                }}
                className={`w-full rounded-xl px-4 py-2.5 text-left text-[15px] transition-colors ${
                  filterPillar === "全部"
                    ? "bg-primary/10 font-bold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                全部选题
              </button>
            </li>
            {pillarNames.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterPillar(name);
                    setPage(1);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-[15px] transition-colors ${
                    filterPillar === name
                      ? "bg-primary/10 font-bold text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <span>{name}</span>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold">
                    {pillarCounts[name] ?? 0}
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setFilterPillar("未分类");
                  setPage(1);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-[15px] transition-colors ${
                  filterPillar === "未分类"
                    ? "bg-primary/10 font-bold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                <span>未分类</span>
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold">
                  {pillarCounts["未分类"] ?? 0}
                </span>
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            来源
          </h3>
          <ul className="space-y-2">
            {topicSourceFilterOptions.map(({ key, label }) => {
              const count = key === "全部" ? (items?.length ?? 0) : sourceCounts[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSource(key);
                      setPage(1);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-[15px] transition-colors ${
                      filterSource === key
                        ? "bg-primary/10 font-bold text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <span>{label}</span>
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold">
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <section className="p-6 pb-4 lg:p-8">
          <div className="mb-8">
            <h2 className="font-headline text-3xl font-semibold text-on-surface lg:text-4xl">选题库</h2>
            <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
              按内容支柱整理选题，热点选题可回看分析详情并进入创作室。
            </p>
          </div>

          <div className="mb-8 max-w-4xl rounded-2xl border border-outline-variant/40 bg-surface p-6 shadow-sm lg:p-8">
            <div className="space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTopic()}
                placeholder="例如：农村老人早逝背后的隐形原因"
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition-all placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex flex-wrap gap-4">
                <CategoryPicker
                  categories={categories}
                  value={pillar}
                  onChange={handlePillarChange}
                  allowEmpty
                  emptyLabel="选择栏目（可选）"
                  className="min-w-[200px]"
                  showHint
                />
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="min-w-[160px] rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="温和共情">温和共情</option>
                  <option value="理性观察">理性观察</option>
                  <option value="温和提醒">温和提醒</option>
                </select>
              </div>
              <button
                type="button"
                onClick={createTopic}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
              >
                保存选题
              </button>
            </div>
          </div>

          {actionError && (
            <p className="mb-6 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-error">
              {actionError}
            </p>
          )}
        </section>

        <section className="px-6 pb-12 lg:px-8">
          {error ? (
            <LoadError message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <p className="text-sm text-on-surface-variant/50">加载中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-on-surface-variant/50">暂无选题，在上方创建第一个吧。</p>
          ) : (
            <div className="space-y-3">
              {paged.map((item) => {
                const progress = materialProgress(item.material_status);
                const displayTitle = topicDisplayTitle(item);
                const hasTrend = Boolean(item.trend_snapshot?.analysis?.why_hot);
                const sourceType = resolveTopicSourceType(item);

                return (
                  <article
                    key={item.id}
                    className="group rounded-2xl border border-outline-variant/30 bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {hasTrend && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                              <Icon name="local_fire_department" className="text-[14px]" />
                              热点选题
                            </span>
                          )}
                          {item.status === "writing" && (
                            <span className="rounded-full bg-secondary-container/60 px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                              {topicStatusLabels.writing}
                            </span>
                          )}
                          <span className="whitespace-nowrap rounded-full bg-surface-container px-2.5 py-0.5 text-[11px] font-medium text-on-surface-variant">
                            {topicSourceLabels[sourceType]}
                          </span>
                          <CategoryPicker
                            categories={categories}
                            value={item.content_pillar}
                            onChange={(name) => void updateContentPillar(item.id, name)}
                            allowEmpty
                            emptyLabel="未分类"
                            size="sm"
                            className="min-w-[120px]"
                          />
                          <span className="text-[11px] text-on-surface-variant/70">
                            {formatRelativeTime(item.updated_at || item.created_at)}
                          </span>
                        </div>

                        <h3 className="long-text-wrap line-clamp-2 text-lg font-semibold leading-snug text-on-surface">
                          {displayTitle}
                        </h3>

                        {item.trend_snapshot?.summary && (
                          <p className="long-text-wrap mt-2 line-clamp-2 text-sm text-on-surface-variant">
                            {item.trend_snapshot.summary}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                          <span>{item.tone}</span>
                          <span className="text-outline-variant">·</span>
                          <select
                            value={item.priority}
                            disabled={updatingId === item.id}
                            onChange={(e) =>
                              void updatePriority(item.id, e.target.value as Topic["priority"])
                            }
                            className="rounded-lg border border-outline-variant/30 bg-surface px-2 py-0.5 text-[11px] font-medium outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {(Object.keys(priorityLabels) as Topic["priority"][]).map((key) => (
                              <option key={key} value={key}>
                                {priorityLabels[key]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            defaultValue={item.series}
                            disabled={updatingId === item.id}
                            placeholder="系列名（可选）"
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next !== (item.series ?? "")) {
                                void updateSeries(item.id, next);
                              }
                            }}
                            className="min-w-[120px] rounded-lg border border-outline-variant/30 bg-surface px-2 py-0.5 text-[11px] outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex gap-1.5">
                            {item.platforms.map((p) => (
                              <span
                                key={p}
                                title={platformLabels[p]}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-low"
                              >
                                <Icon name={platformIcons[p]} className="text-[16px]" />
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                        <div className="flex items-center gap-2">
                          <select
                            value={item.material_status}
                            disabled={updatingId === item.id}
                            onChange={(e) =>
                              void updateMaterialStatus(
                                item.id,
                                e.target.value as Topic["material_status"],
                              )
                            }
                            className={`rounded-lg border-0 px-2.5 py-1 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-primary/20 ${materialColors[item.material_status]}`}
                          >
                            {(Object.keys(materialLabels) as Topic["material_status"][]).map(
                              (key) => (
                                <option key={key} value={key}>
                                  {materialLabels[key]}
                                </option>
                              ),
                            )}
                          </select>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {item.trend_snapshot && (
                            <button
                              type="button"
                              onClick={() => {
                                setDetailTopicId(item.id);
                                setDetailSnapshot(item.trend_snapshot ?? null);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                            >
                              <Icon name="insights" className="text-[16px]" />
                              热点分析
                            </button>
                          )}
                          {item.project_id ? (
                            <Link
                              href={`/create/${item.project_id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-90"
                            >
                              继续编辑
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => enterStudio(item.id)}
                              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-90"
                            >
                              进入创作室
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-error/30 hover:text-error"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              <div className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-5 py-4">
                <span className="text-xs text-on-surface-variant">
                  显示 {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)}，共 {filtered.length} 个选题
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/40 transition-colors hover:bg-surface-container disabled:opacity-40"
                  >
                    <Icon name="chevron_left" className="text-sm" />
                  </button>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary px-2 text-xs font-bold text-on-primary">
                    {safePage}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/40 transition-colors hover:bg-surface-container disabled:opacity-40"
                  >
                    <Icon name="chevron_right" className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col gap-8 border-l border-outline-variant/50 bg-surface p-6 xl:flex">
        <div>
          <h3 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            选题概览
          </h3>
          <div className="rounded-xl bg-surface-container-low p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">热门基调</span>
              <Icon name="trending_up" className="text-sm text-primary" />
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              {stats?.top_tone ? (
                <>
                  当前最多选题使用 <span className="font-bold text-primary">{stats.top_tone}</span>{" "}
                  基调（{stats.by_tone[stats.top_tone]} 个）
                </>
              ) : (
                "暂无统计数据"
              )}
            </p>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            可开写选题
          </h4>
          <div className="space-y-3">
            {readyTopics.length === 0 ? (
              <p className="text-xs text-on-surface-variant/50">暂无素材就绪的选题</p>
            ) : (
              readyTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => enterStudio(topic.id)}
                  className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                    <Icon name="edit_note" className="text-[18px] text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs font-bold">{topicDisplayTitle(topic)}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-on-surface-variant">
                      <Icon name="check_circle" className="text-[10px] text-primary" />
                      素材就绪
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            平台分布
          </h4>
          <div className="space-y-3">
            {platformDistribution.map(({ key, label, percent }) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-bold">{percent}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-container">
                  <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {detailSnapshot && (
        <TrendAnalysisDetailModal
          snapshot={detailSnapshot}
          onClose={() => {
            setDetailSnapshot(null);
            setDetailTopicId(null);
          }}
          onEnterStudio={
            detailTopicId ? () => enterStudio(detailTopicId) : undefined
          }
          onStartWriting={
            detailTopicId
              ? async (idea) => {
                  if (idea) {
                    await api.updateTopic(detailTopicId, { title: idea });
                  }
                  await enterStudio(detailTopicId);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
