"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadError } from "@/components/ui/LoadError";
import { useShell } from "@/components/layout/AppShell";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api, platformLabels, statusLabels } from "@/lib/api";
import type { ContentProject, Platform, PublishRecord } from "@/lib/types";

type Tab = "all" | "ready" | "published";

export function DraftsPageClient() {
  const { searchQuery } = useShell();
  const {
    data: projects,
    error,
    loading,
    reload,
    setData: setProjects,
  } = useBackendQuery(() => api.listProjects(), []);
  const [tab, setTab] = useState<Tab>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({ platform: "wechat" as Platform, url: "", note: "" });

  const filtered = useMemo(() => {
    let list = projects ?? [];
    if (tab === "ready") list = list.filter((p) => p.status === "ready");
    if (tab === "published") list = list.filter((p) => p.status === "published");
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.inspiration.toLowerCase().includes(q) ||
          (p.content_pillar ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [projects, tab, searchQuery]);

  async function deleteProject(id: string) {
    await api.deleteProject(id);
    setProjects((prev) => (prev ?? []).filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function savePublishRecord(project: ContentProject) {
    const record: PublishRecord = {
      id: crypto.randomUUID(),
      platform: form.platform,
      published_at: new Date().toISOString(),
      url: form.url,
      status: "published",
      note: form.note,
    };
    const updated = await api.updateProject(project.id, {
      status: "published",
      publish_records: [...(project.publish_records || []), record],
    });
    setProjects((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)));
    setActiveId(null);
    setForm({ platform: "wechat", url: "", note: "" });
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-headline text-2xl font-semibold">草稿箱与发布清单</h1>
        <p className="text-sm text-on-surface-variant">管理草稿、待发布内容与手动发布记录。</p>
      </div>

      <div className="flex gap-2">
        {([
          ["all", "全部"],
          ["ready", "待发布"],
          ["published", "已发布"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : loading ? (
        <p className="text-sm text-on-surface-variant/50">加载中...</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((project) => (
            <div key={project.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/create/${project.id}`} className="font-headline text-lg font-medium hover:text-primary">
                    {project.title}
                  </Link>
                  <p className="mt-1 text-sm text-on-surface-variant">{project.inspiration.slice(0, 100)}</p>
                  <p className="mt-2 text-xs text-on-surface-variant/60">
                    {statusLabels[project.status]} · 更新于 {new Date(project.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <button
                    onClick={() => setActiveId(activeId === project.id ? null : project.id)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm text-on-primary"
                  >
                    填写发布记录
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`确定删除「${project.title}」吗？此操作不可恢复。`)) {
                        deleteProject(project.id);
                      }
                    }}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:border-error/20 hover:bg-error-container hover:text-error"
                  >
                    删除
                  </button>
                </div>
              </div>

              {activeId === project.id && (
                <div className="mt-4 grid gap-3 rounded-xl bg-surface-container-low p-4 md:grid-cols-4">
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
                    className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                  >
                    {(Object.keys(platformLabels) as Platform[]).map((platform) => (
                      <option key={platform} value={platform}>
                        {platformLabels[platform]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="发布链接（可选）"
                    className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                  />
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="备注"
                    className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => savePublishRecord(project)}
                    className="rounded-lg bg-primary px-3 py-2 text-sm text-on-primary"
                  >
                    保存
                  </button>
                </div>
              )}

              {(project.publish_records || []).length > 0 && (
                <div className="mt-4 rounded-xl bg-surface-container-low p-3 text-sm">
                  <div className="font-medium text-on-surface-variant">发布记录</div>
                  <ul className="mt-2 space-y-1 text-on-surface-variant">
                    {project.publish_records.map((record) => (
                      <li key={record.id}>
                        {platformLabels[record.platform]} · {record.status}
                        {record.published_at ? ` · ${new Date(record.published_at).toLocaleString()}` : ""}
                        {record.url ? ` · ${record.url}` : ""}
                        {record.note ? ` · 备注：${record.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
