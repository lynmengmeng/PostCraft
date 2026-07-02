import type {
  AuthorStyleProfile,
  ContentProject,
  Inspiration,
  InspirationStats,
  LLMStatus,
  Platform,
  RiskWarning,
  Topic,
  TopicStats,
} from "./types";
import { ApiError, formatApiError, isNetworkFetchError } from "./api-error";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiError(formatApiError(error, API_BASE), {
      cause: error,
      isNetworkError: isNetworkFetchError(error),
    });
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(detail || `请求失败 (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export interface ChatResult {
  project: ContentProject;
  assistant_message: { content: string };
  patch?: Record<string, unknown>;
}

export interface ChatOptions {
  action?: "generate_draft" | "generate_platform" | "generate_all" | "refine_draft" | "layout_images";
  target_platforms?: Platform[];
  attachment_urls?: string[];
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  llmStatus: () => request<LLMStatus>("/llm/status"),

  listProjects: () => request<ContentProject[]>("/projects"),
  getProject: (id: string) => request<ContentProject>(`/projects/${id}`),
  createProject: (payload: {
    title?: string;
    inspiration: string;
    content_pillar?: string;
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
      });
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }

    if (!response.ok || !response.body) {
      throw new Error("流式请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
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
      });
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${id}/chat/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }

    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(detail || "重新生成失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
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
        body: form,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
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
    request<{ topic: Topic; project: ContentProject }>(`/inspirations/${id}/to-topic`, {
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

  getStyleProfile: () => request<AuthorStyleProfile>("/settings/style"),
  updateStyleProfile: (profile: AuthorStyleProfile) =>
    request<AuthorStyleProfile>("/settings/style", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),

  uploadCover: async (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${projectId}/upload-cover`, {
        method: "POST",
        body: form,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
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
    options?: { caption?: string; insertPlaceholder?: boolean },
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("caption", options?.caption ?? "");
    form.append("insert_placeholder", String(options?.insertPlaceholder ?? true));
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/projects/${projectId}/upload-asset`, {
        method: "POST",
        body: form,
      });
    } catch (error) {
      throw new ApiError(formatApiError(error, API_BASE), {
        cause: error,
        isNetworkError: isNetworkFetchError(error),
      });
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Upload failed: ${response.status}`);
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
