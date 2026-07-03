"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { resolveImageUrl } from "@/lib/export";
import { editableInputClassName, editableInputProps } from "@/lib/editable-input";

interface ChatComposerProps {
  message: string;
  onMessageChange: (value: string) => void;
  sending: boolean;
  pendingAttachments: string[];
  onSend: (text: string) => Promise<boolean> | boolean;
  onUploadAsset: (file: File) => void;
  onRemoveAttachment: (url: string) => void;
  onClearAttachments: () => void;
  onStop: () => void;
}

export function ChatComposer({
  message,
  onMessageChange,
  sending,
  pendingAttachments,
  onSend,
  onUploadAsset,
  onRemoveAttachment,
  onClearAttachments,
  onStop,
}: ChatComposerProps) {
  const chatFileRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const [localMessage, setLocalMessage] = useState(message);
  const localMessageRef = useRef(localMessage);
  localMessageRef.current = localMessage;

  useEffect(() => {
    if (composingRef.current) return;
    if (message !== localMessageRef.current) {
      setLocalMessage(message);
    }
  }, [message]);

  function commitMessage(value: string) {
    setLocalMessage(value);
    onMessageChange(value);
  }

  async function submit() {
    if (sending || composingRef.current) return;
    const text = localMessage.trim();
    if (!text && pendingAttachments.length === 0) return;
    const ok = await onSend(text);
    if (ok) {
      setLocalMessage("");
      onMessageChange("");
    }
  }

  return (
    <div className={`space-y-3 ${editableInputClassName}`} translate="no">
      {pendingAttachments.length > 0 && (
        <div className="space-y-2">
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
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(url)}
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-error/90 text-on-primary"
                  title="移除"
                >
                  <Icon name="close" className="text-[12px]" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-on-surface-variant">
              已选 {pendingAttachments.length} 张素材，发送后 AI 将处理配图位置
            </span>
            <button
              type="button"
              onClick={onClearAttachments}
              className="text-xs text-primary underline"
            >
              清空
            </button>
          </div>
        </div>
      )}
      <div className="relative">
        <textarea
          value={localMessage}
          onChange={(e) => {
            const next = e.target.value;
            setLocalMessage(next);
            if (!composingRef.current) {
              onMessageChange(next);
            }
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            commitMessage(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="继续打磨初稿、调整配图位置，或上传素材后说明插入位置…"
          className={`${editableInputClassName} h-20 w-full resize-none rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 pr-20 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary`}
          {...editableInputProps}
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
          {sending ? (
            <button
              type="button"
              onClick={onStop}
              className="pointer-events-auto text-error"
              title="停止生成（服务端任务可能仍在运行）"
            >
              <Icon name="stop_circle" className="text-[20px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              className="pointer-events-auto text-primary"
            >
              <Icon name="send" className="text-[20px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
