export type Platform = "wechat" | "xiaohongshu" | "douyin";
export type ProjectStatus = "draft" | "ready" | "published";

export interface DouyinScene {
  index: number;
  duration: string;
  narration: string;
  visual: string;
  subtitle: string;
}

export interface WechatContent {
  title: string;
  summary: string;
  body: string;
  formatted_html?: string;
}

export interface XiaohongshuContent {
  title: string;
  body: string;
  tags: string[];
  cover_image?: string;
}

export interface DouyinContent {
  hook: string;
  script: DouyinScene[];
  duration: string;
}

export interface TopicMeta {
  direction: string;
  tone: string;
  audience: string;
  platforms: Platform[];
  content_pillar?: string;
  series?: string;
}

export interface TitleCandidate {
  text: string;
  style: string;
  applied?: boolean;
}

export interface CoverAsset {
  id: string;
  platform: Platform | "all";
  headline: string;
  subheadline: string;
  prompt: string;
  image_url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ProjectVersion {
  id: string;
  label: string;
  created_at: string;
}

export interface RiskWarning {
  phrase: string;
  suggestion: string;
  source: string;
}

export interface PublishRecord {
  id: string;
  platform: Platform;
  published_at?: string | null;
  url: string;
  status: "pending" | "published" | "skipped";
  note: string;
}

export interface ContentProject {
  id: string;
  title: string;
  inspiration: string;
  topic_meta: TopicMeta;
  draft: string;
  humanized: string;
  platforms: {
    wechat: WechatContent;
    xiaohongshu: XiaohongshuContent;
    douyin: DouyinContent;
  };
  titles: TitleCandidate[];
  cover_assets: CoverAsset[];
  chat_history: ChatMessage[];
  chat_summary?: string;
  chat_summary_through?: number;
  versions?: ProjectVersion[];
  status: ProjectStatus;
  publish_records: PublishRecord[];
  content_pillar: string;
  risk_warnings?: RiskWarning[];
  created_at: string;
  updated_at: string;
}

export interface Inspiration {
  id: string;
  content: string;
  source_type: "manual" | "screenshot" | "link";
  source_url?: string;
  image_url?: string;
  is_highlight?: boolean;
  tags: string[];
  created_at: string;
}

export interface InspirationStats {
  total: number;
  by_source: Record<string, number>;
  highlight_count: number;
}

export interface TopicStats {
  total: number;
  by_tone: Record<string, number>;
  by_platform: Record<string, number>;
  by_material_status: Record<string, number>;
  top_tone: string | null;
}

export interface Topic {
  id: string;
  title: string;
  content_pillar: string;
  direction: string;
  tone: string;
  platforms: Platform[];
  audience: string;
  material_status: "idea" | "cases" | "ready";
  priority: "soon" | "later";
  series: string;
  inspiration: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorStyleProfile {
  tone_preference: string;
  banned_phrases: string[];
  personal_snippets: string[];
  platform_defaults: Record<string, string>;
}

export interface LLMStatus {
  provider: string;
  model: string;
  configured: boolean;
}
