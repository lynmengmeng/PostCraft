"use client";

import { useCallback, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { resolveImageUrl } from "@/lib/export";
import { renderChatMarkdown } from "@/lib/markdown";
import type { ChatMessage } from "@/lib/types";

const ATTACHMENT_RE = /\n?\[附件:\s*([^\]]+)\]\s*$/;

function parseUserContent(content: string) {
  const match = content.match(ATTACHMENT_RE);
  if (!match) return { text: content, urls: [] as string[] };
  const urls = match[1].split(",").map((u) => u.trim()).filter(Boolean);
  const text = content.replace(ATTACHMENT_RE, "").trim();
  return { text, urls };
}

interface ChatMessageListProps {
  chatHistory: ChatMessage[];
  sending: boolean;
  streamingText: string;
  regeneratingId: string | null;
  autoDraftPending: boolean;
  onRegenerate: (messageId: string) => void;
}

export function ChatMessageList({
  chatHistory,
  sending,
  streamingText,
  regeneratingId,
  autoDraftPending,
  onRegenerate,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const showTyping = sending && !streamingText && !autoDraftPending;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(frame);
  }, [chatHistory.length, streamingText, sending, autoDraftPending, scrollToBottom]);

  return (
    <div
      ref={scrollRef}
      className="custom-scrollbar min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4"
    >
      {autoDraftPending && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface">
          <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
          正在根据灵感撰写初稿…
        </div>
      )}

      {chatHistory.map((item) =>
        item.role === "user" ? (
          <div key={item.id} className="flex min-w-0 justify-end">
            <div
              className={`long-text-wrap max-w-[88%] min-w-0 rounded-[12px] rounded-tr-none bg-primary/12 px-5 py-3 text-left text-sm leading-relaxed text-on-surface ${
                item.id.startsWith("pending-") ? "opacity-90" : ""
              }`}
            >
              {(() => {
                const { text, urls } = parseUserContent(item.content);
                return (
                  <>
                    {text && <div className="whitespace-pre-wrap">{text}</div>}
                    {urls.length > 0 && (
                      <div className={`flex flex-wrap gap-2 ${text ? "mt-2" : ""}`}>
                        {urls.map((url) => (
                          <img
                            key={url}
                            src={resolveImageUrl(url)}
                            alt="附件"
                            className="h-16 w-16 rounded-lg border border-outline-variant/30 object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {!text && urls.length === 0 && item.content}
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div
            key={item.id}
            className={`group relative min-w-0 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface shadow-sm ${
              regeneratingId === item.id ? "ring-2 ring-primary/30" : ""
            }`}
          >
            <div
              className="chat-markdown prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderChatMarkdown(item.content) }}
            />
            <div className="absolute right-2 top-2 flex opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <button
                type="button"
                onClick={() => onRegenerate(item.id)}
                disabled={sending}
                title="重新生成此回复"
                className="flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface/95 px-2 py-1 text-[11px] text-on-surface-variant shadow-sm backdrop-blur hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <Icon
                  name={regeneratingId === item.id ? "progress_activity" : "refresh"}
                  className={`text-[14px] ${regeneratingId === item.id ? "animate-spin" : ""}`}
                />
                {regeneratingId === item.id ? "生成中" : "重新生成"}
              </button>
            </div>
          </div>
        ),
      )}

      {showTyping && (
        <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant shadow-sm">
          <span className="flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary/60" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary/60 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary/60 [animation-delay:300ms]" />
          </span>
          AI 正在思考…
        </div>
      )}

      {streamingText && (
        <div className="long-text-wrap min-w-0 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface shadow-sm">
          <div
            className="chat-markdown prose prose-sm max-w-none whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderChatMarkdown(streamingText) }}
          />
        </div>
      )}

    </div>
  );
}
