"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ContentCategory, WechatLayoutPreset } from "@/lib/types";
import type { ContentCategoryPayload } from "@/lib/api";

interface CategoryManagerProps {
  categories: ContentCategory[];
  onAdd: (payload: ContentCategoryPayload & { name: string }) => Promise<void>;
  onUpdate: (id: string, payload: ContentCategoryPayload) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const layoutOptions: { value: WechatLayoutPreset; label: string }[] = [
  { value: "classic", label: "经典" },
  { value: "lively", label: "活泼" },
  { value: "story", label: "故事" },
  { value: "checklist", label: "清单" },
];

function emptyForm(): ContentCategoryPayload & { name: string } {
  return {
    name: "",
    description: "",
    prompt_hint: "",
    structure_hint: "",
    platform_hints: { wechat: "", xiaohongshu: "", douyin: "" },
    title_style: "",
    cover_mood: "",
    default_layout: "classic",
    default_tone: "温和共情",
    example_topics: [],
  };
}

function categoryToForm(cat: ContentCategory): ContentCategoryPayload & { name: string } {
  return {
    name: cat.name,
    description: cat.description,
    prompt_hint: cat.prompt_hint,
    structure_hint: cat.structure_hint,
    platform_hints: { ...cat.platform_hints },
    title_style: cat.title_style,
    cover_mood: cat.cover_mood,
    default_layout: cat.default_layout,
    default_tone: cat.default_tone,
    example_topics: [...(cat.example_topics ?? [])],
  };
}

export function CategoryManager({
  categories,
  onAdd,
  onUpdate,
  onRemove,
}: CategoryManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const customCategories = categories.filter((c) => !c.builtin);
  const isEditing = editingId !== null;

  function startEdit(cat: ContentCategory) {
    setEditingId(cat.id);
    setForm(categoryToForm(cat));
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload: ContentCategoryPayload & { name: string } = {
        ...form,
        name: form.name.trim(),
        example_topics: (form.example_topics ?? []).filter(Boolean),
      };
      if (isEditing && editingId) {
        await onUpdate(editingId, payload);
        cancelEdit();
      } else {
        await onAdd(payload);
        setForm(emptyForm());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string, label: string) {
    if (!confirm(`确定删除分类「${label}」吗？已有草稿不会自动改分类。`)) return;
    setRemovingId(id);
    setError("");
    try {
      await onRemove(id);
      if (editingId === id) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="text-sm font-semibold">管理内容栏目</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            内置 {categories.filter((c) => c.builtin).length} 个栏目，自定义 {customCategories.length} 个
          </p>
        </div>
        <Icon
          name={expanded ? "expand_less" : "expand_more"}
          className="text-[20px] text-on-surface-variant"
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-outline-variant/20 pt-4">
          <ul className="space-y-3">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="rounded-lg bg-surface-container-low px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.builtin && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          内置
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="mt-0.5 text-xs text-on-surface-variant">{cat.description}</p>
                    )}
                    {cat.structure_hint && (
                      <p className="mt-1 text-[11px] text-on-surface-variant/70">
                        结构：{cat.structure_hint}
                      </p>
                    )}
                    {cat.title_style && (
                      <p className="mt-0.5 text-[11px] text-on-surface-variant/60">
                        标题：{cat.title_style}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="rounded p-1 text-on-surface-variant/50 hover:text-primary"
                      title={cat.builtin ? "自定义覆盖" : "编辑"}
                    >
                      <Icon name="edit" className="text-[18px]" />
                    </button>
                    {!cat.builtin && (
                      <button
                        type="button"
                        onClick={() => void handleRemove(cat.id, cat.name)}
                        disabled={removingId === cat.id}
                        className="rounded p-1 text-on-surface-variant/40 hover:text-error disabled:opacity-50"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-xl border border-outline-variant/20 p-4">
            <p className="text-xs font-semibold text-on-surface-variant">
              {isEditing ? "编辑栏目" : "添加自定义栏目"}
              {isEditing && categories.find((c) => c.id === editingId)?.builtin && (
                <span className="ml-2 font-normal text-on-surface-variant/60">
                  （内置栏目将保存为你的自定义覆盖）
                </span>
              )}
            </p>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="栏目名称"
              disabled={isEditing && categories.find((c) => c.id === editingId)?.builtin}
              className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简短说明"
              className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={form.prompt_hint ?? ""}
              onChange={(e) => setForm({ ...form, prompt_hint: e.target.value })}
              placeholder="初稿写作指引"
              className="min-h-[60px] w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={form.structure_hint ?? ""}
              onChange={(e) => setForm({ ...form, structure_hint: e.target.value })}
              placeholder="文章结构模板"
              className="min-h-[60px] w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {(["wechat", "xiaohongshu", "douyin"] as const).map((platform) => (
                <label key={platform} className="block text-xs">
                  <span className="text-on-surface-variant">
                    {platform === "wechat" ? "公众号" : platform === "xiaohongshu" ? "小红书" : "抖音"}
                  </span>
                  <input
                    value={form.platform_hints?.[platform] ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        platform_hints: {
                          ...form.platform_hints,
                          [platform]: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-outline-variant/30 px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <input
                  value={form.title_style ?? ""}
                  onChange={(e) => setForm({ ...form, title_style: e.target.value })}
                  placeholder="标题风格"
                  className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-on-surface-variant/70">
                  新号冷启动建议优先「搜索关键词 + 人群 + 结果」型标题
                </p>
              </div>
              <input
                value={form.cover_mood ?? ""}
                onChange={(e) => setForm({ ...form, cover_mood: e.target.value })}
                placeholder="配图/封面气质"
                className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="text-on-surface-variant">公众号默认排版</span>
                <select
                  value={form.default_layout ?? "classic"}
                  onChange={(e) =>
                    setForm({ ...form, default_layout: e.target.value as WechatLayoutPreset })
                  }
                  className="mt-1 w-full rounded-lg border border-outline-variant/30 px-2 py-1.5 text-sm outline-none focus:border-primary"
                >
                  {layoutOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={form.default_tone ?? ""}
                onChange={(e) => setForm({ ...form, default_tone: e.target.value })}
                placeholder="默认基调（选题用）"
                className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <textarea
              value={(form.example_topics ?? []).join("\n")}
              onChange={(e) =>
                setForm({
                  ...form,
                  example_topics: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="示例选题（每行一条）"
              className="min-h-[56px] w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-xs text-error">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50"
              >
                {saving ? "保存中..." : isEditing ? "保存修改" : "添加栏目"}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-outline-variant/30 px-4 py-2 text-sm"
                >
                  取消
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
