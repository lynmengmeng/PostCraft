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


def _wechat_asset_index(asset: CoverAsset | dict[str, Any], fallback: int) -> int:
    if isinstance(asset, dict):
        return int(asset.get("asset_index", fallback))
    return int(asset.asset_index if asset.asset_index >= 0 else fallback)


def _is_wechat_asset(asset: CoverAsset | dict[str, Any]) -> bool:
    platform = asset.get("platform", "wechat") if isinstance(asset, dict) else asset.platform
    return platform in ("wechat", "all", None)


def _after_paragraph(asset: CoverAsset | dict[str, Any]) -> int | None:
    if isinstance(asset, dict):
        value = asset.get("after_paragraph")
    else:
        value = asset.after_paragraph
    return int(value) if value is not None else None


def realign_body_image_markers(
    body: str,
    cover_assets: list[CoverAsset | dict[str, Any]],
    image_placements: list[dict[str, Any] | WechatImagePlacement] | None = None,
) -> str:
    """按正文出现顺序，将配图占位符对齐到唯一的 asset_index（修复重复的 __IMAGE_0__）。"""
    refs = extract_body_image_refs(body)
    if len(refs) <= 1:
        return body

    targets: list[int] = []
    if image_placements:
        for index, item in enumerate(image_placements):
            if isinstance(item, dict):
                targets.append(int(item.get("asset_index", index)))
            else:
                targets.append(int(item.asset_index))
    if not targets:
        inline_indices = sorted(
            {
                _wechat_asset_index(asset, index)
                for index, asset in enumerate(cover_assets)
                if _is_wechat_asset(asset) and (_after_paragraph(asset) or 0) >= 0
            }
        )
        targets = inline_indices

    if len(targets) < len(refs):
        used = set(targets)
        for index, asset in enumerate(cover_assets):
            if not _is_wechat_asset(asset):
                continue
            candidate = _wechat_asset_index(asset, index)
            if candidate not in used:
                targets.append(candidate)
                used.add(candidate)
            if len(targets) >= len(refs):
                break

    cursor = [0]

    def replace(match: re.Match[str]) -> str:
        alt = match.group(1)
        src = match.group(2).strip()
        if not PLACEHOLDER_SRC_RE.match(src):
            return match.group(0)
        if cursor[0] >= len(targets):
            return match.group(0)
        asset_index = targets[cursor[0]]
        cursor[0] += 1
        return f"![{alt}](__IMAGE_{asset_index}__)"

    return IMAGE_MD_RE.sub(replace, body)


def restore_body_image_placeholders_from_assets(
    body: str,
    cover_assets: list[CoverAsset | dict[str, Any]],
    image_placements: list[dict[str, Any] | WechatImagePlacement] | None = None,
) -> str:
    """将正文中固化的配图 URL 还原为 __IMAGE_N__，按正文顺序与 placements 对齐。"""
    from collections import defaultdict

    targets: list[int] = []
    if image_placements:
        for index, item in enumerate(image_placements):
            if isinstance(item, dict):
                targets.append(int(item.get("asset_index", index)))
            else:
                targets.append(int(item.asset_index))
    if not targets:
        targets = sorted(
            {
                _wechat_asset_index(asset, index)
                for index, asset in enumerate(cover_assets)
                if _is_wechat_asset(asset)
            }
        )

    url_queues: dict[str, list[int]] = defaultdict(list)
    for index, asset in enumerate(cover_assets):
        asset_index = _wechat_asset_index(asset, index)
        url = asset.get("image_url", "") if isinstance(asset, dict) else asset.image_url
        if url and not PLACEHOLDER_SRC_RE.match(url):
            url_queues[url].append(asset_index)

    cursor = [0]

    def replace(match: re.Match[str]) -> str:
        alt = match.group(1)
        url = match.group(2).strip()
        if PLACEHOLDER_SRC_RE.match(url):
            return match.group(0)

        asset_index: int | None = None
        if cursor[0] < len(targets):
            asset_index = targets[cursor[0]]
            queue = url_queues.get(url)
            if queue and asset_index in queue:
                queue.remove(asset_index)
        else:
            queue = url_queues.get(url)
            if queue:
                asset_index = queue.pop(0)

        if asset_index is None:
            return match.group(0)

        cursor[0] += 1
        return f"![{alt}](__IMAGE_{asset_index}__)"

    return IMAGE_MD_RE.sub(replace, body)


def get_cover_asset_by_index(
    cover_assets: list[CoverAsset | dict[str, Any]],
    asset_index: int,
) -> CoverAsset | dict[str, Any] | None:
    for index, asset in enumerate(cover_assets):
        idx = int(asset.get("asset_index", index)) if isinstance(asset, dict) else (
            asset.asset_index if asset.asset_index >= 0 else index
        )
        if idx == asset_index:
            return asset
    if 0 <= asset_index < len(cover_assets):
        return cover_assets[asset_index]
    return None


def sync_body_image_alts_from_assets(
    body: str,
    cover_assets: list[CoverAsset | dict[str, Any]],
) -> str:
    """将正文配图占位符的图注与 cover_assets 中的 caption 对齐。"""

    def replace_alt(match: re.Match[str]) -> str:
        alt = match.group(1)
        src = match.group(2).strip()
        placeholder = PLACEHOLDER_SRC_RE.match(src)
        if not placeholder:
            return match.group(0)
        asset_index = int(placeholder.group(1))
        asset = get_cover_asset_by_index(cover_assets, asset_index)
        if not asset:
            return match.group(0)
        if isinstance(asset, dict):
            caption = asset.get("caption") or asset.get("subheadline") or alt
        else:
            caption = asset.caption or asset.subheadline or alt
        return f"![{caption}](__IMAGE_{asset_index}__)"

    return IMAGE_MD_RE.sub(replace_alt, body)


def sync_cover_assets_captions_from_body(
    body: str,
    cover_assets: list[CoverAsset | dict[str, Any]],
) -> list[CoverAsset | dict[str, Any]]:
    """根据正文中的图注更新 cover_assets 的 caption / subheadline。"""
    refs = extract_body_image_refs(body)
    if not refs:
        return cover_assets

    updated = [dict(asset) if isinstance(asset, dict) else asset.model_dump(mode="json") for asset in cover_assets]
    by_index = {
        int(item.get("asset_index", index)): item
        for index, item in enumerate(updated)
    }
    for ref in refs:
        asset_index = int(ref["asset_index"])
        caption = str(ref.get("caption") or ref.get("alt") or "").strip()
        if not caption or asset_index not in by_index:
            continue
        item = by_index[asset_index]
        item["caption"] = caption
        if not item.get("subheadline") or item.get("subheadline") == "正文配图":
            item["subheadline"] = caption
    return updated


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
        asset = get_cover_asset_by_index(cover_assets, asset_index)
        prompt = ""
        if asset:
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
