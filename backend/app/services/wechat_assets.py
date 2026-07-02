from __future__ import annotations

import re
from typing import Any

from app.models.schemas import CoverAsset, WechatImagePlacement

IMAGE_MD_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
PLACEHOLDER_SRC_RE = re.compile(r"^__IMAGE_(\d+)__$")


def next_asset_index(assets: list[CoverAsset | dict[str, Any]]) -> int:
    if not assets:
        return 0
    indices: list[int] = []
    for index, asset in enumerate(assets):
        if isinstance(asset, dict):
            indices.append(int(asset.get("asset_index", index)))
        else:
            indices.append(int(asset.asset_index if asset.asset_index >= 0 else index))
    return max(indices, default=-1) + 1


def make_placeholder_markdown(asset_index: int, caption: str = "配图") -> str:
    return f"![{caption}](__IMAGE_{asset_index}__)"


def insert_placeholder_in_body(body: str, asset_index: int, caption: str = "配图") -> str:
    block = make_placeholder_markdown(asset_index, caption)
    trimmed = body.rstrip()
    return f"{trimmed}\n\n{block}\n" if trimmed else f"{block}\n"


def paragraph_index_for_offset(body: str, offset: int) -> int:
    if offset <= 0:
        return 0
    before = body[:offset]
    paragraphs = [p for p in before.split("\n\n") if p.strip()]
    return len(paragraphs)


def extract_body_image_refs(body: str) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for match in IMAGE_MD_RE.finditer(body):
        alt = match.group(1)
        src = match.group(2).strip()
        placeholder = PLACEHOLDER_SRC_RE.match(src)
        asset_index = int(placeholder.group(1)) if placeholder else len(refs)
        refs.append(
            {
                "alt": alt,
                "src": src,
                "asset_index": asset_index,
                "after_paragraph": paragraph_index_for_offset(body, match.start()),
                "caption": alt,
            }
        )
    return refs


def sync_image_placements(
    body: str,
    cover_assets: list[CoverAsset | dict[str, Any]],
) -> list[dict[str, Any]]:
    refs = extract_body_image_refs(body)
    if not refs:
        return []

    placements: list[dict[str, Any]] = []
    for ref in refs:
        asset_index = int(ref["asset_index"])
        prompt = ""
        if asset_index < len(cover_assets):
            asset = cover_assets[asset_index]
            prompt = asset.get("prompt", "") if isinstance(asset, dict) else asset.prompt
        placements.append(
            WechatImagePlacement(
                after_paragraph=int(ref["after_paragraph"]),
                asset_index=asset_index,
                caption=str(ref["caption"] or ref["alt"] or f"配图{asset_index + 1}"),
                prompt=prompt,
            ).model_dump(mode="json")
        )
    return placements


def ensure_assets_for_body(
    body: str,
    cover_assets: list[CoverAsset],
) -> list[CoverAsset]:
    refs = extract_body_image_refs(body)
    if not refs:
        return cover_assets

    by_index: dict[int, CoverAsset] = {
        (asset.asset_index if asset.asset_index >= 0 else index): asset
        for index, asset in enumerate(cover_assets)
    }

    for ref in refs:
        index = int(ref["asset_index"])
        if index in by_index:
            existing = by_index[index]
            if ref["caption"] and not existing.caption:
                existing.caption = str(ref["caption"])
            continue
        by_index[index] = CoverAsset(
            platform="wechat",
            headline=str(ref["caption"] or f"配图{index + 1}")[:20],
            subheadline=str(ref["caption"] or "用户配图"),
            prompt="用户上传素材",
            caption=str(ref["caption"] or ""),
            asset_index=index,
            after_paragraph=int(ref["after_paragraph"]),
            source="upload",
        )

    return [by_index[key] for key in sorted(by_index.keys())]


def build_materials_context_block(
    attachment_urls: list[str],
    cover_assets: list[CoverAsset | dict[str, Any]] | None = None,
) -> str:
    if not attachment_urls and not cover_assets:
        return ""

    lines = ["【用户提供的配图素材 — 优先使用，勿重复 AI 生图】"]
    for index, url in enumerate(attachment_urls):
        lines.append(f"- 附件{index + 1}: {url}")

    assets = cover_assets or []
    for asset in assets:
        data = asset if isinstance(asset, dict) else asset.model_dump(mode="json")
        url = data.get("image_url", "")
        if not url:
            continue
        source = data.get("source", "generated")
        caption = data.get("caption") or data.get("subheadline") or data.get("headline")
        idx = data.get("asset_index", 0)
        lines.append(
            f"- 素材 __IMAGE_{idx}__ ({source}): {url} | 图注: {caption}"
        )

    lines.append(
        "正文占位符格式：![图注](__IMAGE_N__)，N 与 asset_index 一致。"
        "调整位置时保留占位符，只移动其在正文中的段落位置。"
    )
    return "\n".join(lines) + "\n\n"
