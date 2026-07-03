"use client";

import { Icon } from "@/components/ui/Icon";
import type { MobileStudioPanel } from "@/lib/studio-utils";

interface StudioMobileTabsProps {
  value: MobileStudioPanel;
  onChange: (panel: MobileStudioPanel) => void;
}

const tabs: { id: MobileStudioPanel; label: string; icon: string }[] = [
  { id: "chat", label: "对话", icon: "smart_toy" },
  { id: "edit", label: "编辑", icon: "edit_note" },
  { id: "preview", label: "预览", icon: "visibility" },
];

export function StudioMobileTabs({ value, onChange }: StudioMobileTabsProps) {
  return (
    <nav className="flex shrink-0 border-t border-outline-variant/20 bg-surface-container-lowest md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
            value === tab.id
              ? "font-semibold text-primary"
              : "text-on-surface-variant"
          }`}
        >
          <Icon name={tab.icon} className="text-[20px]" />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
