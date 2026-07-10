from app.services.xiaohongshu_styles import (
    build_xhs_page_prompt,
    compress_xhs_image_headline,
    estimate_xiaohongshu_page_count,
    get_style,
    load_cover_styles,
    parse_xhs_page_count_request,
    pick_style_for_content,
    polish_xiaohongshu_body,
    refine_xhs_image_pages,
    styles_reference_block,
    summarize_xhs_image_subheadline,
    summarize_xhs_single_page_copy,
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


def test_compress_xhs_image_headline_avoids_truncated_characters():
    title = "夏夜太短，5个让夜晚变长的幸福提案"
    headline = compress_xhs_image_headline(title)
    assert len(headline) <= 14
    assert headline.endswith("提案")
    assert "提" != headline[-1] or headline.endswith("提案")


def test_summarize_xhs_image_subheadline_uses_complete_sentence():
    body = "白天属于责任，夜晚才真正属于自己。与其刷短视频消磨时间，不如留一点空白。"
    subheadline = summarize_xhs_image_subheadline(body)
    assert len(subheadline) <= 20
    assert "自己" in subheadline or subheadline == "白天属于责任"


def test_summarize_xhs_single_page_copy():
    title = "夏夜太短，5个让夜晚变长的幸福提案"
    body = (
        "白天属于责任，夜晚才真正属于自己。\n\n"
        "【要点一】关掉通知\n\n"
        "【要点二】点一支小蜡烛\n\n"
        "【要点三】写三行日记"
    )
    copy = summarize_xhs_single_page_copy(title, body)
    assert len(copy["headline"]) <= 14
    assert len(copy["subheadline"]) <= 20
    assert copy["body_text"] == ""
    assert copy["headline"].endswith("提案")
    assert " · " in copy["subheadline"] or "自己" in copy["subheadline"]


def test_refine_xhs_image_pages_single_page():
    title = "夏夜太短，5个让夜晚变长的幸福提案"
    body = "白天属于责任，夜晚才真正属于自己。与其刷短视频消磨时间。"
    pages = refine_xhs_image_pages(
        [
            {
                "page": 1,
                "role": "cover",
                "headline": title,
                "subheadline": body,
                "body_text": body,
            }
        ],
        title=title,
        body=body,
    )
    assert len(pages) == 1
    assert len(pages[0]["headline"]) <= 14
    assert len(pages[0]["subheadline"]) <= 20
    assert pages[0]["body_text"] != body


def test_parse_xhs_page_count_request_single_image():
    assert parse_xhs_page_count_request("我只需要处理成只要一张图片") == 1
    assert parse_xhs_page_count_request("改成单图笔记") == 1
    assert parse_xhs_page_count_request("配图改成 3 张") == 3
    assert parse_xhs_page_count_request("调整成一张初稿") is None


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
