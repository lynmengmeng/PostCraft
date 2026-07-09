from app.services.xiaohongshu_styles import (
    build_xhs_page_prompt,
    estimate_xiaohongshu_page_count,
    get_style,
    load_cover_styles,
    parse_xhs_page_count_request,
    pick_style_for_content,
    polish_xiaohongshu_body,
    styles_reference_block,
    trim_xiaohongshu_pages,
)


def test_load_cover_styles_from_examples():
    styles = load_cover_styles()
    assert len(styles) >= 10
    ids = {s.id for s in styles}
    assert "split_screen_layout" in ids
    assert "question_engagement_layout" in ids


def test_pick_style_for_guide_content():
    style = pick_style_for_content("消费避坑指南", "步骤一 步骤二 怎么选")
    assert style.id == "step_by_step_or_guide_layout"


def test_pick_style_for_rural_observation():
    style = pick_style_for_content("回村观察", "农村老家田园生活")
    assert "warm_documentary" in style.id or "split_screen" in style.id


def test_parse_xhs_page_count_request_single_image():
    assert parse_xhs_page_count_request("我只需要处理成只要一张图片") == 1
    assert parse_xhs_page_count_request("改成单图笔记") == 1
    assert parse_xhs_page_count_request("配图改成 3 张") == 3


def test_estimate_page_count_single_image():
    assert estimate_xiaohongshu_page_count("治愈瞬间", "今天阳光很好，心情也不错 🌞") == 1


def test_estimate_page_count_multi_points():
    body = "开头\n\n【要点一】a\n\n【要点二】b\n\n【要点三】c\n\n评论区聊聊"
    count = estimate_xiaohongshu_page_count("干货", body)
    assert 3 <= count <= 6


def test_trim_xiaohongshu_pages():
    pages = [{"page": i, "role": "content"} for i in range(1, 9)]
    pages[0]["role"] = "cover"
    pages[-1]["role"] = "summary"
    trimmed = trim_xiaohongshu_pages(pages)
    assert len(trimmed) == 6
    assert trimmed[0]["role"] == "cover"


def test_styles_reference_block_lists_styles():
    block = styles_reference_block()
    assert "cover_style" in block or "风格库" in block
    assert "split_screen_layout" in block


def test_build_xhs_page_prompt_includes_series_anchor():
    style = get_style("journaling_style")
    prompt = build_xhs_page_prompt(
        style=style,
        role="content",
        headline="要点一",
        body_text="慢生活细节",
        page_index=2,
        total_pages=4,
    )
    assert "系列统一" in prompt
    assert "第2张" in prompt
    assert style.label in prompt


def test_polish_xiaohongshu_body_normalizes_spacing():
    body = "第一段   内容\n\n\n第二段"
    polished = polish_xiaohongshu_body(body)
    assert "第一段 内容" in polished
    assert "第二段" in polished
    assert "\n\n" in polished
