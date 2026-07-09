"use client";

import type { ContentCategory } from "@/lib/types";

interface CategoryPickerProps {
  categories: ContentCategory[];
  value: string;
  onChange: (name: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  size?: "sm" | "md";
  showHint?: boolean;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "未分类",
  className = "",
  size = "md",
  showHint = false,
}: CategoryPickerProps) {
  const sizeClass = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";
  const active = categories.find((c) => c.name === value);

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-outline-variant/30 bg-surface-container-lowest outline-none transition-colors focus:border-primary ${sizeClass} ${className}`}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {categories.map((cat) => (
          <option key={cat.id} value={cat.name}>
            {cat.name}
          </option>
        ))}
      </select>
      {showHint && active && (active.prompt_hint || active.description) && (
        <p className="text-xs text-on-surface-variant/70">
          {active.prompt_hint || active.description}
        </p>
      )}
    </div>
  );
}

interface CategoryChipProps {
  name: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export function CategoryChip({ name, active, count, onClick }: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant/30 hover:ring-primary/30"
      }`}
    >
      {name}
      {count !== undefined && count > 0 && (
        <span className={`ml-1.5 text-xs ${active ? "text-on-primary/80" : "text-on-surface-variant/60"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
