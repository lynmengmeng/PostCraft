"""Tests for chat orchestrator intent routing and rollback."""

from __future__ import annotations

import asyncio
from copy import deepcopy

from app.config import get_settings
from app.models.schemas import (
    AuthorStyleProfile,
    ChatMessage,
    ContentProject,
    ProjectVersion,
    WechatContent,
    XiaohongshuContent,
    DouyinContent,
)
from app.services.chat_orchestrator import ChatOrchestrator
from app.services.intent_parser import parse_intent


def _orchestrator() -> ChatOrchestrator:
    return ChatOrchestrator(get_settings())


def _project_with_wechat() -> ContentProject:
    return ContentProject(
        inspiration="测试灵感",
        humanized="观察型初稿",
        draft="观察型初稿",
        platforms={
            "wechat": WechatContent(body="公众号正文第一段。\n\n第二段内容。"),
            "xiaohongshu": XiaohongshuContent(),
            "douyin": DouyinContent(),
        },
    )


def _project_draft_only() -> ContentProject:
    return ContentProject(
        inspiration="测试灵感",
        humanized="观察型初稿",
        draft="观察型初稿",
    )


def test_humanize_intent() -> None:
    parsed = parse_intent("不要太 AI 了", "wechat", has_draft=True)
    assert parsed.intent == "humanize"


def test_refine_with_constraints() -> None:
    parsed = parse_intent("更温和一点", "wechat", has_draft=True)
    assert parsed.intent == "refine_draft"
    assert "温和" in parsed.constraints


def test_explicit_fact_check() -> None:
    parsed = parse_intent("检查一下有没有敏感表述", "wechat", has_draft=True)
    assert parsed.intent == "fact_check"


def test_scope_routes_refine_to_patch_when_wechat_has_content() -> None:
    orch = _orchestrator()
    project = _project_with_wechat()
    parsed = orch._resolve_intent(
        "第二段再温和一点",
        "wechat",
        None,
        ["wechat"],
        project,
    )
    assert parsed.intent == "patch_platform"
    assert parsed.target_platforms == ["wechat"]
    assert "温和" in parsed.constraints


def test_scope_uses_selected_platform_in_auto_mode() -> None:
    orch = _orchestrator()
    project = _project_with_wechat()
    parsed = orch._resolve_intent(
        "开头再犀利一点",
        "wechat",
        None,
        None,
        project,
    )
    assert parsed.intent == "patch_platform"
    assert parsed.target_platforms == ["wechat"]


def test_scope_stays_refine_draft_without_platform_content() -> None:
    orch = _orchestrator()
    project = _project_draft_only()
    parsed = orch._resolve_intent(
        "更温和一点",
        "wechat",
        None,
        ["wechat"],
        project,
    )
    assert parsed.intent == "refine_draft"


def test_scope_all_targets_only_platforms_with_content() -> None:
    orch = _orchestrator()
    project = _project_with_wechat()
    project.platforms["xiaohongshu"] = XiaohongshuContent(body="小红书笔记正文")
    parsed = orch._resolve_intent(
        "整体再精简一些",
        "wechat",
        None,
        ["wechat", "xiaohongshu", "douyin"],
        project,
    )
    assert parsed.intent == "patch_platform"
    assert set(parsed.target_platforms) == {"wechat", "xiaohongshu"}


def test_scoped_long_message_keeps_patch_platform() -> None:
    orch = _orchestrator()
    project = _project_with_wechat()
    long_message = "只改公众号：" + ("补充一段个人经历，" * 20)
    parsed = orch._resolve_intent(
        long_message,
        "wechat",
        None,
        ["wechat"],
        project,
    )
    assert parsed.intent == "patch_platform"
    assert parsed.target_platforms == ["wechat"]


def test_humanize_scope_attaches_platform_targets() -> None:
    orch = _orchestrator()
    project = _project_with_wechat()
    parsed = orch._resolve_intent(
        "不要太 AI 了",
        "wechat",
        None,
        ["wechat"],
        project,
    )
    assert parsed.intent == "humanize"
    assert parsed.target_platforms == ["wechat"]


def test_humanize_without_platform_content_stays_draft_only() -> None:
    orch = _orchestrator()
    project = _project_draft_only()
    parsed = orch._resolve_intent(
        "不要太 AI 了",
        "wechat",
        None,
        ["wechat"],
        project,
    )
    assert parsed.intent == "humanize"
    assert parsed.target_platforms == []


def test_adjust_draft_stays_refine_with_xhs_scope_and_content() -> None:
    orch = _orchestrator()
    project = _project_with_wechat()
    project.platforms["xiaohongshu"] = XiaohongshuContent(body="小红书笔记正文")
    parsed = orch._resolve_intent(
        "根据这个继续调整初稿",
        "xiaohongshu",
        None,
        ["xiaohongshu"],
        project,
    )
    assert parsed.intent == "refine_draft"
    assert parsed.target_platforms == []


async def _rollback_chat(project: ContentProject) -> tuple[str, ContentProject]:
    orch = _orchestrator()
    style = AuthorStyleProfile()
    updated, patch, _ = await orch.handle_message(
        project,
        "撤销上一版",
        "wechat",
        style,
    )
    return patch.summary, updated


def test_rollback_without_versions_returns_helpful_message() -> None:
    project = _project_draft_only()
    summary, updated = asyncio.run(_rollback_chat(project))
    assert "暂无可回退" in summary
    assert updated.humanized == "观察型初稿"


def test_rollback_with_versions_restores_previous_snapshot() -> None:
    project = _project_draft_only()
    project.versions = [
        ProjectVersion(
            label="v1",
            snapshot=deepcopy(project.model_dump(mode="json")),
        ),
        ProjectVersion(
            label="v2",
            snapshot={
                **project.model_dump(mode="json"),
                "humanized": "修改后的初稿",
                "draft": "修改后的初稿",
            },
        ),
    ]
    project.humanized = "修改后的初稿"
    project.draft = "修改后的初稿"
    project.chat_history = [
        ChatMessage(role="user", content="改一下"),
        ChatMessage(role="assistant", content="已更新"),
    ]

    summary, updated = asyncio.run(_rollback_chat(project))
    assert summary == "已回退到上一版本。"
    assert updated.humanized == "观察型初稿"
