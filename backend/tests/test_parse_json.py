from __future__ import annotations

import pytest

from app.services.repository import parse_json_from_text


def test_parse_fenced_json() -> None:
    raw = '说明\n```json\n{"humanized":"hello"}\n```'
    assert parse_json_from_text(raw)["humanized"] == "hello"


def test_parse_balanced_json_with_markdown_inside() -> None:
    raw = '{"humanized":"## 标题\\n\\n正文 {观察}"}'
    assert "标题" in parse_json_from_text(raw)["humanized"]


def test_fallback_plain_markdown() -> None:
    raw = "## 观察\n\n这是一段初稿。"
    result = parse_json_from_text(raw, fallback_key="humanized")
    assert result["humanized"].startswith("## 观察")


def test_fallback_when_json_invalid() -> None:
    raw = '{"humanized":"broken'
    result = parse_json_from_text(raw, fallback_key="humanized")
    assert "broken" in result["humanized"]


def test_raises_without_fallback() -> None:
    with pytest.raises(ValueError, match="No JSON object found"):
        parse_json_from_text("plain text without json")
