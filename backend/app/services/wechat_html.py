from __future__ import annotations

import re
from typing import Any

from app.models.schemas import CoverAsset, WechatContent

DEFAULT_THEME: dict[str, str] = {
    "accent": "#455548",
    "mood": "warm",
    "heading_style": "border_left",
    "quote_bg": "#faf8f5",
    "quote_border": "#d4a574",
    "text_color": "#3f3f3f",
    "heading_color": "#1a1c1b",
}

IMAGE_PLACEHOLDER_RE = re.compile(r"^__IMAGE_(\d+)__$")
MARKDOWN_IMAGE_RE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)$")


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _inline_format(text: str) -> str:
    escaped = _escape_html(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"\*(.+?)\*", r"<em>\1</em>", escaped)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    return escaped


def normalize_style_theme(theme: dict[str, Any] | None) -> dict[str, str]:
    merged = {**DEFAULT_THEME}
    if theme:
        for key, value in theme.items():
            if isinstance(value, str) and value:
                merged[key] = value
    return merged


def _styles(theme: dict[str, str]) -> dict[str, str]:
    heading_border = ""
    if theme.get("heading_style") == "border_left":
        heading_border = f"border-left:4px solid {theme['accent']};padding-left:12px;"
    elif theme.get("heading_style") == "underline":
        heading_border = f"border-bottom:2px solid {theme['accent']};padding-bottom:6px;"
    return {
        "p": (
            f"margin:0 0 16px;line-height:1.9;font-size:16px;color:{theme['text_color']};"
            "text-align:justify;letter-spacing:0.02em;"
        ),
        "h2": (
            f"margin:28px 0 14px;font-size:20px;font-weight:700;color:{theme['heading_color']};"
            f"{heading_border}"
        ),
        "h3": (
            f"margin:24px 0 12px;font-size:18px;font-weight:700;color:{theme['heading_color']};"
            f"{heading_border}"
        ),
        "h4": f"margin:20px 0 10px;font-size:16px;font-weight:700;color:{theme['heading_color']};",
        "quote": (
            f"margin:16px 0;padding:12px 16px;background:{theme['quote_bg']};"
            f"border-left:4px solid {theme['quote_border']};color:#666;font-size:15px;line-height:1.85;"
        ),
        "hr": "margin:24px 0;border:none;border-top:1px solid #e8e4df;",
        "ol": f"margin:12px 0 20px;padding-left:24px;color:{theme['text_color']};",
        "ul": f"margin:12px 0 20px;padding-left:24px;color:{theme['text_color']};",
        "li": "margin-bottom:10px;line-height:1.85;font-size:16px;",
        "summary": (
            "margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #fbbf24;"
            "color:#57534e;font-size:14px;line-height:1.75;"
        ),
        "image_wrap": "margin:20px 0;text-align:center;",
        "image": "width:100%;max-width:100%;border-radius:8px;display:block;margin:0 auto;",
        "caption": "font-size:13px;color:#999;margin-top:8px;line-height:1.5;",
    }


def replace_image_placeholders(body: str, cover_assets: list[CoverAsset | dict[str, Any]]) -> str:
    result = body
    for index, asset in enumerate(cover_assets):
        url = asset.get("image_url", "") if isinstance(asset, dict) else asset.image_url
        if not url:
            continue
        result = result.replace(f"__IMAGE_{index}__", url)
    return result


def render_wechat_body_inline_html(
    body: str,
    theme: dict[str, Any] | None = None,
    cover_assets: list[CoverAsset | dict[str, Any]] | None = None,
) -> str:
    assets = cover_assets or []
    normalized = normalize_style_theme(theme)
    s = _styles(normalized)
    lines = body.split("\n")
    html: list[str] = []
    in_ol = False
    in_ul = False

    def close_lists() -> None:
        nonlocal in_ol, in_ul
        if in_ol:
            html.append("</ol>")
            in_ol = False
        if in_ul:
            html.append("</ul>")
            in_ul = False

    def resolve_image_src(src: str) -> tuple[str, str]:
        match = IMAGE_PLACEHOLDER_RE.match(src)
        if match:
            index = int(match.group(1))
            if index < len(assets):
                asset = assets[index]
                url = asset.get("image_url", "") if isinstance(asset, dict) else asset.image_url
                caption = (
                    asset.get("caption") or asset.get("subheadline") or ""
                    if isinstance(asset, dict)
                    else (asset.caption or asset.subheadline or "")
                )
                return url, caption
            return "", ""
        return src, ""

    def render_image(alt: str, src: str) -> str:
        url, caption = resolve_image_src(src)
        if not url:
            return (
                f'<section style="{s["image_wrap"]}">'
                f'<p style="{s["caption"]}">[配图：{_inline_format(alt or "待生成")}]</p>'
                f"</section>"
            )
        cap = caption or alt
        cap_html = f'<p style="{s["caption"]}">{_inline_format(cap)}</p>' if cap else ""
        return (
            f'<section style="{s["image_wrap"]}">'
            f'<img src="{url}" alt="{_escape_html(alt)}" style="{s["image"]}" />'
            f"{cap_html}</section>"
        )

    for line in lines:
        trimmed = line.strip()
        image_match = MARKDOWN_IMAGE_RE.match(trimmed)
        if image_match:
            close_lists()
            html.append(render_image(image_match.group(1), image_match.group(2)))
            continue

        if trimmed.startswith("### "):
            close_lists()
            html.append(f'<h4 style="{s["h4"]}">{_inline_format(trimmed[4:])}</h4>')
            continue
        if trimmed.startswith("## "):
            close_lists()
            html.append(f'<h3 style="{s["h3"]}">{_inline_format(trimmed[3:])}</h3>')
            continue
        if trimmed.startswith("# "):
            close_lists()
            html.append(f'<h2 style="{s["h2"]}">{_inline_format(trimmed[2:])}</h2>')
            continue
        if trimmed.startswith("> "):
            close_lists()
            html.append(f'<blockquote style="{s["quote"]}">{_inline_format(trimmed[2:])}</blockquote>')
            continue
        if re.fullmatch(r"(-{3,}|_{3,}|\*{3,})", trimmed):
            close_lists()
            html.append(f'<hr style="{s["hr"]}" />')
            continue

        ol_match = re.match(r"^(\d+)[.)]\s+(.+)$", trimmed)
        if ol_match:
            if not in_ol:
                close_lists()
                html.append(f'<ol style="{s["ol"]}">')
                in_ol = True
            html.append(f'<li style="{s["li"]}">{_inline_format(ol_match.group(2))}</li>')
            continue

        ul_match = re.match(r"^[-*•]\s+(.+)$", trimmed)
        if ul_match:
            if not in_ul:
                close_lists()
                html.append(f'<ul style="{s["ul"]}">')
                in_ul = True
            html.append(f'<li style="{s["li"]}">{_inline_format(ul_match.group(1))}</li>')
            continue

        if not trimmed:
            close_lists()
            continue

        close_lists()
        html.append(f'<p style="{s["p"]}">{_inline_format(trimmed)}</p>')

    close_lists()
    return "".join(html)


def build_formatted_html(
    content: WechatContent | dict[str, Any],
    cover_assets: list[CoverAsset | dict[str, Any]] | None = None,
) -> str:
    if isinstance(content, dict):
        data = content
    else:
        data = content.model_dump(mode="json")

    if data.get("formatted_html", "").strip():
        return data["formatted_html"]

    theme = data.get("style_theme") or {}
    summary = data.get("summary", "")
    body = data.get("body", "")
    parts: list[str] = []
    s = _styles(normalize_style_theme(theme))
    if summary.strip():
        parts.append(f'<blockquote style="{s["summary"]}">{_inline_format(summary)}</blockquote>')
    parts.append(render_wechat_body_inline_html(body, theme, cover_assets))
    return "".join(parts)


def finalize_wechat_content(
    wechat_data: dict[str, Any],
    cover_assets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    assets = cover_assets or []
    body = replace_image_placeholders(wechat_data.get("body", ""), assets)
    wechat_data = {**wechat_data, "body": body}
    content = WechatContent.model_validate(wechat_data)
    wechat_data["formatted_html"] = build_formatted_html(content.model_dump(mode="json"), assets)
    return wechat_data
