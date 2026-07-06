from app.services.xiaohongshu_styles import (
    load_cover_styles,
    pick_style_for_content,
    styles_reference_block,
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


def test_styles_reference_block_lists_styles():
    block = styles_reference_block()
    assert "cover_style" in block or "风格库" in block
    assert "split_screen_layout" in block
