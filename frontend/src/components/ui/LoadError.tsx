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
          ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          : "rounded-2xl border border-red-200 bg-red-50 p-5"
      }
    >
      <p className={compact ? "" : "text-sm font-medium text-red-900"}>{message}</p>
      {!compact && (
        <p className="mt-2 text-sm text-red-700">
          后端默认地址为 <code className="rounded bg-red-100 px-1">http://localhost:8082/api</code>
          ，可通过 frontend/.env.local 中的 <code className="rounded bg-red-100 px-1">NEXT_PUBLIC_API_URL</code>{" "}
          修改。
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`rounded-lg bg-red-800 text-white hover:bg-red-900 ${
            compact ? "mt-2 px-3 py-1 text-xs" : "mt-4 px-4 py-2 text-sm"
          }`}
        >
          重试
        </button>
      )}
    </div>
  );
}
