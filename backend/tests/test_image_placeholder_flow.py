from __future__ import annotations

from app.models.schemas import CoverAsset
from app.services.image_generator import ImageGenerator
from app.services.wechat_html import render_wechat_body_inline_html
from app.config import get_settings


def test_slot_placeholder_urls() -> None:
    gen = ImageGenerator(get_settings())
    wechat_url = gen.slot_placeholder("wechat", caption="封面")
    inline_url = gen.slot_placeholder("xhs", caption="配图")
    assert wechat_url.endswith("slot-placeholder-wechat.svg")
    assert inline_url.endswith("slot-placeholder-inline.svg")


def test_render_skips_placeholder_assets_in_copy_html() -> None:
    body = "![图注](__IMAGE_0__)"
    assets = [
        CoverAsset(
            asset_index=0,
            image_url="/api/images/slot-placeholder-inline.svg",
            source="placeholder",
            caption="图注",
        ).model_dump(mode="json")
    ]
    html = render_wechat_body_inline_html(body, cover_assets=assets)
    assert "[配图：" in html
    assert "slot-placeholder" not in html


def test_render_shows_real_uploaded_image() -> None:
    body = "![图注](__IMAGE_0__)"
    assets = [
        CoverAsset(
            asset_index=0,
            image_url="/api/images/abc.jpg",
            source="upload",
            caption="图注",
        ).model_dump(mode="json")
    ]
    html = render_wechat_body_inline_html(body, cover_assets=assets)
    assert 'src="/api/images/abc.jpg"' in html
