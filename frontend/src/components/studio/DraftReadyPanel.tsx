"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { platformLabels } from "@/lib/api";
import { ALL_PLATFORMS } from "@/lib/studio-utils";
import type { Platform } from "@/lib/types";

const STORAGE_KEY = "postcraft:draft-panel-open";

interface DraftReadyPanelProps {
  sending: boolean;
  onGenerate: (target: Platform | "all") => void;
}

export function DraftReadyPanel({ sending, onGenerate }: DraftReadyPanelProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container-low/50">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
          <Icon name="check_circle" className="text-[16px] text-primary" />
          初稿已就绪 · 生成平台内容
        </span>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="text-[18px] text-on-surface-variant"
        />
      </button>
      {open && (
        <div className="border-t border-outline-variant/10 px-4 pb-4 pt-2">
          <p className="mb-3 text-[12px] leading-relaxed text-on-surface-variant">
            继续对话可打磨初稿。满意后，再按需生成各平台内容。
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onGenerate(item)}
                disabled={sending}
                className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                生成{platformLabels[item]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onGenerate("all")}
              disabled={sending}
              className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-on-primary disabled:opacity-50"
            >
              一键生成三平台
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
