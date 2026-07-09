"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ContentCategory } from "@/lib/types";

interface CategoryManagerProps {
  categories: ContentCategory[];
  onAdd: (payload: { name: string; description?: string; prompt_hint?: string }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function CategoryManager({ categories, onAdd, onRemove }: CategoryManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promptHint, setPromptHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const customCategories = categories.filter((c) => !c.builtin);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onAdd({
        name: name.trim(),
        description: description.trim() || undefined,
        prompt_hint: promptHint.trim() || undefined,
      });
      setName("");
      setDescription("");
      setPromptHint("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
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
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2"
              >
                <div className="min-w-0">
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
                  {cat.prompt_hint && (
                    <p className="mt-1 text-[11px] text-on-surface-variant/60">
                      写作指引：{cat.prompt_hint.slice(0, 80)}
                      {cat.prompt_hint.length > 80 ? "…" : ""}
                    </p>
                  )}
                </div>
                {!cat.builtin && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(cat.id, cat.name)}
                    disabled={removingId === cat.id}
                    className="shrink-0 text-on-surface-variant/40 hover:text-error disabled:opacity-50"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={(e) => void handleAdd(e)} className="space-y-2">
            <p className="text-xs font-semibold text-on-surface-variant">添加自定义栏目</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="栏目名称，例如：租房生活"
              className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短说明（可选）"
              className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={promptHint}
              onChange={(e) => setPromptHint(e.target.value)}
              placeholder="写作指引（可选，会影响 AI 生成初稿的方向）"
              className="min-h-[72px] w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-xs text-error">{error}</p>}
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50"
            >
              {saving ? "添加中..." : "添加栏目"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
