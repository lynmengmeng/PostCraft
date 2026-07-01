"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Inspiration } from "@/lib/types";

export default function InspirationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Inspiration[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setItems(await api.listInspirations());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem() {
    if (!content.trim()) return;
    await api.createInspiration(content.trim());
    setContent("");
    await load();
  }

  async function convertToTopic(id: string) {
    const result = await api.inspirationToTopic(id);
    router.push(`/create/${result.project.id}`);
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
        <button
          onClick={createItem}
          className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-sm text-white"
        >
          保存灵感
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-stone-400">加载中...</p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="whitespace-pre-wrap">{item.content}</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</p>
                <button
                  onClick={() => convertToTopic(item.id)}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white"
                >
                  一键转选题
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
