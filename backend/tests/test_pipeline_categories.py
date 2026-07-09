"""Tests for content pillar / prompt_hint integration in pipeline."""

from __future__ import annotations

from app.config import get_settings
from app.models.schemas import AuthorStyleProfile, ContentCategory, ContentProject, TopicMeta
from app.services.llm_client import LLMClient
from app.services.pipeline import ContentPipeline
from app.services.repository import (
    BUILTIN_CONTENT_CATEGORIES,
    category_context_block,
    resolve_category,
    resolve_prompt_hint,
    sync_content_pillar,
)
from app.services.skill_loader import SkillLoader


def _pipeline() -> ContentPipeline:
    settings = get_settings()
    return ContentPipeline(LLMClient(settings), SkillLoader(settings))


def test_resolve_prompt_hint_builtin() -> None:
    hint = resolve_prompt_hint("周末出走计划")
    assert "低成本" in hint or "出走" in hint


def test_resolve_category_builtin_fields() -> None:
    cat = resolve_category("便宜但有用")
    assert cat is not None
    assert cat.default_layout == "checklist"
    assert cat.platform_hints.wechat
    assert cat.title_style
    assert cat.cover_mood
    assert cat.example_topics


def test_category_context_block_platform_filter() -> None:
    cat = resolve_category("周末出走计划")
    assert cat is not None
    block = category_context_block(cat, ["xiaohongshu"])
    assert "小红书" in block
    assert "公众号" not in block


def test_category_block_includes_hint() -> None:
    pipeline = _pipeline()
    project = ContentProject(
        inspiration="骑电动车去东西湖大堤",
        content_pillar="周末出走计划",
        topic_meta=TopicMeta(content_pillar="周末出走计划"),
    )
    block = pipeline._category_block(project, BUILTIN_CONTENT_CATEGORIES)
    assert "周末出走计划" in block
    assert "结构要求" in block or "栏目写作指引" in block


def test_default_draft_task_uses_pillar_hint() -> None:
    pipeline = _pipeline()
    project = ContentProject(
        inspiration="测试",
        content_pillar="路上听什么",
    )
    task = pipeline._default_draft_task(project, BUILTIN_CONTENT_CATEGORIES)
    assert "音乐" in task or "场景" in task


def test_resolve_project_category() -> None:
    pipeline = _pipeline()
    project = ContentProject(inspiration="测试", content_pillar="一个小故事")
    cat = pipeline._resolve_project_category(project, BUILTIN_CONTENT_CATEGORIES)
    assert cat is not None
    assert cat.name == "一个小故事"
    assert cat.default_layout == "story"


def test_constraints_block() -> None:
    pipeline = _pipeline()
    block = pipeline._constraints_block(["温和", "shorter"])
    assert "温和" in block
    assert "缩短" in block


def test_sync_content_pillar() -> None:
    project = ContentProject(inspiration="测试", topic_meta=TopicMeta())
    sync_content_pillar(project, "普通人观察")
    assert project.content_pillar == "普通人观察"
    assert project.topic_meta.content_pillar == "普通人观察"


def test_default_image_prompt_with_cover_mood() -> None:
    pipeline = _pipeline()
    prompt = pipeline._default_image_prompt("户外自然光")
    assert "户外自然光" in prompt
    assert "纪实" in prompt
