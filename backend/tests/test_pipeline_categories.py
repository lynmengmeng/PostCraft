"""Tests for content pillar / prompt_hint integration in pipeline."""

from __future__ import annotations

from app.config import get_settings
from app.models.schemas import AuthorStyleProfile, ContentProject, TopicMeta
from app.services.llm_client import LLMClient
from app.services.pipeline import ContentPipeline
from app.services.repository import resolve_prompt_hint, sync_content_pillar
from app.services.skill_loader import SkillLoader


def _pipeline() -> ContentPipeline:
    settings = get_settings()
    return ContentPipeline(LLMClient(settings), SkillLoader(settings))


def test_resolve_prompt_hint_builtin() -> None:
    hint = resolve_prompt_hint("周末出走计划")
    assert "低成本" in hint or "出走" in hint


def test_category_block_includes_hint() -> None:
    pipeline = _pipeline()
    project = ContentProject(
        inspiration="骑电动车去东西湖大堤",
        content_pillar="周末出走计划",
        topic_meta=TopicMeta(content_pillar="周末出走计划"),
    )
    block = pipeline._category_block(project)
    assert "周末出走计划" in block
    assert "栏目写作指引" in block


def test_default_draft_task_uses_pillar_hint() -> None:
    pipeline = _pipeline()
    project = ContentProject(
        inspiration="测试",
        content_pillar="路上听什么",
    )
    task = pipeline._default_draft_task(project)
    assert "音乐" in task or "场景" in task


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
