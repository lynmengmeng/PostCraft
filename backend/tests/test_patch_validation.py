"""Tests for ContentPatch path validation."""

from __future__ import annotations

import pytest

from app.models.schemas import ContentPatch, ContentProject
from app.services.repository import apply_patch, is_allowed_patch_path, validate_patch_paths


def test_allowed_patch_paths() -> None:
    assert is_allowed_patch_path("humanized")
    assert is_allowed_patch_path("platforms.wechat.body")
    assert is_allowed_patch_path("platforms.douyin.script")
    assert not is_allowed_patch_path("chat_history")
    assert not is_allowed_patch_path("platforms.unknown.body")


def test_reject_invalid_patch_path() -> None:
    project = ContentProject(inspiration="测试")
    patch = ContentPatch(
        intent="refine_draft",
        target_platforms=[],
        summary="test",
        patch={"secret_key": "oops"},
    )
    with pytest.raises(ValueError, match="不允许的 patch 路径"):
        apply_patch(project, patch)


def test_reject_invalid_douyin_script_type() -> None:
    project = ContentProject(inspiration="测试")
    patch = ContentPatch(
        intent="patch_platform",
        target_platforms=["douyin"],
        summary="test",
        patch={"platforms.douyin.script": "not-a-list"},
    )
    with pytest.raises(ValueError, match="分镜数组"):
        validate_patch_paths(patch.patch)
