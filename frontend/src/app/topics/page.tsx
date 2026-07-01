"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Topic } from "@/lib/types";

const pillars = ["农村老人与家庭健康", "消费陷阱与三无产品", "农村环境与普通人风险"];

export default function TopicsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState(pillars[0]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setItems(await api.listTopics());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTopic() {
    if (!title.trim()) return;
    await api.createTopic({
      title: title.trim(),
      content_pillar: pillar,
      direction: "社会观察",
      tone: "温和共情",
      platforms: ["wechat", "xiaohongshu", "douyin"],
      audience: "普通家庭",
      material_status: "idea",
      priority: "soon",
      series: "",
      inspiration: title.trim(),
    });
    setTitle("");
    await load();
  }

  async function enterStudio(topicId: string) {
    const project = await api.topicToProject(topicId);
    router.push(`/create/${project.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">选题库</h1>
        <p className="text-sm text-stone-500">按内容支柱整理选题，并进入创作室。</p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：农村老人早逝背后的隐形原因"
          className="w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-amber-400"
        />
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value)}
          className="mt-3 rounded-xl border border-stone-200 px-3 py-2 text-sm"
        >
          {pillars.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          onClick={createTopic}
          className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-sm text-white"
        >
          保存选题
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-stone-400">加载中...</p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-stone-500">{item.content_pillar}</div>
              </div>
              <button
                onClick={() => enterStudio(item.id)}
                className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white"
              >
                进入创作室
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
