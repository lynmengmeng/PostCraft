"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface StudioTitleEditorProps {
  title: string;
  onSave: (title: string) => Promise<void>;
}

export function StudioTitleEditor({ title, onSave }: StudioTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) {
      setDraft(title);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      setDraft(title);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          onBlur={() => void commit()}
          disabled={saving}
          className="min-w-0 rounded-lg border border-primary/40 bg-surface px-2 py-1 font-headline text-base font-semibold outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <h1 className="truncate font-headline font-semibold">{title}</h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="编辑标题"
        className="shrink-0 rounded p-1 text-on-surface-variant/50 hover:bg-surface-container-low hover:text-primary"
      >
        <Icon name="edit" className="text-[16px]" />
      </button>
    </div>
  );
}
