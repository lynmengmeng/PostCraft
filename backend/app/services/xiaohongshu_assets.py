"""小红书轮播配图：资产同步与批量 AI 生成。"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.models.schemas import ContentProject, CoverAsset

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


def ensure_xiaohongshu_carousel_assets(
    project: ContentProject,
    pipeline: ContentPipeline,
) -> list[CoverAsset]:
    assets = list(project.cover_assets)
    if any(a.platform == "xiaohongshu" for a in assets):
        return assets

    xhs = project.platforms["xiaohongshu"]
    if not (xhs.body or "").strip():
        raise ValueError("请先生成小红书内容")

    new_data = pipeline._generate_xiaohongshu_carousel_assets(
        xhs.model_dump(mode="json"),
        project,
    )
    assets.extend(CoverAsset.model_validate(item) for item in new_data)
    return assets


def _needs_generation(asset: CoverAsset, *, force: bool) -> bool:
    if force:
        return True
    if asset.source == "upload" and asset.image_url:
        return False
    if asset.source == "generated" and asset.image_url:
        return False
    return True


async def generate_xiaohongshu_carousel(
    project: ContentProject,
    generator: ImageGenerator,
    pipeline: ContentPipeline,
    *,
    force: bool = False,
) -> tuple[ContentProject, int]:
    assets = ensure_xiaohongshu_carousel_assets(project, pipeline)
    generated = 0

    for index, asset in enumerate(assets):
        if asset.platform != "xiaohongshu":
            continue
        if not _needs_generation(asset, force=force):
            continue

        prompt = asset.prompt or "小红书笔记配图，3:4竖版，简洁清爽，真实自然"
        image_url = await generator.generate(prompt, aspect="xhs")
        assets[index] = CoverAsset(
            **{
                **asset.model_dump(),
                "image_url": image_url,
                "source": "generated",
            }
        )
        generated += 1

    if generated == 0:
        xhs_count = sum(1 for a in assets if a.platform == "xiaohongshu")
        if xhs_count == 0:
            raise ValueError("未找到小红书轮播配图方案")
        raise ValueError("轮播图已全部生成，如需重做请使用强制重新生成")

    project.cover_assets = assets
    sync_xiaohongshu_from_assets(project)
    return project, generated
