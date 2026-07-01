"use client";

import Link from "next/link";
import { useState } from "react";
import { statusLabels } from "@/lib/api";
import type { ContentProject } from "@/lib/types";

interface ProjectListItemProps {
  project: ContentProject;
  subtitle?: string;
  onDelete: (id: string) => Promise<void>;
}

export function ProjectListItem({ project, subtitle, onDelete }: ProjectListItemProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`确定删除「${project.title}」吗？此操作不可恢复。`)) return;
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="group flex items-stretch gap-2">
      <Link
        href={`/create/${project.id}`}
        className="block min-w-0 flex-1 rounded-xl bg-stone-50 px-4 py-3 hover:bg-stone-100"
      >
        <div className="font-medium">{project.title}</div>
        <div className="text-xs text-stone-500">
          {subtitle ||
            `${statusLabels[project.status]} · ${project.inspiration.slice(0, 40)}`}
        </div>
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        title="删除草稿"
        className="shrink-0 rounded-xl border border-stone-200 px-3 text-sm text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {deleting ? "…" : "删除"}
      </button>
    </div>
  );
}
