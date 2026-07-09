import type {
  AuthorStyleProfile,
  CategoryPlatformHints,
  ContentCategory,
  ContentProject,
  Inspiration,
  InspirationStats,
  LLMStatus,
  Platform,
  ProjectDraftExport,
  ProjectDraftImportPayload,
  RiskWarning,
  Topic,
  TopicMeta,
  TopicStats,
  TrendAnalysis,
  TrendInspirationSnapshot,
  WechatLayoutPreset,
  TrendItem,
  TrendRelatedItem,
  TrendsBoard,
} from "./types";
import { ApiError, formatApiError, isNetworkFetchError } from "./api-error";
import { authHeaders, clearAuth } from "./auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/api";

function mergeHeaders(init?: RequestInit): HeadersInit {
  return {
    ...authHeaders(),
    ...(init?.headers || {}),
  };
}

function handleUnauthorized(): never {
  clearAuth();
  if (typeof window !== "undefined") {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${redirect}`;
  }
  throw new ApiError("请先登录");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...mergeHeaders(init),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiError(formatApiError(error, API_BASE), {
      cause: error,
      isNetworkError: isNetworkFetchError(error),
    });
  }

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(detail || `请求失败 (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export interface ChatResult {
  project: ContentProject;
  assistant_message: { content: string; id?: string };
  patch?: {
    intent?: string;
    preview_hints?: string[];
    summary?: string;
  };
}

export interface PillarMetrics {
  name: string;
  total: number;
  completed: number;
  multi_platform_rate: number;
}

export interface PillarDistributionItem {
  name: string;
  count: number;
  percent: number;
}

export interface TrialMetricsSummary {
  total_projects: number;
  completed_projects: number;
  completion_rate: number;
  avg_chat_rounds: number;
  multi_platform_rate: number;
  by_pillar: PillarMetrics[];
  pillar_distribution_30d: PillarDistributionItem[];
  pillar_drift_warning: string;
}

export type ContentCategoryPayload = {
  name?: string;
  description?: string;
  prompt_hint?: string;
  structure_hint?: string;
  platform_hints?: Partial<CategoryPlatformHints>;
  title_style?: string;
  cover_mood?: string;
  default_layout?: WechatLayoutPreset;
  default_tone?: string;
  example_topics?: string[];
};

export interface ChatOptions {
  action?: "generate_draft" | "generate_platform" | "generate_all" | "refine_draft" | "layout_images";
  target_platforms?: Platform[];
  attachment_urls?: string[];
  signal?: AbortSignal;
}

export const api = {
  authConfig: () => request<{ auth_required: boolean; allow_register: boolean }>("/auth/config"),
  login: (username: string, password: string) =>
    request<{ access_token: string; user: { id: string; username: string; created_at: string } }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
    ),
  register: (username: string, password: string) =>
    request<{ access_token: string; user: { id: string; username: string; created_at: string } }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
    ),
  me: () =>
    request<{ id: string; username: string; created_at: string }>("/auth/me"),

  health: () => request<{ status: string }>("/health"),
  llmStatus: () => request<LLMStatus>("/llm/status"),

  listProjects: () => request<ContentProject[]>("/projects"),
  getProject: (id: string) => request<ContentProject>(`/projects/${id}`),
  createProject: (payload: {
    title?: string;
    inspiration: string;
    content_pillar?: string;
    topic_meta?: Partial<TopicMeta>;
  }) =>
    request<ContentProject>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProject: (id: string, payload: Partial<ContentProject>) =>
    request<ContentProject>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),

  exportDraftBundle: (id: string) =>
    request<ProjectDraftExport>(`/projects/${id}/export-draft`),
  importDraftBundle: (payload: ProjectDraftImportPayload) =>
    request<ContentProject>("/projects/import-draft", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  applyTitle: (id: string, titleIndex: number, platform: Platform) =>
    request<ContentProject>(`/projects/${id}/apply-title`, {
      method: "POST",
      body: JSON.stringify({ title_index: titleIndex, platform }),
    }),

  restoreVersion: (projectId: string, versionId: string) =>
    request<ContentProject>(`/projects/${projectId}/versions/${versionId}/restore`, {
      method: "POST",
    }),

  factCheck: (id: string) => request<{ warnings: RiskWarning[] }>(`/projects/${id}/fact-check`),

  chat: async (
    id: string,
    message: string,
    selectedPlatform: Platform,
    stream = false,
    onDelta?: (text: string) => void,
    options?: ChatOptions,
  ) => {
    const body = {
      message,
      selected_platform: selectedPlatform,
      stream,
      ...(options?.action ? { action: options.action } : {}),
      ...(options?.target_platforms ? { target_platforms: options.target_platforms } : {}),
      ...(options?.attachment_urls?.length ? { attachment_urls: options.attachment_urls } : {}),
    };
    if (!stream) {
      return request<ChatResult>(`/projects/${id}/chat`, {
        method: "POST",
        body: JSON.stringify(body),
        signal: options?.signal,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }

    if (response.status === 401) {
      handleUnauthorized();
    }

    if (!response.ok || !response.body) {
      throw new Error("流式请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (options?.signal?.aborted) {
        await reader.cancel();
        throw new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        if (chunk.startsWith("event: delta")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(6)) as { text: string };
            onDelta?.(payload.text);
          }
        }
        if (chunk.startsWith("event: error")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(6)) as { message?: string };
            throw new Error(payload.message || "流式请求失败");
          }
        }
        if (chunk.startsWith("event: done")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) return JSON.parse(dataLine.slice(6)) as ChatResult;
        }
      }
    }

    throw new Error("未收到完整流式响应");
  },

  regenerateChat: async (
    id: string,
    assistantMessageId: string,
    selectedPlatform: Platform,
    stream = true,
    onDelta?: (text: string) => void,
    signal?: AbortSignal,
  ) => {
    const body = {
      assistant_message_id: assistantMessageId,
      selected_platform: selectedPlatform,
      stream,
    };
    if (!stream) {
      return request<ChatResult>(`/projects/${id}/chat/regenerate`, {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${id}/chat/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }

    if (response.status === 401) {
      handleUnauthorized();
    }

    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(detail || "重新生成失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        if (chunk.startsWith("event: delta")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(6)) as { text: string };
            onDelta?.(payload.text);
          }
        }
        if (chunk.startsWith("event: error")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(6)) as { message?: string };
            throw new Error(payload.message || "重新生成失败");
          }
        }
        if (chunk.startsWith("event: done")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) return JSON.parse(dataLine.slice(6)) as ChatResult;
        }
      }
    }

    throw new Error("未收到完整流式响应");
  },

  cascadePlatforms: async (
    id: string,
    targetPlatforms: Platform[],
    stream = true,
    onDelta?: (text: string) => void,
    signal?: AbortSignal,
  ) => {
    const body = { target_platforms: targetPlatforms, stream };
    if (!stream) {
      return request<ChatResult>(`/projects/${id}/cascade`, {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${id}/cascade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }

    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok || !response.body) {
      throw new Error("级联同步请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        if (chunk.startsWith("event: delta")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(6)) as { text: string };
            onDelta?.(payload.text);
          }
        }
        if (chunk.startsWith("event: error")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(6)) as { message?: string };
            throw new Error(payload.message || "级联同步失败");
          }
        }
        if (chunk.startsWith("event: done")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) return JSON.parse(dataLine.slice(6)) as ChatResult;
        }
      }
    }

    throw new Error("未收到完整流式响应");
  },

  trialSummary: () => request<TrialMetricsSummary>("/analytics/trial-summary"),

  listInspirations: () => request<Inspiration[]>("/inspirations"),
  inspirationStats: () => request<InspirationStats>("/inspirations/stats"),
  createInspiration: (
    content: string,
    tags: string[] = [],
    options?: { source_type?: Inspiration["source_type"]; source_url?: string; image_url?: string },
  ) =>
    request<Inspiration>("/inspirations", {
      method: "POST",
      body: JSON.stringify({
        content,
        tags,
        source_type: options?.source_type ?? "manual",
        source_url: options?.source_url ?? "",
        image_url: options?.image_url ?? "",
      }),
    }),
  uploadInspirationScreenshot: async (file: File, content = "", tags: string[] = []) => {
    const form = new FormData();
    form.append("file", file);
    form.append("content", content);
    form.append("tags", tags.join(","));
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/inspirations/upload-screenshot`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new ApiError(detail || `请求失败 (${response.status})`);
    }
    return response.json() as Promise<Inspiration>;
  },
  createInspirationFromLink: (url: string, content = "", tags: string[] = []) =>
    request<Inspiration>("/inspirations/from-link", {
      method: "POST",
      body: JSON.stringify({ url, content, tags }),
    }),
  exportInspirations: () =>
    request<{ version: number; exported_at: string; items: Inspiration[] }>("/inspirations/export"),
  importInspirations: (items: Array<{ content: string; tags?: string[]; source_type?: Inspiration["source_type"] }>) =>
    request<{ imported: number }>("/inspirations/import", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((item) => ({
          content: item.content,
          tags: item.tags ?? [],
          source_type: item.source_type ?? "manual",
        })),
      }),
    }),
  updateInspiration: (
    id: string,
    payload: { content?: string; tags?: string[]; is_highlight?: boolean },
  ) =>
    request<Inspiration>(`/inspirations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  inspirationToTopic: (id: string) =>
    request<Topic>(`/inspirations/${id}/to-topic`, {
      method: "POST",
    }),
  inspirationToProject: (id: string) =>
    request<ContentProject>(`/inspirations/${id}/to-project`, {
      method: "POST",
    }),
  deleteInspiration: (id: string) =>
    request<{ ok: boolean }>(`/inspirations/${id}`, { method: "DELETE" }),

  listTopics: () => request<Topic[]>("/topics"),
  topicStats: () => request<TopicStats>("/topics/stats"),
  createTopic: (payload: Omit<Topic, "id" | "created_at" | "updated_at">) =>
    request<Topic>("/topics", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTopic: (id: string, payload: Partial<Omit<Topic, "id" | "created_at" | "updated_at">>) =>
    request<Topic>(`/topics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  topicToProject: (id: string) =>
    request<ContentProject>(`/topics/${id}/to-project`, { method: "POST" }),
  deleteTopic: (id: string) =>
    request<{ ok: boolean }>(`/topics/${id}`, { method: "DELETE" }),

  getTrends: (refresh = false) =>
    request<TrendsBoard>(`/tools/trends${refresh ? "?refresh=true" : ""}`),
  refreshTrends: () =>
    request<TrendsBoard>("/tools/trends/refresh", { method: "POST" }),
  getTrendRelated: (keyword: string, platform?: string) =>
    request<TrendRelatedItem[]>(
      `/tools/trends/related?keyword=${encodeURIComponent(keyword)}${
        platform ? `&platform=${encodeURIComponent(platform)}` : ""
      }`,
    ),
  analyzeTrend: (payload: {
    title: string;
    source?: string;
    summary?: string;
    platform?: string;
  }) =>
    request<TrendAnalysis>("/tools/trends/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  trendToTopic: (payload: {
    title: string;
    inspiration?: string;
    content_pillar?: string;
    tone?: string;
    source_url?: string;
    trend_id?: string;
    cover_headline?: string;
    cover_subheadline?: string;
    trend_snapshot?: TrendInspirationSnapshot;
  }) =>
    request<Topic>("/tools/trends/to-topic", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  trendToProject: (payload: {
    title: string;
    inspiration?: string;
    content_pillar?: string;
    source_url?: string;
    trend_id?: string;
    cover_headline?: string;
    cover_subheadline?: string;
  }) =>
    request<ContentProject>("/tools/trends/to-project", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getStyleProfile: () => request<AuthorStyleProfile>("/settings/style"),
  updateStyleProfile: (profile: AuthorStyleProfile) =>
    request<AuthorStyleProfile>("/settings/style", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),

  listContentCategories: () =>
    request<{ categories: ContentCategory[] }>("/content-categories"),
  createContentCategory: (payload: ContentCategoryPayload & { name: string }) =>
    request<ContentCategory>("/content-categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateContentCategory: (id: string, payload: ContentCategoryPayload) =>
    request<ContentCategory>(`/content-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteContentCategory: (id: string) =>
    request<{ ok: boolean }>(`/content-categories/${id}`, { method: "DELETE" }),

  uploadCover: async (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${projectId}/upload-cover`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Upload failed: ${response.status}`);
    }
    return response.json() as Promise<ContentProject>;
  },

  uploadAsset: async (
    projectId: string,
    file: File,
    options?: { caption?: string; insertPlaceholder?: boolean; assetIndex?: number },
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("caption", options?.caption ?? "");
    form.append("insert_placeholder", String(options?.insertPlaceholder ?? true));
    if (options?.assetIndex != null) {
      form.append("asset_index", String(options.assetIndex));
    }
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${projectId}/upload-asset`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Upload failed: ${response.status}`);
    }
    return response.json() as Promise<ContentProject>;
  },

  generateAssetImage: async (projectId: string, assetIndex: number) => {
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/projects/${projectId}/assets/${assetIndex}/generate`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      );
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Generate failed: ${response.status}`);
    }
    return response.json() as Promise<ContentProject>;
  },

  ensureXiaohongshuCarouselPlan: async (projectId: string) => {
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/projects/${projectId}/xiaohongshu/carousel/generate?plan_only=true`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      );
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Carousel plan failed: ${response.status}`);
    }
    return response.json() as Promise<ContentProject>;
  },

  generateXiaohongshuCarousel: async (projectId: string, options?: { force?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.force) params.set("force", "true");
    const query = params.toString() ? `?${params.toString()}` : "";
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/projects/${projectId}/xiaohongshu/carousel/generate${query}`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      );
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Carousel generate failed: ${response.status}`);
    }
    return response.json() as Promise<ContentProject>;
  },
};

export const platformLabels: Record<Platform, string> = {
  wechat: "公众号",
  xiaohongshu: "小红书",
  douyin: "抖音",
};

export const statusLabels: Record<ContentProject["status"], string> = {
  draft: "草稿",
  ready: "待发布",
  published: "已发布",
};
