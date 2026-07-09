from __future__ import annotations

from app.config import get_settings
from app.models.schemas import AuthorStyleProfile
from app.services.pipeline import ContentPipeline
from app.services.skill_loader import SkillLoader


def _pipeline() -> ContentPipeline:
    return ContentPipeline(llm=None, skills=SkillLoader(get_settings()))  # type: ignore[arg-type]


def test_style_block_includes_account_positioning() -> None:
    pipeline = _pipeline()
    profile = AuthorStyleProfile(
        tone_preference="温和观察",
        account_positioning="帮学生和家长理解 AI 时代的学习规划",
    )
    block = pipeline._style_block(profile, ["wechat"])
    assert "账号定位" in block
    assert "AI 时代的学习规划" in block


def test_style_block_omits_empty_positioning() -> None:
    pipeline = _pipeline()
    profile = AuthorStyleProfile(account_positioning="")
    block = pipeline._style_block(profile, ["wechat"])
    assert "账号定位" not in block
