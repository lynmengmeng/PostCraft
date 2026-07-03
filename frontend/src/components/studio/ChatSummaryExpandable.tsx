"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface ChatSummaryExpandableProps {
  summary: string;
}

export function ChatSummaryExpandable({ summary }: ChatSummaryExpandableProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group/summary relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-low/50 px-3 py-2 text-left text-xs text-on-surface-variant/80 transition-colors hover:bg-surface-container-low"
      >
        <Icon name="history" className="mt-0.5 shrink-0 text-[14px] text-on-surface-variant/50" />
        <span className={expanded ? "whitespace-pre-wrap" : "line-clamp-2"}>{summary}</span>
        <Icon
          name={expanded ? "expand_less" : "expand_more"}
          className="ml-auto shrink-0 text-[14px] text-on-surface-variant/50"
        />
      </button>
      {!expanded && (
        <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden max-h-48 w-full overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 text-xs leading-relaxed text-on-surface-variant shadow-lg group-hover/summary:block">
          {summary}
        </div>
      )}
    </div>
  );
}
