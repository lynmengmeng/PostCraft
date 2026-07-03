"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { resolveImageUrl } from "@/lib/export";

interface ChatComposerProps {
  message: string;
  onMessageChange: (value: string) => void;
  sending: boolean;
  pendingAttachments: string[];
  onSend: (text: string) => Promise<boolean> | boolean;
  onUploadAsset: (file: File) => void;
}

export function ChatComposer({
  message,
  onMessageChange,
  sending,
  pendingAttachments,
  onSend,
  onUploadAsset,
}: ChatComposerProps) {
  const chatFileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (sending) return;
    const text = message.trim();
    if (!text && pendingAttachments.length === 0) return;
    const ok = await onSend(text);
    if (ok) onMessageChange("");
  }

  return (
    <div className="space-y-3" translate="no">
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingAttachments.map((url) => (
            <div
              key={url}
              className="relative h-14 w-14 overflow-hidden rounded-lg border border-outline-variant/30"
            >
              <img
                src={resolveImageUrl(url)}
                alt="待发送素材"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
          <span className="self-center text-xs text-on-surface-variant">
            已选 {pendingAttachments.length} 张素材，发送后 AI 将处理配图位置
          </span>
        </div>
      )}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="继续打磨初稿、调整配图位置，或上传素材后说明插入位置…"
          className="notranslate h-20 w-full resize-none rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 pr-20 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          translate="no"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          lang="zh-CN"
        />
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => chatFileRef.current?.click()}
            disabled={sending}
            className="pointer-events-auto text-on-surface-variant hover:text-primary disabled:opacity-50"
            title="上传配图素材"
          >
            <Icon name="image" className="text-[20px]" />
          </button>
          <input
            ref={chatFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadAsset(file);
              if (chatFileRef.current) chatFileRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending}
            className="pointer-events-auto text-primary disabled:opacity-50"
          >
            <Icon name="send" className="text-[20px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
