"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api, statusLabels } from "@/lib/api";
import type { ContentProject } from "@/lib/types";

function getWeekLabel(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

function getMiniCalendarDays(date = new Date()) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function projectProgress(status: ContentProject["status"]) {
  if (status === "published") return 100;
  if (status === "ready") return 80;
  return 45;
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  return new Date(dateStr).toLocaleString();
}

function DraftCard({
  project,
  onDelete,
}: {
  project: ContentProject;
  onDelete: (id: string) => void;
}) {
  return (
    <Link
      href={`/create/${project.id}`}
      className="group cursor-pointer rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 transition-all hover:border-outline hover:shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex flex-wrap gap-2">
          {project.content_pillar && (
            <span className="rounded bg-on-surface-variant/5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-tighter text-on-surface-variant">
              {project.content_pillar}
            </span>
          )}
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-tighter ${
              project.status === "ready"
                ? "bg-secondary-container/50 text-on-surface-variant"
                : "bg-primary/10 text-primary"
            }`}
          >
            {statusLabels[project.status]}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`确定删除「${project.title}」吗？`)) onDelete(project.id);
          }}
          className="text-on-surface-variant/30 transition-colors hover:text-error"
        >
          <Icon name="delete" className="text-[18px]" />
        </button>
      </div>
      <h4 className="font-headline mb-2 text-lg font-bold">{project.title}</h4>
      <p className="line-clamp-2 text-[15px] text-on-surface-variant/80">
        {project.inspiration.slice(0, 120)}
      </p>
      <div className="mt-4 flex items-center gap-2 text-on-surface-variant/40">
        <Icon name="schedule" className="text-[16px]" />
        <span className="text-[13px] font-semibold">{formatRelativeTime(project.updated_at)}</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { zenMode, setZenMode, searchQuery } = useShell();
  const {
    data: boot,
    error,
    loading,
    reload,
    setData: setBoot,
  } = useBackendQuery(
    async () => {
      const [projectList, status] = await Promise.all([api.listProjects(), api.llmStatus()]);
      return { projects: projectList, llmStatus: status };
    },
    [],
  );
  const projects = boot?.projects ?? [];
  const llmStatus = boot?.llmStatus ?? null;
  const [inspiration, setInspiration] = useState("");
  const [quickInspiration, setQuickInspiration] = useState("");
  const [savingInspiration, setSavingInspiration] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  async function createFromInspiration() {
    if (!inspiration.trim()) return;
    setCreating(true);
    setActionError("");
    try {
      const project = await api.createProject({ inspiration: inspiration.trim() });
      router.push(`/create/${project.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function saveQuickInspiration() {
    if (!quickInspiration.trim()) return;
    setSavingInspiration(true);
    setActionError("");
    try {
      await api.createInspiration(quickInspiration.trim());
      setQuickInspiration("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingInspiration(false);
    }
  }

  async function deleteProject(id: string) {
    await api.deleteProject(id);
    setBoot((prev) =>
      prev ? { ...prev, projects: prev.projects.filter((item) => item.id !== id) } : prev,
    );
  }

  const matchProject = (project: ContentProject) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      project.title.toLowerCase().includes(q) ||
      project.inspiration.toLowerCase().includes(q) ||
      (project.content_pillar ?? "").toLowerCase().includes(q)
    );
  };

  const drafts = projects.filter((p) => p.status !== "published" && matchProject(p));
  const recent = projects.filter(matchProject).slice(0, 6);
  const latestProject = projects[0];
  const calendarDays = getMiniCalendarDays();
  const todayKey = new Date().toDateString();

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background">
      {/* Workbench */}
      <section className="custom-scrollbar flex-1 overflow-y-auto px-gutter py-10">
        <div className="mx-auto max-w-[860px] space-y-10">
          {error && <LoadError message={error} onRetry={() => void reload()} compact />}
          {actionError && (
            <p className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-error">
              {actionError}
            </p>
          )}

          {/* Hero */}
          <div className="space-y-6 rounded-2xl border border-[#fde6d2] bg-[#fff8f1] p-10">
            <div className="space-y-2">
              <h2 className="font-headline text-[32px] leading-tight text-on-background">
                从灵感到发布
              </h2>
              <p className="text-[15px] text-on-surface-variant/80">
                把生活观察整理成文章、笔记或视频脚本，通过对话不断打磨至可发布状态。
              </p>
              {llmStatus && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    LLM 状态
                  </span>
                  <span className="text-[12px] text-on-surface-variant/70">
                    {llmStatus.configured
                      ? `${llmStatus.provider} / ${llmStatus.model}`
                      : "未配置 API Key（将使用本地模板）"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <input
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFromInspiration()}
                placeholder="输入一句话灵感，例如：农村老人重疾增多，可能和劣质商品、环境污染有关"
                className="flex-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-6 py-4 text-[17px] shadow-sm outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={createFromInspiration}
                disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-accent-cta px-8 font-bold text-white shadow-md transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "创建中..." : "开始创作"}
              </button>
            </div>
          </div>

          {/* Today's Inspiration */}
          <div className="space-y-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-widest text-on-surface-variant">
                  今日灵感
                </h3>
                <p className="mt-1 text-[13px] text-on-surface-variant/60">
                  随手记录，稍后在灵感库整理或转为选题。
                </p>
              </div>
              <Link
                href="/inspirations"
                className="flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
              >
                打开灵感库
                <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
            <div className="flex gap-4">
              <input
                value={quickInspiration}
                onChange={(e) => setQuickInspiration(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveQuickInspiration()}
                placeholder="例如：村里老人用的三无保健品越来越多"
                className="flex-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-[15px] outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={saveQuickInspiration}
                disabled={savingInspiration}
                className="rounded-lg bg-inverse-surface px-6 font-bold text-inverse-on-surface transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingInspiration ? "保存中..." : "存入灵感库"}
              </button>
            </div>
          </div>

          {/* Dual columns */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-headline text-[20px] font-bold">待完成草稿</h3>
              {loading ? (
                <p className="text-sm text-on-surface-variant/50">加载中...</p>
              ) : drafts.length === 0 ? (
                <p className="text-sm text-on-surface-variant/50">还没有草稿，从上方输入灵感开始。</p>
              ) : (
                <div className="space-y-3">
                  {drafts.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="group flex items-start gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-4 transition-colors hover:bg-surface-container-low"
                    >
                      <Link href={`/create/${project.id}`} className="min-w-0 flex-1">
                        <h4 className="mb-1 truncate font-bold">{project.title}</h4>
                        <p className="line-clamp-1 text-[13px] text-on-surface-variant/70">
                          {statusLabels[project.status]} · {project.inspiration.slice(0, 60)}
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`确定删除「${project.title}」吗？`)) deleteProject(project.id);
                        }}
                        className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-[12px] font-bold opacity-0 transition-all group-hover:opacity-100 hover:border-error/20 hover:bg-error/5 hover:text-error"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-headline text-[20px] font-bold">最近编辑</h3>
              {recent.length === 0 ? (
                <p className="text-sm text-on-surface-variant/50">暂无最近编辑</p>
              ) : (
                <div className="space-y-3">
                  {recent.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="group flex items-start gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-4 transition-colors hover:bg-surface-container-low"
                    >
                      <Link href={`/create/${project.id}`} className="min-w-0 flex-1">
                        <h4 className="mb-1 truncate font-bold">{project.title}</h4>
                        <p className="text-[13px] text-on-surface-variant/70">
                          更新于 {new Date(project.updated_at).toLocaleString()}
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`确定删除「${project.title}」吗？`)) deleteProject(project.id);
                        }}
                        className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-[12px] font-bold opacity-0 transition-all group-hover:opacity-100 hover:border-error/20 hover:bg-error/5 hover:text-error"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* All recent activity */}
          {recent.length > 0 && (
            <div className="space-y-6 pt-6">
              <div className="flex items-end justify-between border-b border-outline-variant/30 pb-4">
                <h3 className="font-headline text-2xl font-medium">全部最近动态</h3>
                <Link href="/drafts" className="text-[13px] font-semibold text-primary underline">
                  查看草稿箱
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {recent.map((project) => (
                  <DraftCard key={project.id} project={project} onDelete={deleteProject} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Inspector */}
      <aside
        className={`hidden w-80 shrink-0 flex-col gap-10 border-l border-outline-variant bg-surface px-6 py-10 transition-transform duration-500 xl:flex ${
          zenMode ? "translate-x-full" : "translate-x-0"
        }`}
      >
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-on-surface-variant">
            发布概览
          </h3>
          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold">第 {getWeekLabel()} 周</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
                <div key={label} className="text-[10px] opacity-40">
                  {label}
                </div>
              ))}
              {calendarDays.map((d) => {
                const isToday = d.toDateString() === todayKey;
                const hasDraft = drafts.some(
                  (p) => new Date(p.updated_at).toDateString() === d.toDateString(),
                );
                return (
                  <div
                    key={d.toISOString()}
                    className={`relative flex aspect-square items-center justify-center ${
                      isToday ? "rounded-full border border-primary/20 bg-primary/10" : ""
                    }`}
                  >
                    <span
                      className={`text-[11px] ${isToday ? "font-bold text-primary" : "opacity-70"}`}
                    >
                      {d.getDate()}
                    </span>
                    {hasDraft && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <p className="text-[12px] text-on-surface-variant">
                  草稿 <span className="font-bold">{drafts.length}</span> 篇
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                <p className="text-[12px] text-on-surface-variant">
                  待发布{" "}
                  <span className="font-bold">
                    {projects.filter((p) => p.status === "ready").length}
                  </span>{" "}
                  篇
                </p>
              </div>
            </div>
          </div>
        </div>

        {latestProject && (
          <div className="space-y-4">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-on-surface-variant">
              当前项目
            </h3>
            <div className="space-y-3 rounded-lg border border-outline-variant/30 bg-surface-container p-5">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant/60">
                最近编辑
              </p>
              <h5 className="font-headline text-[18px]">{latestProject.title}</h5>
              <p className="text-[13px] leading-relaxed text-on-surface-variant">
                {latestProject.inspiration.slice(0, 100)}
              </p>
              <div className="pt-2">
                <div className="mb-1 flex items-center justify-between text-[12px] font-semibold">
                  <span>进度</span>
                  <span>{projectProgress(latestProject.status)}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${projectProgress(latestProject.status)}%` }}
                  />
                </div>
              </div>
              <Link
                href={`/create/${latestProject.id}`}
                className="inline-block text-[13px] font-semibold text-primary hover:underline"
              >
                继续编辑 →
              </Link>
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-outline-variant pt-6">
          <button
            type="button"
            onClick={() => setZenMode(!zenMode)}
            className="group flex w-full items-center justify-between rounded-xl bg-surface-container px-4 py-3 transition-colors hover:bg-surface-container-high"
          >
            <div className="flex items-center gap-3">
              <Icon
                name="visibility_off"
                className="text-[20px] text-on-surface-variant group-hover:text-primary"
              />
              <span className="text-[13px] font-semibold">专注模式</span>
            </div>
            <div
              className={`relative h-4 w-8 rounded-full transition-colors ${zenMode ? "bg-primary" : "bg-outline-variant/40"}`}
            >
              <div
                className={`absolute top-1 h-2 w-2 rounded-full bg-white transition-all ${zenMode ? "left-5" : "left-1"}`}
              />
            </div>
          </button>
          <p className="mt-3 text-center text-[11px] opacity-40">隐藏侧栏与顶栏，专注写作</p>
        </div>
      </aside>
    </div>
  );
}
