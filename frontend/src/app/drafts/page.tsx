"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, platformLabels, statusLabels } from "@/lib/api";
import type { ContentProject, Platform, PublishRecord } from "@/lib/types";

type Tab = "all" | "ready" | "published";

export default function DraftsPage() {
  const [projects, setProjects] = useState<ContentProject[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({ platform: "wechat" as Platform, url: "", note: "" });

  useEffect(() => {
    api.listProjects().then(setProjects).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (tab === "ready") return projects.filter((p) => p.status === "ready");
    if (tab === "published") return projects.filter((p) => p.status === "published");
    return projects;
  }, [projects, tab]);

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
    setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setActiveId(null);
    setForm({ platform: "wechat", url: "", note: "" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">草稿箱与发布清单</h1>
        <p className="text-sm text-stone-500">管理草稿、待发布内容与手动发布记录。</p>
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
              tab === key ? "bg-amber-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">加载中...</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((project) => (
            <div key={project.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/create/${project.id}`} className="text-lg font-medium hover:text-amber-700">
                    {project.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">{project.inspiration.slice(0, 100)}</p>
                  <p className="mt-2 text-xs text-stone-400">
                    {statusLabels[project.status]} · 更新于 {new Date(project.updated_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setActiveId(activeId === project.id ? null : project.id)}
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white"
                >
                  填写发布记录
                </button>
              </div>

              {activeId === project.id && (
                <div className="mt-4 grid gap-3 rounded-xl bg-stone-50 p-4 md:grid-cols-4">
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
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
                    className="rounded-lg border border-stone-200 px-3 py-2 text-sm md:col-span-2"
                  />
                  <button
                    onClick={() => savePublishRecord(project)}
                    className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white"
                  >
                    保存
                  </button>
                </div>
              )}

              {(project.publish_records || []).length > 0 && (
                <div className="mt-4 rounded-xl bg-stone-50 p-3 text-sm">
                  <div className="font-medium text-stone-600">发布记录</div>
                  <ul className="mt-2 space-y-1 text-stone-600">
                    {project.publish_records.map((record) => (
                      <li key={record.id}>
                        {platformLabels[record.platform]} · {record.status}
                        {record.published_at ? ` · ${new Date(record.published_at).toLocaleString()}` : ""}
                        {record.url ? ` · ${record.url}` : ""}
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
