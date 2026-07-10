"use client";

import { Icon } from "@/components/ui/Icon";

interface DraftStartPanelProps {
  inspiration: string;
  sending: boolean;
  hasPriorChat: boolean;
  onGenerate: () => void;
}

export function DraftStartPanel({
  inspiration,
  sending,
  hasPriorChat,
  onGenerate,
}: DraftStartPanelProps) {
  return (
    <div className="shrink-0 border-b border-outline-variant/10 bg-primary/5 px-4 py-4">
      <div className="flex items-start gap-3">
        <Icon name="edit_note" className="mt-0.5 text-[20px] text-primary" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-on-surface">开始创作观察型初稿</p>
            <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">
              可先在下方对话补充角度、素材或语气要求，再点击生成；也可直接根据灵感撰写初稿。
            </p>
          </div>
          {inspiration.trim() && (
            <p className="rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-[12px] leading-relaxed text-on-surface-variant">
              <span className="font-medium text-on-surface">当前灵感：</span>
              {inspiration.trim().slice(0, 160)}
              {inspiration.trim().length > 160 ? "…" : ""}
            </p>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-on-primary disabled:opacity-50"
          >
            <Icon name="auto_awesome" className="text-[16px]" />
            {hasPriorChat ? "根据对话生成初稿" : "生成观察型初稿"}
          </button>
        </div>
      </div>
    </div>
  );
}
