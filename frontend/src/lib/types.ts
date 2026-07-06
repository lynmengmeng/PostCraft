export type Platform = "wechat" | "xiaohongshu" | "douyin";
export type ProjectStatus = "draft" | "ready" | "published";

export interface DouyinScene {
  index: number;
  duration: string;
  narration: string;
  visual: string;
  subtitle: string;
}

export type WechatLayoutPreset = "classic" | "lively" | "story" | "checklist";

export interface WechatStyleTheme {
  layout_preset?: WechatLayoutPreset;
  accent: string;
  mood: string;
  heading_style: "border_left" | "underline" | "plain";
  quote_bg: string;
  quote_border: string;
  text_color: string;
  heading_color: string;
}

export interface WechatImagePlacement {
  after_paragraph: number;
  asset_index: number;
  caption: string;
  prompt?: string;
}

export interface WechatContent {
  title: string;
  summary: string;
  body: string;
  cover_headline?: string;
  cover_subheadline?: string;
  formatted_html?: string;
  style_theme?: Partial<WechatStyleTheme>;
  image_placements?: WechatImagePlacement[];
}

export interface XiaohongshuImagePage {
  page: number;
  role: "cover" | "content" | "summary";
  headline: string;
  subheadline?: string;
  body_text?: string;
  prompt?: string;
}

export interface XiaohongshuContent {
  title: string;
  body: string;
  tags: string[];
  cover_image?: string;
  cover_style?: string;
  carousel_images?: string[];
  image_pages?: XiaohongshuImagePage[];
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
  after_paragraph?: number;
  caption?: string;
  asset_index?: number;
  source?: "generated" | "upload" | "placeholder";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  action?: string | null;
  target_platforms?: string[];
  attachment_urls?: string[];
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
  suggested_insert?: string;
  warning_type?: string;
}

export interface PublishRecord {
  id: string;
  platform: Platform;
  published_at?: string | null;
  url: string;
  status: "pending" | "published" | "skipped";
  note: string;
}

export interface ProjectDraftExport {
  version: 1;
  kind: "draft";
  exported_at: string;
  source_env?: string;
  title: string;
  inspiration: string;
  topic_meta: TopicMeta;
  content_pillar: string;
  draft: string;
  humanized: string;
  chat_summary: string;
  chat_summary_through: number;
}

export type ProjectDraftImportPayload = Omit<ProjectDraftExport, "exported_at">;

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

export type TrendSource =
  | "bilibili_hot"
  | "bilibili_popular"
  | "douyin_hot"
  | "douyin_popular"
  | "wechat_hot"
  | "wechat_search"
  | "weibo_hot"
  | "xiaohongshu_hot"
  | "fallback";

export interface TrendItem {
  id: string;
  title: string;
  source: TrendSource;
  source_label: string;
  rank: number;
  heat: number;
  heat_label: string;
  url: string;
  summary: string;
}

export interface WechatInspirationPick {
  trend_id: string;
  title: string;
  source: TrendSource;
  source_label: string;
  heat: number;
  url: string;
  article_title: string;
  angle: string;
  score: number;
}

export interface TrendsBoard {
  items: TrendItem[];
  fetched_at: string | null;
  sources: string[];
  cache_hit: boolean;
  wechat_picks: WechatInspirationPick[];
  saved_trend_ids: string[];
}

export interface TrendRelatedItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  metrics: string;
}

export interface TrendAnalysis {
  why_hot: string;
  account_angle: string;
  topic_ideas: string[];
  platform_tips: Record<string, string>;
  caution: string;
  related: TrendRelatedItem[];
}

export interface LLMStatus {
  provider: string;
  model: string;
  configured: boolean;
}
