export class ApiError extends Error {
  readonly isNetworkError: boolean;

  constructor(message: string, options?: { cause?: unknown; isNetworkError?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.isNetworkError = options?.isNetworkError ?? false;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch");
}

export function formatApiError(error: unknown, apiBase?: string): string {
  if (error instanceof ApiError) return error.message;
  if (isNetworkFetchError(error)) {
    const base = apiBase ?? "后端 API";
    return `无法连接 ${base}。请确认已在另一终端运行：npm run dev:backend`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请稍后重试";
}
