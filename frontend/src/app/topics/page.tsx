"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Topic } from "@/lib/types";

const pillars = ["农村老人与家庭健康", "消费陷阱与三无产品", "农村环境与普通人风险"];

export default function TopicsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState(pillars[0]);
  const [tone, setTone] = useState("温和共情");
  const [filterPillar, setFilterPillar] = useState("全部");
  const [loading, setLoading] = useState(true);

  async function load() {
    setItems(await api.listTopics());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filterPillar === "全部") return items;
    return items.filter((item) => item.content_pillar === filterPillar);
  }, [items, filterPillar]);

  async function createTopic() {
    if (!title.trim()) return;
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
    await load();
  }

  async function enterStudio(topicId: string) {
    const project = await api.topicToProject(topicId);
    router.push(`/create/${project.id}`);
  }

  async function remove(id: string) {
    if (!confirm("确定删除这个选题吗？")) return;
    await api.deleteTopic(id);
    await load();
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
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={pillar}
            onChange={(e) => setPillar(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
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
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
          >
            <option value="温和共情">温和共情</option>
            <option value="理性观察">理性观察</option>
            <option value="温和提醒">温和提醒</option>
          </select>
        </div>
        <button
          onClick={createTopic}
          className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-sm text-white"
        >
          保存选题
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["全部", ...pillars].map((item) => (
          <button
            key={item}
            onClick={() => setFilterPillar(item)}
            className={`rounded-full px-3 py-1 text-sm ${
              filterPillar === item ? "bg-amber-700 text-white" : "bg-white ring-1 ring-stone-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">加载中...</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-stone-500">
                  {item.content_pillar} · {item.tone}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => enterStudio(item.id)}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white"
                >
                  进入创作室
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-500"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
