from __future__ import annotations

from app.services.intent_parser import parse_intent


def test_parse_search_friendly_titles_intent() -> None:
    parsed = parse_intent("给我 10 个搜一搜友好标题", "wechat", has_draft=True)
    assert parsed.intent == "generate_titles"
    assert parsed.title_count == 10
    assert parsed.title_search_friendly is True


def test_parse_optimize_opening_intent() -> None:
    parsed = parse_intent("优化开头，前 3 段直接说痛点", "wechat", has_draft=True)
    assert parsed.intent == "optimize_opening"
    assert parsed.target_platforms == ["wechat"]


def test_parse_add_engagement_question_intent() -> None:
    parsed = parse_intent("加一条具体互动提问", "wechat", has_draft=True)
    assert parsed.intent == "add_engagement_question"


def test_parse_xhs_single_image_intent() -> None:
    parsed = parse_intent("我只需要处理成只要一张图片", "xiaohongshu", has_draft=True)
    assert parsed.intent == "xhs_page_count"
    assert parsed.xhs_page_count == 1
    assert parsed.target_platforms == ["xiaohongshu"]


def test_parse_xhs_image_count_with_number() -> None:
    parsed = parse_intent("小红书改成 3 张图", "wechat", has_draft=True)
    assert parsed.intent == "xhs_page_count"
    assert parsed.xhs_page_count == 3


def test_adjust_draft_not_xhs_page_count() -> None:
    parsed = parse_intent("根据这个继续调整初稿", "xiaohongshu", has_draft=True)
    assert parsed.intent == "refine_draft"


def test_one_draft_wording_not_image_count() -> None:
    assert parse_intent("调整成一张初稿", "xiaohongshu", has_draft=True).intent == "refine_draft"
