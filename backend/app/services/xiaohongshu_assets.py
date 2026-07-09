"""小红书轮播配图：资产同步与批量 AI 生成。"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from app.models.schemas import ContentProject, CoverAsset
from app.services.xiaohongshu_styles import (
    build_xhs_page_prompt,
    refine_xhs_image_pages,
    resolve_style_for_xhs,
)

if TYPE_CHECKING:
    from app.services.image_generator import ImageGenerator
    from app.services.pipeline import ContentPipeline


def sync_xiaohongshu_from_assets(project: ContentProject) -> None:
    xhs_assets = [a for a in project.cover_assets if a.platform == "xiaohongshu"]
    if not xhs_assets:
        return
    urls = [a.image_url for a in xhs_assets if a.image_url]
    xhs = project.platforms["xiaohongshu"]
    if urls:
        xhs.carousel_images = urls
        xhs.cover_image = urls[0]


def _xhs_page_meta(project: ContentProject, asset: CoverAsset) -> tuple[str, str, int, int]:
    xhs = project.platforms["xiaohongshu"]
    pages = xhs.image_pages or []
    xhs_assets = [a for a in project.cover_assets if a.platform == "xiaohongshu"]
    xhs_assets.sort(key=lambda a: a.after_paragraph if a.after_paragraph is not None else 0)
    total_pages = max(len(pages), len(xhs_assets), 1)

    slot = 0
    for index, item in enumerate(xhs_assets):
        if item.asset_index == asset.asset_index:
            slot = index
            break

    page = pages[slot] if slot < len(pages) else None
    role = str(getattr(page, "role", None) or ("cover" if slot == 0 else "content"))
    body_text = str(getattr(page, "body_text", None) or "")
    return role, body_text, slot + 1, total_pages


def refresh_xhs_asset_prompts(project: ContentProject) -> list[CoverAsset]:
    xhs = project.platforms["xiaohongshu"]
    style = resolve_style_for_xhs(
        title=xhs.title or "",
        body=xhs.body or "",
        cover_style=xhs.cover_style or "",
    )
    raw_pages = [page.model_dump(mode="json") for page in (xhs.image_pages or [])]
    pages = refine_xhs_image_pages(raw_pages, title=xhs.title or "", body=xhs.body or "")
    xhs_assets = [a for a in project.cover_assets if a.platform == "xiaohongshu"]
    xhs_assets.sort(key=lambda a: a.after_paragraph if a.after_paragraph is not None else 0)
    total_pages = max(len(pages), len(xhs_assets), 1)

    assets = list(project.cover_assets)
    for slot, asset in enumerate(xhs_assets):
        page = pages[slot] if slot < len(pages) else None
        role = str((page or {}).get("role") or ("cover" if slot == 0 else "content"))
        headline = str((page or {}).get("headline") or asset.headline or xhs.title or "")
        subheadline = str((page or {}).get("subheadline") or asset.subheadline or "")
        body_text = str((page or {}).get("body_text") or "")

        prompt = build_xhs_page_prompt(
            style=style,
            role=role,
            headline=headline,
            subheadline=subheadline,
            body_text=body_text,
            page_index=slot + 1,
            total_pages=total_pages,
        )

        for index, existing in enumerate(assets):
            if existing.asset_index == asset.asset_index and existing.platform == "xiaohongshu":
                assets[index] = CoverAsset(
                    **{
                        **existing.model_dump(),
                        "headline": headline,
                        "subheadline": subheadline,
                        "prompt": prompt,
                    }
                )
                break

    return assets


def resolve_xhs_generation_prompt(project: ContentProject, asset: CoverAsset) -> str:
    xhs = project.platforms["xiaohongshu"]
    style = resolve_style_for_xhs(
        title=xhs.title or "",
        body=xhs.body or "",
        cover_style=xhs.cover_style or "",
    )
    role, body_text, page_index, total_pages = _xhs_page_meta(project, asset)
    return build_xhs_page_prompt(
        style=style,
        role=role,
        headline=asset.headline or xhs.title or "",
        subheadline=asset.subheadline or "",
        body_text=body_text,
        page_index=page_index,
        total_pages=total_pages,
    )


def ensure_xiaohongshu_carousel_assets(
    project: ContentProject,
    pipeline: ContentPipeline,
) -> list[CoverAsset]:
    assets = list(project.cover_assets)
    if not any(a.platform == "xiaohongshu" for a in assets):
        xhs = project.platforms["xiaohongshu"]
        if not (xhs.body or "").strip():
            raise ValueError("请先生成小红书内容")

        new_data = pipeline._generate_xiaohongshu_carousel_assets(
            xhs.model_dump(mode="json"),
            project,
        )
        assets.extend(CoverAsset.model_validate(item) for item in new_data)

    return refresh_xhs_asset_prompts(
        project.model_copy(update={"cover_assets": assets})
    )


def _needs_generation(asset: CoverAsset, *, force: bool) -> bool:
    if force:
        return True
    if asset.source == "upload" and asset.image_url:
        return False
    if asset.source == "generated" and asset.image_url:
        return False
    return True


async def _generate_one_xhs_asset(
    project: ContentProject,
    asset: CoverAsset,
    generator: ImageGenerator,
) -> CoverAsset:
    prompt = resolve_xhs_generation_prompt(project, asset)
    image_url = await generator.generate(prompt, aspect="xhs")
    return CoverAsset(
        **{
            **asset.model_dump(),
            "image_url": image_url,
            "prompt": prompt,
            "source": "generated",
        }
    )


async def generate_xiaohongshu_carousel(
    project: ContentProject,
    generator: ImageGenerator,
    pipeline: ContentPipeline,
    *,
    force: bool = False,
) -> tuple[ContentProject, int]:
    assets = ensure_xiaohongshu_carousel_assets(project, pipeline)
    pending: list[tuple[int, CoverAsset]] = []

    for index, asset in enumerate(assets):
        if asset.platform != "xiaohongshu":
            continue
        if not _needs_generation(asset, force=force):
            continue
        pending.append((index, asset))

    if pending:
        working = project.model_copy(update={"cover_assets": assets})
        results = await asyncio.gather(
            *[
                _generate_one_xhs_asset(working, asset, generator)
                for _, asset in pending
            ]
        )
        for (index, _), updated in zip(pending, results, strict=True):
            assets[index] = updated

    generated = len(pending)

    if generated == 0:
        xhs_count = sum(1 for a in assets if a.platform == "xiaohongshu")
        if xhs_count == 0:
            raise ValueError("未找到小红书轮播配图方案")
        raise ValueError("轮播图已全部生成，如需重做请使用强制重新生成")

    project.cover_assets = assets
    sync_xiaohongshu_from_assets(project)
    return project, generated
