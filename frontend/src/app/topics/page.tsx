"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api, platformLabels } from "@/lib/api";
import type { Platform, Topic } from "@/lib/types";

const PAGE_SIZE = 8;

const pillars = ["农村老人与家庭健康", "消费陷阱与三无产品", "农村环境与普通人风险"];

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
  return `编辑于 ${new Date(dateStr).toLocaleDateString()}`;
}

export default function TopicsPage() {
  const router = useRouter();
  const { searchQuery } = useShell();
  const { data: items, error, loading, reload } = useBackendQuery(() => api.listTopics(), []);
  const { data: stats } = useBackendQuery(() => api.topicStats(), []);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState(pillars[0]);
  const [tone, setTone] = useState("温和共情");
  const [filterPillar, setFilterPillar] = useState("全部");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (filterPillar !== "全部") {
      list = list.filter((item) => item.content_pillar === filterPillar);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.content_pillar.toLowerCase().includes(q) ||
          item.tone.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, filterPillar, searchQuery]);

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
      <div className="flex-1">
        <section className="p-8 pb-4">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <nav className="mb-2 flex items-center gap-2 text-on-surface-variant">
                <span className="text-[10px] font-medium uppercase tracking-widest">Studio</span>
                <Icon name="chevron_right" className="text-xs" />
                <span className="text-[10px] font-medium uppercase tracking-widest">Library</span>
              </nav>
              <h2 className="font-display text-[48px] leading-tight text-on-surface">选题库</h2>
              <p className="mt-2 max-w-xl text-on-surface-variant">
                按内容支柱整理选题，并进入创作室。
              </p>
            </div>
          </div>

          <div className="mb-8 max-w-4xl rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
            <div className="space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTopic()}
                placeholder="例如：农村老人早逝背后的隐形原因"
                className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-on-surface outline-none transition-all placeholder:text-outline focus:border-topic-primary focus:ring-2 focus:ring-topic-primary/20"
              />
              <div className="flex flex-wrap gap-4">
                <select
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-topic-primary"
                >
                  {pillars.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="min-w-[160px] rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-topic-primary"
                >
                  <option value="温和共情">温和共情</option>
                  <option value="理性观察">理性观察</option>
                  <option value="温和提醒">温和提醒</option>
                </select>
              </div>
              <button
                type="button"
                onClick={createTopic}
                className="rounded-lg bg-accent-cta px-6 py-2 font-bold text-white transition-opacity hover:opacity-90"
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

          <div className="mb-8 flex flex-wrap gap-2">
            {["全部", ...pillars].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setFilterPillar(item);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filterPillar === item
                    ? "bg-accent-cta text-white"
                    : "border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="px-8 pb-12">
          {error ? (
            <LoadError message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <p className="text-sm text-on-surface-variant/50">加载中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-on-surface-variant/50">暂无选题，在上方创建第一个吧。</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low">
                    <th className="w-[35%] px-6 py-4 text-[13px] font-medium uppercase tracking-wider text-on-surface-variant">
                      选题标题
                    </th>
                    <th className="px-6 py-4 text-[13px] font-medium uppercase tracking-wider text-on-surface-variant">
                      内容支柱
                    </th>
                    <th className="px-6 py-4 text-[13px] font-medium uppercase tracking-wider text-on-surface-variant">
                      基调
                    </th>
                    <th className="px-6 py-4 text-[13px] font-medium uppercase tracking-wider text-on-surface-variant">
                      平台
                    </th>
                    <th className="px-6 py-4 text-[13px] font-medium uppercase tracking-wider text-on-surface-variant">
                      素材
                    </th>
                    <th className="px-6 py-4 text-right text-[13px] font-medium uppercase tracking-wider text-on-surface-variant">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paged.map((item) => {
                    const progress = materialProgress(item.material_status);
                    return (
                      <tr
                        key={item.id}
                        className="group transition-colors hover:bg-surface-container-lowest"
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold leading-tight text-on-surface">
                              {item.title}
                            </span>
                            <span className="text-xs italic text-on-surface-variant">
                              {formatRelativeTime(item.updated_at || item.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="rounded-full bg-secondary-container px-2.5 py-1 text-[11px] font-bold uppercase tracking-tighter text-on-surface-variant">
                            {item.content_pillar || "未分类"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-sm">{item.tone}</td>
                        <td className="px-6 py-5">
                          <div className="flex gap-2 text-on-surface-variant">
                            {item.platforms.map((p) => (
                              <span key={p} title={platformLabels[p]}>
                                <Icon name={platformIcons[p]} className="text-[18px]" />
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-5">
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
                              className="rounded-lg border border-outline-variant bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-topic-primary"
                            >
                              {(Object.keys(materialLabels) as Topic["material_status"][]).map(
                                (key) => (
                                  <option key={key} value={key}>
                                    {materialLabels[key]}
                                  </option>
                                ),
                              )}
                            </select>
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-container">
                              <div
                                className="h-full bg-topic-primary"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => enterStudio(item.id)}
                              className="rounded-lg bg-topic-primary px-4 py-1.5 text-xs font-bold text-white opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100 hover:opacity-90"
                            >
                              进入创作室
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(item.id)}
                              className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant hover:text-error"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-lowest p-6">
                <span className="text-xs text-on-surface-variant">
                  显示 {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)}，共 {filtered.length} 个选题
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant transition-colors hover:bg-surface-container disabled:opacity-40"
                  >
                    <Icon name="chevron_left" className="text-sm" />
                  </button>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-outline-variant bg-topic-primary px-2 text-xs font-bold text-white">
                    {safePage}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant transition-colors hover:bg-surface-container disabled:opacity-40"
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
            Studio Insight
          </h3>
          <div className="rounded-xl bg-surface-container-low p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">热门基调</span>
              <Icon name="trending_up" className="text-sm text-topic-primary" />
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              {stats?.top_tone ? (
                <>
                  当前最多选题使用 <span className="font-bold text-topic-primary">{stats.top_tone}</span>{" "}
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
                    <Icon name="edit_note" className="text-[18px] text-topic-primary" />
                  </div>
                  <div>
                    <p className="line-clamp-2 text-xs font-bold">{topic.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-on-surface-variant">
                      <Icon name="check_circle" className="text-[10px] text-topic-primary" />
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
                  <div className="h-full bg-on-surface" style={{ width: `${percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
