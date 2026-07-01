"use client";

import { useEffect, useState } from "react";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";
import type { AuthorStyleProfile } from "@/lib/types";

export default function SettingsPage() {
  const { data: profile, error, loading, reload, setData: setProfile } = useBackendQuery(() =>
    api.getStyleProfile(),
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save() {
    if (!profile) return;
    setSaveError("");
    try {
      const updated = await api.updateStyleProfile(profile);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-400">加载设置...</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">设置</h1>
        <LoadError message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">设置</h1>
        <p className="text-sm text-stone-500">作者风格档案会影响内容生成的语气与禁用表达。</p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <label className="block text-sm">
          <span className="text-stone-600">语气偏好</span>
          <input
            value={profile.tone_preference}
            onChange={(e) => setProfile({ ...profile, tone_preference: e.target.value })}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-600">禁用表达（逗号分隔）</span>
          <input
            value={profile.banned_phrases.join("，")}
            onChange={(e) =>
              setProfile({
                ...profile,
                banned_phrases: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
              })
            }
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-600">个人素材片段（每行一条）</span>
          <textarea
            value={profile.personal_snippets.join("\n")}
            onChange={(e) =>
              setProfile({
                ...profile,
                personal_snippets: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            className="mt-1 min-h-28 w-full rounded-xl border border-stone-200 p-3"
          />
        </label>
        <div className="space-y-3">
          <span className="text-sm text-stone-600">各平台默认风格</span>
          {(
            [
              ["wechat", "公众号（偏故事、段落完整）"],
              ["xiaohongshu", "小红书（短段落、口语化）"],
              ["douyin", "抖音（口播钩子、分镜节奏）"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="text-stone-500">{label}</span>
              <input
                value={profile.platform_defaults[key] || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    platform_defaults: {
                      ...profile.platform_defaults,
                      [key]: e.target.value,
                    },
                  })
                }
                placeholder="例如：开头用个人经历，少堆数据"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
          ))}
        </div>
        <button onClick={save} className="rounded-xl bg-amber-700 px-4 py-2 text-sm text-white">
          保存风格档案
        </button>
        {saved && <span className="ml-3 text-sm text-green-600">已保存</span>}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      </div>
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">
        <p className="font-medium">LLM 配置说明</p>
        <p className="mt-2">
          在后端读取根目录 <code>.env</code>，支持 <code>DEEPSEEK_API_KEY</code> 与{" "}
          <code>OPENAI_API_KEY</code>（文案 + DALL-E 封面生图）。默认优先使用 DeepSeek，可通过{" "}
          <code>LLM_PROVIDER</code> 切换。
        </p>
      </div>
    </div>
  );
}
