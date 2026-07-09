"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryManager } from "@/components/content/CategoryManager";
import { LoadError } from "@/components/ui/LoadError";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { useContentCategories } from "@/hooks/useContentCategories";
import { api } from "@/lib/api";
import type { AuthorStyleProfile } from "@/lib/types";

export default function SettingsPage() {
  const { data: profile, error, loading, reload, setData: setProfile } = useBackendQuery(() =>
    api.getStyleProfile(),
  );
  const {
    categories,
    addCategory,
    updateCategory,
    removeCategory,
    reload: reloadCategories,
  } = useContentCategories();
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
    return <p className="p-8 text-sm text-on-surface-variant/50">加载设置...</p>;
  }

  if (error) {
    return (
      <div className="space-y-4 p-8">
        <h1 className="font-headline text-2xl font-semibold">设置</h1>
        <LoadError message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="font-headline text-2xl font-semibold">设置</h1>
        <p className="text-sm text-on-surface-variant">作者风格档案会影响内容生成的语气与禁用表达。</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5">
        <label className="block text-sm">
          <span className="text-on-surface-variant">账号定位（一句话）</span>
          <input
            value={profile.account_positioning ?? ""}
            onChange={(e) => setProfile({ ...profile, account_positioning: e.target.value })}
            placeholder="例如：帮学生和家长理解 AI 时代的学习与专业选择"
            className="mt-1 w-full rounded-xl border border-outline-variant/30 px-3 py-2 outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-on-surface-variant/70">
            会注入到每次内容生成，帮助保持账号标签清晰、选题不散。
          </p>
        </label>
        <label className="block text-sm">
          <span className="text-on-surface-variant">语气偏好</span>
          <input
            value={profile.tone_preference}
            onChange={(e) => setProfile({ ...profile, tone_preference: e.target.value })}
            className="mt-1 w-full rounded-xl border border-outline-variant/30 px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="text-on-surface-variant">禁用表达（逗号分隔）</span>
          <input
            value={profile.banned_phrases.join("，")}
            onChange={(e) =>
              setProfile({
                ...profile,
                banned_phrases: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
              })
            }
            className="mt-1 w-full rounded-xl border border-outline-variant/30 px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="text-on-surface-variant">个人素材片段（每行一条）</span>
          <textarea
            value={profile.personal_snippets.join("\n")}
            onChange={(e) =>
              setProfile({
                ...profile,
                personal_snippets: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            className="mt-1 min-h-28 w-full rounded-xl border border-outline-variant/30 p-3 outline-none focus:border-primary"
          />
        </label>
        <div className="space-y-3">
          <span className="text-sm text-on-surface-variant">各平台默认风格</span>
          {(
            [
              ["wechat", "公众号（偏故事、段落完整）"],
              ["xiaohongshu", "小红书（短段落、口语化）"],
              ["douyin", "抖音（口播钩子、分镜节奏）"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="text-on-surface-variant/70">{label}</span>
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
                className="mt-1 w-full rounded-xl border border-outline-variant/30 px-3 py-2 outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-primary px-4 py-2 text-sm text-on-primary hover:opacity-90"
        >
          保存风格档案
        </button>
        {saved && <span className="ml-3 text-sm text-primary">已保存</span>}
        {saveError && <p className="text-sm text-error">{saveError}</p>}
      </div>

      <CategoryManager
        categories={categories}
        onAdd={async (payload) => {
          await addCategory(payload);
          await reloadCategories();
        }}
        onUpdate={async (id, payload) => {
          await updateCategory(id, payload);
          await reloadCategories();
        }}
        onRemove={async (id) => {
          await removeCategory(id);
          await reloadCategories();
        }}
      />

      <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-5 text-sm text-on-surface-variant">
        <p className="font-medium">LLM 配置说明</p>
        <p className="mt-2">
          在后端读取根目录 <code>.env</code>，支持 <code>DEEPSEEK_API_KEY</code> 与{" "}
          <code>OPENAI_API_KEY</code>（文案 + gpt-image-2 封面生图）。默认优先使用 DeepSeek，可通过{" "}
          <code>LLM_PROVIDER</code> 切换。栏目写作指引会在{" "}
          <Link href="/drafts" className="text-primary underline">
            草稿箱
          </Link>{" "}
          与创作室中影响初稿生成。
        </p>
      </div>
    </div>
  );
}
