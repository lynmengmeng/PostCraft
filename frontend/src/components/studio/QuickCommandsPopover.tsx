"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { quickCommands } from "@/lib/studio-utils";

interface QuickCommandsPopoverProps {
  sending: boolean;
  onSelect: (cmd: string) => void;
}

export function QuickCommandsPopover({ sending, onSelect }: QuickCommandsPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-fit group/quick">
      <button
        type="button"
        disabled={sending}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-[12px] text-on-surface transition-colors hover:bg-outline-variant/30 disabled:opacity-50"
      >
        <Icon name="auto_awesome" className="text-[14px]" />
        快捷指令
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="text-[14px] text-on-surface-variant"
        />
      </button>
      <div
        className={`absolute bottom-full left-0 z-20 w-56 pb-1 transition-opacity ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover/quick:pointer-events-auto group-hover/quick:opacity-100"
        }`}
      >
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-2 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-medium text-on-surface-variant">
            选择快捷指令
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {quickCommands.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(cmd);
                }}
                disabled={sending}
                className="rounded-lg px-2 py-1.5 text-left text-[12px] text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
