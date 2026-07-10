"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { resolveImageUrl } from "@/lib/export";
import { editableInputClassName, editableInputProps } from "@/lib/editable-input";
import { getChatScopeHint, getChatScopePlaceholder, type ChatScope } from "@/lib/studio-utils";
import type { Platform } from "@/lib/types";
import { platformLabels } from "@/lib/api";

interface ChatComposerProps {
  message: string;
  onMessageChange: (value: string) => void;
  sending: boolean;
  hasDraft: boolean;
  pendingAttachments: string[];
  chatScope: ChatScope;
  onChatScopeChange: (scope: ChatScope) => void;
  onSend: (text: string) => Promise<boolean> | boolean;
  onUploadAsset: (file: File) => void;
  onRemoveAttachment: (url: string) => void;
  onClearAttachments: () => void;
  onStop: () => void;
}

const draftScope: { key: ChatScope; label: string } = { key: "draft", label: "初稿" };
const platformScopes: { key: ChatScope; label: string }[] = (
  ["wechat", "xiaohongshu", "douyin"] as Platform[]
).map((key) => ({ key, label: platformLabels[key] }));
const allScope: { key: ChatScope; label: string } = { key: "all", label: "全平台" };

export function ChatComposer({
  message,
  onMessageChange,
  sending,
  hasDraft,
  pendingAttachments,
  chatScope,
  onChatScopeChange,
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

  const scopeHint = getChatScopeHint(chatScope, hasDraft);
  const placeholder = getChatScopePlaceholder(chatScope, hasDraft);

  return (
    <div className={`space-y-3 ${editableInputClassName}`} translate="no">
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-on-surface-variant">修改范围</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChatScopeChange(draftScope.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              chatScope === draftScope.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/30"
            }`}
          >
            {draftScope.label}
          </button>
          <span className="text-[10px] text-on-surface-variant/50">|</span>
          {platformScopes.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChatScopeChange(key)}
              disabled={!hasDraft}
              title={!hasDraft ? "请先生成初稿" : undefined}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                chatScope === key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/30"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChatScopeChange(allScope.key)}
            disabled={!hasDraft}
            title={!hasDraft ? "请先生成初稿" : undefined}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              chatScope === allScope.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/30"
            }`}
          >
            {allScope.label}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">{scopeHint}</p>
      </div>
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
          placeholder={placeholder}
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
