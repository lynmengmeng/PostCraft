"use client";

import { Icon } from "@/components/ui/Icon";
import { platformLabels } from "@/lib/api";
import { ALL_PLATFORMS, hasPlatformContent } from "@/lib/studio-utils";
import type { ContentProject, Platform } from "@/lib/types";

interface CascadeBannerProps {
  project: ContentProject;
  cascading: boolean;
  sending: boolean;
  onDismiss: () => void;
  onCascadeAll: () => void;
  onCascadePlatform: (platform: Platform) => void;
}

export function CascadeBanner({
  project,
  cascading,
  sending,
  onDismiss,
  onCascadeAll,
  onCascadePlatform,
}: CascadeBannerProps) {
  const targets = ALL_PLATFORMS.filter((p) => hasPlatformContent(project, p));

  return (
    <div className="sticky top-0 z-30 shrink-0 border-b border-primary/20 bg-primary/5 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-on-surface">
          <Icon name="sync" className="text-[18px] text-primary" />
          初稿已更新。是否同步到已有平台版本？
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={cascading}
            className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:border-primary disabled:opacity-50"
          >
            仅保留初稿
          </button>
          <button
            type="button"
            onClick={onCascadeAll}
            disabled={cascading || sending || targets.length === 0}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
          >
            {cascading ? "同步中…" : "同步全部平台"}
          </button>
          {targets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onCascadePlatform(p)}
              disabled={cascading || sending}
              className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:border-primary disabled:opacity-50"
            >
              仅{platformLabels[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
