from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def new_id() -> str:
    return str(uuid4())


Platform = Literal["wechat", "xiaohongshu", "douyin"]
ProjectStatus = Literal["draft", "ready", "published"]
PublishStatus = Literal["pending", "published", "skipped"]


class DouyinScene(BaseModel):
    index: int
    duration: str = "3s"
    narration: str = ""
    visual: str = ""
    subtitle: str = ""


class WechatContent(BaseModel):
    title: str = ""
    summary: str = ""
    body: str = ""
    formatted_html: str = ""


class XiaohongshuContent(BaseModel):
    title: str = ""
    body: str = ""
    tags: list[str] = Field(default_factory=list)
    cover_image: str = ""


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


class ChatMessage(BaseModel):
    id: str = Field(default_factory=new_id)
    role: Literal["user", "assistant", "system"] = "user"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


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


class ContentProject(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str = "未命名项目"
    inspiration: str = ""
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
    tags: list[str] = Field(default_factory=list)
    topic_id: str | None = None
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuthorStyleProfile(BaseModel):
    tone_preference: str = "温和观察"
    banned_phrases: list[str] = Field(
        default_factory=lambda: ["震惊", "必看", "赶紧转发", "不看后悔"]
    )
    personal_snippets: list[str] = Field(default_factory=list)
    platform_defaults: dict[str, str] = Field(default_factory=dict)


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
    platforms: dict[str, Any] | None = None
    publish_records: list[PublishRecord] | None = None


class ChatRequest(BaseModel):
    message: str
    selected_platform: Platform = "wechat"
    stream: bool = False


class ApplyTitleRequest(BaseModel):
    title_index: int
    platform: Platform = "wechat"


class RiskWarningItem(BaseModel):
    phrase: str
    suggestion: str
    source: str = "default"


class InspirationCreate(BaseModel):
    content: str
    source_type: Literal["manual", "screenshot", "link"] = "manual"
    tags: list[str] = Field(default_factory=list)


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


class LLMStatus(BaseModel):
    provider: str
    model: str
    configured: bool
