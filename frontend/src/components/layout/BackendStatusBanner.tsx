"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api";

type Status = "checking" | "online" | "offline";

export function BackendStatusBanner() {
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

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>
          后端 API 未连接（<code className="rounded bg-amber-100 px-1">{API_BASE}</code>
          ）。请先运行 <code className="rounded bg-amber-100 px-1">npm run dev:backend</code>，或执行{" "}
          <code className="rounded bg-amber-100 px-1">npm run dev</code> 同时启动前后端。
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void check()}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs text-white hover:bg-amber-900"
          >
            重新检测
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
          >
            暂时关闭
          </button>
        </div>
      </div>
    </div>
  );
}
