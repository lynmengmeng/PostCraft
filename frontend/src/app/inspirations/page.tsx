"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";

export default function InspirationsPage() {
  const router = useRouter();
  const { data: items, error, loading, reload } = useBackendQuery(
    () => api.listInspirations(),
    [],
  );
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [actionError, setActionError] = useState("");

  async function createItem() {
    if (!content.trim()) return;
    setActionError("");
    const tags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await api.createInspiration(content.trim(), tags);
      setContent("");
      setTagsInput("");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function convertToTopic(id: string) {
    setActionError("");
    try {
      const result = await api.inspirationToTopic(id);
      router.push(`/create/${result.project.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "转换失败");
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除这条灵感吗？")) return;
    setActionError("");
    try {
      await api.deleteInspiration(id);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">灵感库</h1>
        <p className="text-sm text-stone-500">收集灵感，并一键转为选题进入创作室。</p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录灵感..."
          className="min-h-28 w-full rounded-xl border border-stone-200 p-3 outline-none focus:border-amber-400"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="标签（逗号分隔，如：社会观察, 农村生活）"
          className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
        />
        <button
          onClick={createItem}
          className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-sm text-white"
        >
          保存灵感
        </button>
      </div>
      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}
      {error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : loading ? (
        <p className="text-sm text-stone-400">加载中...</p>
      ) : (
        <div className="grid gap-4">
          {(items ?? []).map((item) => (
            <div key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="whitespace-pre-wrap">{item.content}</p>
              {item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => convertToTopic(item.id)}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white"
                  >
                    一键转选题
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-500 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
