"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api";

type Status = "checking" | "online" | "offline";

interface BackendStatusBannerProps {
  compact?: boolean;
}

export function BackendStatusBanner({ compact = false }: BackendStatusBannerProps) {
  const [status, setStatus] = useState<Status>("checking");
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      await api.health();
      setStatus("online");
      setDismissed(false);
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(check, 15000);
    return () => window.clearInterval(timer);
  }, [check]);

  if (status === "checking" || status === "online" || dismissed) {
    return null;
  }

  if (compact) {
    return (
      <span
        className="cursor-pointer rounded-full bg-error-container px-3 py-1 text-xs font-semibold text-error"
        title={`后端未连接：${API_BASE}`}
        onClick={() => void check()}
      >
        API 离线
      </span>
    );
  }

  return (
    <div className="border-b border-error/20 bg-error-container px-4 py-3 text-sm text-error">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>
          后端 API 未连接（<code className="rounded bg-white/60 px-1">{API_BASE}</code>
          ）。请先运行 <code className="rounded bg-white/60 px-1">npm run dev:backend</code>。
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void check()}
            className="rounded-lg bg-error px-3 py-1.5 text-xs text-white hover:opacity-90"
          >
            重新检测
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-error/30 px-3 py-1.5 text-xs text-error hover:bg-white/40"
          >
            暂时关闭
          </button>
        </div>
      </div>
    </div>
  );
}
