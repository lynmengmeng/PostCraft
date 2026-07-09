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
  variant?: "select" | "chips";
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
  variant = "select",
}: CategoryPickerProps) {
  const sizeClass = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";
  const active = categories.find((c) => c.name === value);

  if (variant === "chips") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex flex-wrap gap-2">
          {allowEmpty && (
            <CategoryChip
              name={emptyLabel}
              active={!value}
              onClick={() => onChange("")}
            />
          )}
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              name={cat.name}
              active={value === cat.name}
              onClick={() => onChange(cat.name)}
            />
          ))}
        </div>
        {showHint && active && (
          <CategoryHintPanel category={active} />
        )}
      </div>
    );
  }

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
      {showHint && active && <CategoryHintPanel category={active} compact />}
    </div>
  );
}

function CategoryHintPanel({
  category,
  compact = false,
}: {
  category: ContentCategory;
  compact?: boolean;
}) {
  const examples = category.example_topics?.slice(0, 2) ?? [];
  return (
    <div className={`text-xs text-on-surface-variant/70 ${compact ? "mt-1" : "rounded-lg bg-surface-container-low px-3 py-2"}`}>
      {category.prompt_hint && <p>{category.prompt_hint}</p>}
      {category.structure_hint && (
        <p className={category.prompt_hint ? "mt-1" : ""}>结构：{category.structure_hint}</p>
      )}
      {examples.length > 0 && !compact && (
        <p className="mt-1 text-on-surface-variant/50">示例：{examples.join(" · ")}</p>
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
