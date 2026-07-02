"use client";

interface LoadErrorProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function LoadError({ message, onRetry, compact }: LoadErrorProps) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-error"
          : "rounded-2xl border border-error/20 bg-error-container p-5"
      }
    >
      <p className={compact ? "" : "text-sm font-medium text-error"}>{message}</p>
      {!compact && (
        <p className="mt-2 text-sm text-error/80">
          后端默认地址为 <code className="rounded bg-white/60 px-1">http://localhost:8082/api</code>
          ，可通过 frontend/.env.local 中的 <code className="rounded bg-white/60 px-1">NEXT_PUBLIC_API_URL</code>{" "}
          修改。
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`rounded-lg bg-error text-white hover:opacity-90 ${
            compact ? "mt-2 px-3 py-1 text-xs" : "mt-4 px-4 py-2 text-sm"
          }`}
        >
          重试
        </button>
      )}
    </div>
  );
}
