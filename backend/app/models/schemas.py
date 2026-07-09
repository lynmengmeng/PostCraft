from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def new_id() -> str:
    return str(uuid4())


Platform = Literal["wechat", "xiaohongshu", "douyin"]
WechatLayoutPreset = Literal["classic", "lively", "story", "checklist"]
ProjectStatus = Literal["draft", "ready", "published"]
PublishStatus = Literal["pending", "published", "skipped"]


class DouyinScene(BaseModel):
    index: int
    duration: str = "3s"
    narration: str = ""
    visual: str = ""
    subtitle: str = ""


class WechatStyleTheme(BaseModel):
    layout_preset: WechatLayoutPreset = "classic"
    accent: str = "#455548"
    mood: str = "warm"
    heading_style: str = "border_left"
    quote_bg: str = "#faf8f5"
    quote_border: str = "#d4a574"
    text_color: str = "#3f3f3f"
    heading_color: str = "#1a1c1b"


class WechatImagePlacement(BaseModel):
    after_paragraph: int = 0
    asset_index: int = 0
    caption: str = ""
    prompt: str = ""


class WechatContent(BaseModel):
    title: str = ""
    summary: str = ""
    body: str = ""
    formatted_html: str = ""
    style_theme: WechatStyleTheme = Field(default_factory=WechatStyleTheme)
    image_placements: list[WechatImagePlacement] = Field(default_factory=list)
    cover_headline: str = ""
    cover_subheadline: str = ""


class XiaohongshuImagePage(BaseModel):
    page: int = 1
    role: Literal["cover", "content", "summary"] = "content"
    headline: str = ""
    subheadline: str = ""
    body_text: str = ""
    prompt: str = ""


class XiaohongshuContent(BaseModel):
    title: str = ""
    body: str = ""
    tags: list[str] = Field(default_factory=list)
    cover_image: str = ""
    cover_style: str = ""
    carousel_images: list[str] = Field(default_factory=list)
    image_pages: list[XiaohongshuImagePage] = Field(default_factory=list)


class DouyinContent(BaseModel):
    hook: str = ""
    script: list[DouyinScene] = Field(default_factory=list)
    duration: str = "90s"


class TopicMeta(BaseModel):
    direction: str = "社会观察"
    tone: str = "温和共情"
    audience: str = "普通家庭"
    platforms: list[Platform] = Field(default_factory=lambda: ["wechat", "xiaohongshu", "douyin"])
    content_pillar: str = ""
    series: str = ""


class TitleCandidate(BaseModel):
    text: str
    style: str = "情绪共鸣型"
    applied: bool = False


class CoverAsset(BaseModel):
    id: str = Field(default_factory=new_id)
    platform: Platform | Literal["all"] = "all"
    headline: str = ""
    subheadline: str = ""
    prompt: str = ""
    image_url: str = ""
    after_paragraph: int = -1
    caption: str = ""
    asset_index: int = 0
    source: Literal["generated", "upload", "placeholder"] = "placeholder"


class ChatMessage(BaseModel):
    id: str = Field(default_factory=new_id)
    role: Literal["user", "assistant", "system"] = "user"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    action: str | None = None
    target_platforms: list[str] = Field(default_factory=list)
    attachment_urls: list[str] = Field(default_factory=list)


class ChangeRecord(BaseModel):
    path: str
    action: Literal["replace", "replace_section", "append", "merge"] = "replace"
    section: str | None = None
    before_preview: str | None = None
    after_preview: str | None = None


class ContentPatch(BaseModel):
    intent: str
    target_platforms: list[Platform | Literal["all"]] = Field(default_factory=list)
    summary: str
    changes: list[ChangeRecord] = Field(default_factory=list)
    patch: dict[str, Any] = Field(default_factory=dict)
    preview_hints: list[str] = Field(default_factory=list)


class ProjectVersion(BaseModel):
    id: str = Field(default_factory=new_id)
    label: str = ""
    snapshot: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PublishRecord(BaseModel):
    id: str = Field(default_factory=new_id)
    platform: Platform
    published_at: datetime | None = None
    url: str = ""
    status: PublishStatus = "pending"
    note: str = ""


ProjectSourceType = Literal["direct", "topic", "inspiration", "trend"]
TopicStatus = Literal["open", "writing", "done"]


class ContentProject(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str = "未命名项目"
    inspiration: str = ""
    topic_id: str | None = None
    topic_title: str = ""
    source_type: ProjectSourceType = "direct"
    source_url: str = ""
    image_url: str = ""
    trend_snapshot: "TrendInspirationSnapshot | None" = None
    topic_meta: TopicMeta = Field(default_factory=TopicMeta)
    draft: str = ""
    humanized: str = ""
    platforms: dict[str, WechatContent | XiaohongshuContent | DouyinContent] = Field(
        default_factory=lambda: {
            "wechat": WechatContent(),
            "xiaohongshu": XiaohongshuContent(),
            "douyin": DouyinContent(),
        }
    )
    titles: list[TitleCandidate] = Field(default_factory=list)
    cover_assets: list[CoverAsset] = Field(default_factory=list)
    chat_history: list[ChatMessage] = Field(default_factory=list)
    chat_summary: str = ""
    chat_summary_through: int = 0
    versions: list[ProjectVersion] = Field(default_factory=list)
    status: ProjectStatus = "draft"
    publish_records: list[PublishRecord] = Field(default_factory=list)
    content_pillar: str = ""
    risk_warnings: list[RiskWarningItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Inspiration(BaseModel):
    id: str = Field(default_factory=new_id)
    content: str
    source_type: Literal["manual", "screenshot", "link"] = "manual"
    source_url: str = ""
    image_url: str = ""
    is_highlight: bool = False
    tags: list[str] = Field(default_factory=list)
    topic_id: str | None = None
    trend_snapshot: "TrendInspirationSnapshot | None" = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Topic(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str
    content_pillar: str = ""
    direction: str = "社会观察"
    tone: str = "温和共情"
    platforms: list[Platform] = Field(default_factory=lambda: ["wechat", "xiaohongshu", "douyin"])
    audience: str = "普通家庭"
    material_status: Literal["idea", "cases", "ready"] = "idea"
    priority: Literal["soon", "later"] = "soon"
    series: str = ""
    inspiration: str = ""
    source_type: Literal["direct", "manual", "screenshot", "link", "trend"] = "direct"
    source_url: str = ""
    image_url: str = ""
    trend_snapshot: TrendInspirationSnapshot | None = None
    project_id: str | None = None
    status: TopicStatus = "open"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuthorStyleProfile(BaseModel):
    tone_preference: str = "温和观察"
    account_positioning: str = ""
    banned_phrases: list[str] = Field(
        default_factory=lambda: ["震惊", "必看", "赶紧转发", "不看后悔"]
    )
    personal_snippets: list[str] = Field(default_factory=list)
    platform_defaults: dict[str, str] = Field(default_factory=dict)


class CategoryPlatformHints(BaseModel):
    wechat: str = ""
    xiaohongshu: str = ""
    douyin: str = ""


class ContentCategory(BaseModel):
    id: str
    name: str
    description: str = ""
    prompt_hint: str = ""
    structure_hint: str = ""
    platform_hints: CategoryPlatformHints = Field(default_factory=CategoryPlatformHints)
    title_style: str = ""
    cover_mood: str = ""
    default_layout: WechatLayoutPreset = "classic"
    default_tone: str = "温和共情"
    example_topics: list[str] = Field(default_factory=list)
    builtin: bool = False


class ContentCategoryCreate(BaseModel):
    name: str
    description: str = ""
    prompt_hint: str = ""
    structure_hint: str = ""
    platform_hints: CategoryPlatformHints | None = None
    title_style: str = ""
    cover_mood: str = ""
    default_layout: WechatLayoutPreset = "classic"
    default_tone: str = "温和共情"
    example_topics: list[str] = Field(default_factory=list)


class ContentCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    prompt_hint: str | None = None
    structure_hint: str | None = None
    platform_hints: CategoryPlatformHints | None = None
    title_style: str | None = None
    cover_mood: str | None = None
    default_layout: WechatLayoutPreset | None = None
    default_tone: str | None = None
    example_topics: list[str] | None = None


class ContentCategoriesResponse(BaseModel):
    categories: list[ContentCategory]


class ProjectCreate(BaseModel):
    title: str | None = None
    inspiration: str = ""
    topic_meta: TopicMeta | None = None
    content_pillar: str = ""


class ProjectUpdate(BaseModel):
    title: str | None = None
    inspiration: str | None = None
    topic_meta: TopicMeta | None = None
    status: ProjectStatus | None = None
    content_pillar: str | None = None
    draft: str | None = None
    humanized: str | None = None
    platforms: dict[str, Any] | None = None
    cover_assets: list[CoverAsset] | None = None
    publish_records: list[PublishRecord] | None = None


class ProjectDraftExport(BaseModel):
    version: Literal[1] = 1
    kind: Literal["draft"] = "draft"
    exported_at: datetime = Field(default_factory=datetime.utcnow)
    source_env: str = ""
    title: str
    inspiration: str
    topic_meta: TopicMeta = Field(default_factory=TopicMeta)
    content_pillar: str = ""
    draft: str = ""
    humanized: str = ""
    chat_summary: str = ""
    chat_summary_through: int = 0


class ProjectDraftImportPayload(BaseModel):
    version: Literal[1] = 1
    kind: Literal["draft"] = "draft"
    source_env: str = ""
    title: str = "未命名项目"
    inspiration: str = ""
    topic_meta: TopicMeta = Field(default_factory=TopicMeta)
    content_pillar: str = ""
    draft: str = ""
    humanized: str = ""
    chat_summary: str = ""
    chat_summary_through: int = 0


class ChatRequest(BaseModel):
    message: str = ""
    selected_platform: Platform = "wechat"
    stream: bool = False
    action: Literal[
        "",
        "generate_draft",
        "generate_platform",
        "generate_all",
        "refine_draft",
        "layout_images",
    ] | None = None
    target_platforms: list[Platform] | None = None
    attachment_urls: list[str] = Field(default_factory=list)


class RegenerateChatRequest(BaseModel):
    assistant_message_id: str
    selected_platform: Platform = "wechat"
    stream: bool = False


class ApplyTitleRequest(BaseModel):
    title_index: int
    platform: Platform = "wechat"


class RiskWarningItem(BaseModel):
    phrase: str
    suggestion: str
    source: str = "default"
    suggested_insert: str = ""
    warning_type: str = "default"


class CascadeRequest(BaseModel):
    target_platforms: list[Platform] = Field(
        default_factory=lambda: ["wechat", "xiaohongshu", "douyin"]
    )
    stream: bool = False


class PillarMetrics(BaseModel):
    name: str
    total: int
    completed: int
    multi_platform_rate: float


class PillarDistributionItem(BaseModel):
    name: str
    count: int
    percent: float


class TrialMetricsSummary(BaseModel):
    total_projects: int
    completed_projects: int
    completion_rate: float
    avg_chat_rounds: float
    multi_platform_rate: float
    by_pillar: list[PillarMetrics] = Field(default_factory=list)
    pillar_distribution_30d: list[PillarDistributionItem] = Field(default_factory=list)
    pillar_drift_warning: str = ""


class InspirationCreate(BaseModel):
    content: str
    source_type: Literal["manual", "screenshot", "link"] = "manual"
    source_url: str = ""
    image_url: str = ""
    tags: list[str] = Field(default_factory=list)


class InspirationUpdate(BaseModel):
    content: str | None = None
    tags: list[str] | None = None
    is_highlight: bool | None = None


class InspirationFromLink(BaseModel):
    url: str
    content: str = ""
    tags: list[str] = Field(default_factory=list)


class InspirationImportPayload(BaseModel):
    items: list[InspirationCreate]


class InspirationStats(BaseModel):
    total: int
    by_source: dict[str, int]
    highlight_count: int


class TopicUpdate(BaseModel):
    title: str | None = None
    content_pillar: str | None = None
    direction: str | None = None
    tone: str | None = None
    platforms: list[Platform] | None = None
    audience: str | None = None
    material_status: Literal["idea", "cases", "ready"] | None = None
    priority: Literal["soon", "later"] | None = None
    series: str | None = None
    inspiration: str | None = None
    source_type: Literal["direct", "manual", "screenshot", "link", "trend"] | None = None
    source_url: str | None = None
    image_url: str | None = None
    project_id: str | None = None
    status: TopicStatus | None = None


class TopicStats(BaseModel):
    total: int
    by_tone: dict[str, int]
    by_platform: dict[str, int]
    by_material_status: dict[str, int]
    top_tone: str | None = None


class TopicCreate(BaseModel):
    title: str
    content_pillar: str = ""
    direction: str = "社会观察"
    tone: str = "温和共情"
    platforms: list[Platform] = Field(default_factory=lambda: ["wechat", "xiaohongshu", "douyin"])
    audience: str = "普通家庭"
    material_status: Literal["idea", "cases", "ready"] = "idea"
    priority: Literal["soon", "later"] = "soon"
    series: str = ""
    inspiration: str = ""
    source_type: Literal["direct", "manual", "screenshot", "link", "trend"] = "direct"
    source_url: str = ""
    image_url: str = ""
    trend_snapshot: TrendInspirationSnapshot | None = None


class LLMStatus(BaseModel):
    provider: str
    model: str
    configured: bool


TrendSource = Literal[
    "bilibili_hot",
    "bilibili_popular",
    "douyin_hot",
    "douyin_popular",
    "wechat_hot",
    "wechat_search",
    "weibo_hot",
    "xiaohongshu_hot",
    "fallback",
]


class TrendItem(BaseModel):
    id: str
    title: str
    source: TrendSource = "bilibili_hot"
    source_label: str = ""
    rank: int = 0
    heat: float = 0
    heat_label: str = ""
    url: str = ""
    summary: str = ""


class WechatInspirationPick(BaseModel):
    trend_id: str
    title: str
    source: TrendSource = "wechat_hot"
    source_label: str = ""
    heat: float = 0
    url: str = ""
    article_title: str = ""
    angle: str = ""
    score: float = 0


class TrendsBoardResponse(BaseModel):
    items: list[TrendItem] = Field(default_factory=list)
    fetched_at: datetime | None = None
    sources: list[str] = Field(default_factory=list)
    cache_hit: bool = False
    wechat_picks: list[WechatInspirationPick] = Field(default_factory=list)
    saved_trend_ids: list[str] = Field(default_factory=list)


class TrendRelatedItem(BaseModel):
    title: str
    url: str = ""
    source: str = ""
    summary: str = ""
    metrics: str = ""


class TrendAnalysisRequest(BaseModel):
    title: str
    source: str = ""
    summary: str = ""
    platform: str = ""


class TrendAnalysis(BaseModel):
    why_hot: str = ""
    account_angle: str = ""
    topic_ideas: list[str] = Field(default_factory=list)
    platform_tips: dict[str, str] = Field(default_factory=dict)
    caution: str = ""
    related: list[TrendRelatedItem] = Field(default_factory=list)


class TrendInspirationSnapshot(BaseModel):
    trend_id: str = ""
    title: str = ""
    source_label: str = ""
    summary: str = ""
    url: str = ""
    analysis: TrendAnalysis = Field(default_factory=TrendAnalysis)


class TrendToTopicRequest(BaseModel):
    title: str
    inspiration: str = ""
    content_pillar: str = "热点观察"
    tone: str = "温和共情"
    source_url: str = ""
    trend_id: str = ""
    cover_headline: str = ""
    cover_subheadline: str = ""
    trend_snapshot: TrendInspirationSnapshot | None = None


class UserPublic(BaseModel):
    id: str
    username: str
    created_at: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class AuthConfig(BaseModel):
    auth_required: bool
    allow_register: bool
