import type {
  AuthorStyleProfile,
  ContentProject,
  Inspiration,
  LLMStatus,
  Platform,
  RiskWarning,
  Topic,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface ChatResult {
  project: ContentProject;
  assistant_message: { content: string };
  patch?: Record<string, unknown>;
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
  ) => {
    if (!stream) {
      return request<ChatResult>(`/projects/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message, selected_platform: selectedPlatform, stream: false }),
      });
    }

    const response = await fetch(`${API_BASE}/projects/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, selected_platform: selectedPlatform, stream: true }),
    });

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
        if (chunk.startsWith("event: done")) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) return JSON.parse(dataLine.slice(6)) as ChatResult;
        }
      }
    }

    throw new Error("未收到完整流式响应");
  },

  listInspirations: () => request<Inspiration[]>("/inspirations"),
  createInspiration: (content: string, tags: string[] = []) =>
    request<Inspiration>("/inspirations", {
      method: "POST",
      body: JSON.stringify({ content, tags }),
    }),
  inspirationToTopic: (id: string) =>
    request<{ topic: Topic; project: ContentProject }>(`/inspirations/${id}/to-topic`, {
      method: "POST",
    }),
  deleteInspiration: (id: string) =>
    request<{ ok: boolean }>(`/inspirations/${id}`, { method: "DELETE" }),

  listTopics: () => request<Topic[]>("/topics"),
  createTopic: (payload: Omit<Topic, "id" | "created_at" | "updated_at">) =>
    request<Topic>("/topics", {
      method: "POST",
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
