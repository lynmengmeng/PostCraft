from __future__ import annotations

from app.config import get_settings
from app.services.pipeline import ContentPipeline
from app.services.skill_loader import SkillLoader


def _pipeline() -> ContentPipeline:
    return ContentPipeline(llm=None, skills=SkillLoader(get_settings()))  # type: ignore[arg-type]


def test_normalize_wechat_payload_preserves_cover_fields() -> None:
    pipeline = _pipeline()
    payload = pipeline._normalize_wechat_payload(
        {
            "title": "老人总说没事？子女先查这 3 个信号",
            "summary": "摘要",
            "cover_headline": "老人总说没事？",
            "cover_subheadline": "子女先查这 3 个信号",
            "body": "## 核心问题\n\n正文。",
            "style_theme": {"layout_preset": "checklist"},
        }
    )
    assert payload["cover_headline"] == "老人总说没事？"
    assert payload["cover_subheadline"] == "子女先查这 3 个信号"
    assert payload["style_theme"]["layout_preset"] == "checklist"
    assert payload["formatted_html"]


def test_cover_copy_from_wechat_uses_explicit_fields() -> None:
    pipeline = _pipeline()
    headline, subheadline = pipeline._cover_copy_from_wechat(
        {
            "cover_headline": "三无包装像药？",
            "cover_subheadline": "识别看这几个细节",
        },
        "",
    )
    assert headline == "三无包装像药？"
    assert subheadline == "识别看这几个细节"


def test_cover_copy_from_wechat_splits_question_title() -> None:
    pipeline = _pipeline()
    headline, subheadline = pipeline._cover_copy_from_wechat(
        {"title": "老人总说没事？子女先查这 3 个信号"},
        "",
    )
    assert headline == "老人总说没事？"
    assert subheadline == "子女先查这 3 个信号"


def test_cover_copy_from_wechat_splits_colon_title() -> None:
    pipeline = _pipeline()
    headline, subheadline = pipeline._cover_copy_from_wechat(
        {"title": "消费陷阱：买这类日用品最容易踩坑"},
        "",
    )
    assert headline == "消费陷阱"
    assert subheadline == "买这类日用品最容易踩坑"


def test_formatting_rules_includes_coldstart() -> None:
    pipeline = _pipeline()
    rules = pipeline._formatting_rules("wechat-converter")
    assert "冷启动" in rules
    assert "cover_headline" in rules
    assert "单问题" in rules or "1 个核心问题" in rules


def test_coldstart_skill_file_loads() -> None:
    pipeline = _pipeline()
    block = pipeline._coldstart_rules_block()
    assert "wechat-coldstart" in block or "冷启动" in block
    assert "搜索" in block
