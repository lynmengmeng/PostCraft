"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, statusLabels } from "@/lib/api";
import type { ContentProject, LLMStatus } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ContentProject[]>([]);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [inspiration, setInspiration] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.listProjects(), api.llmStatus()])
      .then(([projectList, status]) => {
        setProjects(projectList);
        setLlmStatus(status);
      })
      .finally(() => setLoading(false));
  }, []);

  async function createFromInspiration() {
    if (!inspiration.trim()) return;
    setCreating(true);
    try {
      const project = await api.createProject({ inspiration: inspiration.trim() });
      router.push(`/create/${project.id}`);
    } finally {
      setCreating(false);
    }
  }

  const drafts = projects.filter((p) => p.status !== "published");
  const recent = projects.slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-100 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">从灵感到发布的个人内容工作台</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          把生活观察整理成公众号、小红书、抖音内容，通过对话不断打磨至可发布状态。
        </p>
        {llmStatus && (
          <p className="mt-4 text-sm text-stone-600">
            LLM 状态：
            {llmStatus.configured
              ? ` ${llmStatus.provider} / ${llmStatus.model}`
              : " 未配置 API Key（将使用本地模板，请在根目录 .env 配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY）"}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <input
            value={inspiration}
            onChange={(e) => setInspiration(e.target.value)}
            placeholder="输入一句话灵感，例如：农村老人重疾增多，可能和劣质商品、环境污染有关"
            className="min-w-[420px] flex-1 rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none focus:border-amber-400"
          />
          <button
            onClick={createFromInspiration}
            disabled={creating}
            className="rounded-2xl bg-amber-700 px-5 py-3 text-white disabled:opacity-50"
          >
            {creating ? "创建中..." : "开始创作"}
          </button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-medium">待完成草稿</h2>
          {loading ? (
            <p className="mt-4 text-sm text-stone-400">加载中...</p>
          ) : drafts.length === 0 ? (
            <p className="mt-4 text-sm text-stone-400">还没有草稿，从上方输入灵感开始。</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {drafts.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/create/${project.id}`}
                    className="block rounded-xl bg-stone-50 px-4 py-3 hover:bg-stone-100"
                  >
                    <div className="font-medium">{project.title}</div>
                    <div className="text-xs text-stone-500">
                      {statusLabels[project.status]} · {project.inspiration.slice(0, 40)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-medium">最近编辑</h2>
          <ul className="mt-4 space-y-3">
            {recent.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/create/${project.id}`}
                  className="block rounded-xl bg-stone-50 px-4 py-3 hover:bg-stone-100"
                >
                  <div className="font-medium">{project.title}</div>
                  <div className="text-xs text-stone-500">
                    更新于 {new Date(project.updated_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
