"use client";

import type { EditorTab } from "@/components/studio/ContentEditor";
import { Icon } from "@/components/ui/Icon";
import { platformLabels } from "@/lib/api";
import { ALL_PLATFORMS, hasPlatformContent, platformIcons } from "@/lib/studio-utils";
import type { ContentProject } from "@/lib/types";

interface PreviewPlatformTabsProps {
  editorTab: EditorTab;
  project: ContentProject;
  onSelectTab: (tab: EditorTab) => void;
}

export function PreviewPlatformTabs({ editorTab, project, onSelectTab }: PreviewPlatformTabsProps) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1 border-b border-outline-variant/10 bg-surface-container-low/30 px-3 py-2">
      <button
        type="button"
        onClick={() => onSelectTab("draft")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
          editorTab === "draft"
            ? "bg-primary/12 font-semibold text-primary"
            : "text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        <Icon name="edit_note" className="text-[16px]" />
        初稿
      </button>
      {ALL_PLATFORMS.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelectTab(item)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
            editorTab === item
              ? "bg-primary/12 font-semibold text-primary"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <Icon name={platformIcons[item]} className="text-[16px]" />
          {platformLabels[item]}
          {hasPlatformContent(project, item) && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
