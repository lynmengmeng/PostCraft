"""Tests for chat orchestrator intent routing."""

from __future__ import annotations

from app.services.intent_parser import parse_intent


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
