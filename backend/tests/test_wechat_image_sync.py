from __future__ import annotations

from app.models.schemas import CoverAsset
from app.services.image_generator import ImageGenerator
from app.services.wechat_assets import (
    get_cover_asset_by_index,
    realign_body_image_markers,
    restore_body_image_placeholders_from_assets,
    sync_body_image_alts_from_assets,
    sync_image_placements,
)
from app.services.wechat_html import (
    finalize_wechat_content,
    render_wechat_body_inline_html,
    restore_body_image_placeholders,
)
from app.config import get_settings


def test_slot_placeholder_urls_are_unique() -> None:
    gen = ImageGenerator(get_settings())
    first = gen.slot_placeholder("wechat", caption="封面A")
    second = gen.slot_placeholder("wechat", caption="封面B")
    assert first != second
    assert first.endswith(".svg")
    assert second.endswith(".svg")


def test_finalize_keeps_image_placeholders_in_body() -> None:
    body = "![旧图注](__IMAGE_0__)"
    assets = [
        CoverAsset(
            asset_index=0,
            image_url="/api/images/slot-ph-wechat-abc.svg",
            source="placeholder",
            caption="新图注",
        ).model_dump(mode="json")
    ]
    result = finalize_wechat_content({"body": body, "summary": ""}, assets)
    assert "__IMAGE_0__" in result["body"]
    assert "slot-ph-wechat" not in result["body"]


def test_restore_body_image_placeholders_from_shared_url() -> None:
    shared = "/api/images/slot-placeholder-inline.svg"
    body = f"![图A]({shared})\n\n![图B]({shared})"
    assets = [
        CoverAsset(asset_index=0, image_url=shared, source="placeholder", caption="图A").model_dump(
            mode="json"
        ),
        CoverAsset(asset_index=1, image_url=shared, source="placeholder", caption="图B").model_dump(
            mode="json"
        ),
    ]
    placements = [
        {"after_paragraph": 1, "asset_index": 0, "caption": "图A", "prompt": "a"},
        {"after_paragraph": 3, "asset_index": 1, "caption": "图B", "prompt": "b"},
    ]
    restored = restore_body_image_placeholders_from_assets(body, assets, placements)
    assert "![图A](__IMAGE_0__)" in restored
    assert "![图B](__IMAGE_1__)" in restored


def test_realign_duplicate_image_markers() -> None:
    body = "![图A](__IMAGE_0__)\n\n![图B](__IMAGE_0__)"
    assets = [
        CoverAsset(asset_index=0, platform="wechat", caption="图A", after_paragraph=1).model_dump(
            mode="json"
        ),
        CoverAsset(asset_index=1, platform="wechat", caption="图B", after_paragraph=3).model_dump(
            mode="json"
        ),
    ]
    placements = [
        {"after_paragraph": 1, "asset_index": 0, "caption": "图A", "prompt": "a"},
        {"after_paragraph": 3, "asset_index": 1, "caption": "图B", "prompt": "b"},
    ]
    realigned = realign_body_image_markers(body, assets, placements)
    assert "![图A](__IMAGE_0__)" in realigned
    assert "![图B](__IMAGE_1__)" in realigned


def test_finalize_realigns_duplicate_markers_after_first_generation() -> None:
    shared = "/api/images/slot-placeholder-inline.svg"
    body = f"![图A]({shared})\n\n![图B]({shared})"
    assets = [
        CoverAsset(
            asset_index=0,
            platform="wechat",
            image_url="/api/images/first.png",
            source="generated",
            caption="图A",
            after_paragraph=1,
        ).model_dump(mode="json"),
        CoverAsset(
            asset_index=1,
            platform="wechat",
            image_url=shared,
            source="placeholder",
            caption="图B",
            after_paragraph=3,
        ).model_dump(mode="json"),
    ]
    placements = [
        {"after_paragraph": 1, "asset_index": 0, "caption": "图A", "prompt": "a"},
        {"after_paragraph": 3, "asset_index": 1, "caption": "图B", "prompt": "b"},
    ]
    result = finalize_wechat_content({"body": body, "summary": "", "image_placements": placements}, assets)
    assert "![图A](__IMAGE_0__)" in result["body"]
    assert "![图B](__IMAGE_1__)" in result["body"]


def test_restore_body_image_placeholders_from_embedded_url() -> None:
    url = "/api/images/abc.png"
    body = f"![图注]({url})"
    assets = [
        CoverAsset(
            asset_index=0,
            image_url=url,
            source="generated",
            caption="图注",
        ).model_dump(mode="json")
    ]
    restored = restore_body_image_placeholders(body, assets)
    assert restored == "![图注](__IMAGE_0__)"


def test_sync_body_image_alts_from_assets() -> None:
    body = "![旧图注](__IMAGE_0__)"
    assets = [
        CoverAsset(
            asset_index=0,
            caption="周末躺一天需要恢复",
            subheadline="周末躺一天需要恢复",
            prompt="卧室阳光",
            source="placeholder",
        ).model_dump(mode="json")
    ]
    synced = sync_body_image_alts_from_assets(body, assets)
    assert "![周末躺一天需要恢复](__IMAGE_0__)" in synced


def test_sync_image_placements_uses_asset_index_not_array_position() -> None:
    body = "![正文图](__IMAGE_2__)"
    assets = [
        CoverAsset(asset_index=0, platform="xiaohongshu", prompt="xhs").model_dump(mode="json"),
        CoverAsset(asset_index=1, platform="xiaohongshu", prompt="xhs2").model_dump(mode="json"),
        CoverAsset(asset_index=2, platform="wechat", prompt="卧室场景", caption="正文图").model_dump(
            mode="json"
        ),
    ]
    placements = sync_image_placements(body, assets)
    assert len(placements) == 1
    assert placements[0]["asset_index"] == 2
    assert placements[0]["prompt"] == "卧室场景"


def test_get_cover_asset_by_index() -> None:
    assets = [
        CoverAsset(asset_index=2, caption="正文配图").model_dump(mode="json"),
    ]
    found = get_cover_asset_by_index(assets, 2)
    assert found is not None
    assert found["caption"] == "正文配图"


def test_render_shows_generated_image_with_placeholder_body() -> None:
    body = "![图注](__IMAGE_0__)"
    assets = [
        CoverAsset(
            asset_index=0,
            image_url="/api/images/abc.jpg",
            source="generated",
            caption="图注",
        ).model_dump(mode="json")
    ]
    html = render_wechat_body_inline_html(body, cover_assets=assets)
    assert 'src="/api/images/abc.jpg"' in html


def test_render_skips_placeholder_assets_in_copy_html() -> None:
    body = "![图注](__IMAGE_0__)"
    assets = [
        CoverAsset(
            asset_index=0,
            image_url="/api/images/slot-ph-inline-abc.svg",
            source="placeholder",
            caption="图注",
        ).model_dump(mode="json")
    ]
    html = render_wechat_body_inline_html(body, cover_assets=assets)
    assert "[配图：" in html
    assert "slot-ph-inline" not in html
