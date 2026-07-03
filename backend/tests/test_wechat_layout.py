from __future__ import annotations

from app.services.intent_parser import parse_intent
from app.services.wechat_html import (
    apply_layout_preset,
    build_formatted_html,
    normalize_style_theme,
    render_wechat_body_inline_html,
)

SAMPLE_BODY = """## 第一节

这是一段正文。

> 一句引用

---

- 列表项一
- 列表项二

> 💡 实用提示
"""

CLASSIC_THEME = {
    "layout_preset": "classic",
    "accent": "#455548",
    "heading_style": "border_left",
    "quote_bg": "#faf8f5",
    "quote_border": "#d4a574",
    "text_color": "#3f3f3f",
    "heading_color": "#1a1c1b",
}


def _classic_snapshot() -> str:
    return build_formatted_html(
        {
            "summary": "测试摘要",
            "body": SAMPLE_BODY,
            "style_theme": CLASSIC_THEME,
        },
        force_rerender=True,
    )


def test_normalize_style_theme_defaults_classic() -> None:
    theme = normalize_style_theme({"accent": "#112233"})
    assert theme["layout_preset"] == "classic"
    assert theme["accent"] == "#112233"


def test_classic_preset_regression_snapshot() -> None:
    html = _classic_snapshot()
    assert "background:#fffbeb" in html
    assert "border-left:4px solid #fbbf24" in html
    assert "border-left:4px solid #455548" in html
    assert "text-align:justify" in html
    assert "· · ·" not in html


def test_classic_preset_unchanged_on_repeat_render() -> None:
    first = _classic_snapshot()
    second = build_formatted_html(
        {"summary": "测试摘要", "body": SAMPLE_BODY, "style_theme": CLASSIC_THEME},
        force_rerender=True,
    )
    assert first == second


def test_lively_preset_styles() -> None:
    html = render_wechat_body_inline_html(
        SAMPLE_BODY,
        {**CLASSIC_THEME, "layout_preset": "lively"},
    )
    assert "border-radius:8px" in html
    assert "box-shadow:0 2px 8px" in html
    assert "· · ·" in html
    assert "●</span>" in html
    assert "background:#fffbeb" not in html


def test_story_preset_styles() -> None:
    html = render_wechat_body_inline_html(
        SAMPLE_BODY,
        {**CLASSIC_THEME, "layout_preset": "story"},
    )
    assert "text-align:center" in html
    assert "line-height:2.1" in html
    assert "font-style:italic" in html


def test_checklist_preset_styles() -> None:
    html = render_wechat_body_inline_html(
        SAMPLE_BODY,
        {**CLASSIC_THEME, "layout_preset": "checklist"},
    )
    assert "border-top:1px dashed" in html
    assert "💡" in html
    assert "border:1px solid #455548" in html


def test_apply_layout_preset_preserves_body() -> None:
    body = "## 标题\n\n正文不变。"
    classic_html = apply_layout_preset(body, CLASSIC_THEME, summary="摘要")
    lively_html = apply_layout_preset(body, {**CLASSIC_THEME, "layout_preset": "lively"}, summary="摘要")
    assert "正文不变" in classic_html
    assert "正文不变" in lively_html
    assert classic_html != lively_html


def test_parse_layout_preset_intent() -> None:
    parsed = parse_intent("排版活泼一点", "wechat")
    assert parsed.intent == "layout_preset"
    assert parsed.layout_preset == "lively"

    parsed = parse_intent("换成清单风", "wechat")
    assert parsed.layout_preset == "checklist"

    parsed = parse_intent("恢复经典排版", "wechat")
    assert parsed.layout_preset == "classic"
