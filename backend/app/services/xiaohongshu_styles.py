"""小红书封面与内页风格库，基于 app/xiaohongshu_example 示例素材。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from app.config import ROOT_DIR

EXAMPLE_DIR = ROOT_DIR / "backend" / "app" / "xiaohongshu_example"

_STYLE_LABELS: dict[str, str] = {
    "direct_conversation_aesthetic": "对话式纯色封面",
    "split_screen_layout": "上下分屏布局",
    "warm_documentary_photography_of_a_rural_sunset_over": "暖色纪实摄影",
    "minimalist_geometric": "极简几何图形",
    "story_snapshot_layout": "故事快照布局",
    "journaling_style": "手帐俯拍风格",
    "question_engagement_layout": "提问互动布局",
    "minimalist_typography_focused_design": "极简大字排版",
    "atmospheric_macro_photography_of_morning_dew_on_a_green": "氛围微距摄影",
    "intimate_reflection_layout": "私密反思布局",
    "raw_human_engagement_aesthetic": "真实互动风格",
    "step_by_step_or_guide_layout": "步骤指南拼图",
    "high_contrast_black_and_white_photography_of_a_bustling": "高对比黑白街拍",
    "mini_story_collage": "迷你故事拼贴",
    "personal_essay_aesthetic": "个人随笔美学",
    "artistic_lifestyle_photography": "文艺生活方式",
    "modern_collage_aesthetic": "现代拼贴美学",
}

_STYLE_BEST_FOR: dict[str, str] = {
    "direct_conversation_aesthetic": "观点输出、对话感强的笔记",
    "split_screen_layout": "深度观察、街拍纪实类",
    "warm_documentary_photography_of_a_rural_sunset_over": "生活观察、乡村/田园主题",
    "minimalist_geometric": "干货清单、消费避坑指南",
    "story_snapshot_layout": "个人故事、情感叙事",
    "journaling_style": "慢生活、手作、治愈系",
    "question_engagement_layout": "互动讨论、引发评论",
    "minimalist_typography_focused_design": "干货指南、工具推荐",
    "atmospheric_macro_photography_of_morning_dew_on_a_green": "自然治愈、氛围感内容",
    "intimate_reflection_layout": "内心独白、情感反思",
    "raw_human_engagement_aesthetic": "真实分享、接地气话题",
    "step_by_step_or_guide_layout": "教程步骤、操作指南",
    "high_contrast_black_and_white_photography_of_a_bustling": "社会观察、城市纪实",
    "mini_story_collage": "前后对比、小故事",
    "personal_essay_aesthetic": "随笔散文、深度思考",
    "artistic_lifestyle_photography": "文艺生活、美学分享",
    "modern_collage_aesthetic": "多元素拼贴、旅行/探店",
}

_DEFAULT_STYLE = "warm_documentary_photography_of_a_rural_sunset_over"
XHS_MIN_PAGES = 1
XHS_MAX_PAGES = 6


def split_body_sections(body: str) -> list[str]:
    return [s.strip() for s in re.split(r"\n{2,}", body or "") if s.strip()]


def extract_xiaohongshu_point_sections(body: str) -> list[str]:
    sections = split_body_sections(body)
    points: list[str] = []
    for section in sections:
        if re.search(r"【要点|^[·•]|^\d+[\.、）\)]", section, re.M):
            points.append(section)
    return points


def estimate_xiaohongshu_page_count(title: str, body: str) -> int:
    """按内容复杂度估算配图张数：短内容 1 张，干货轮播最多 6 张。"""
    text = (body or "").strip()
    if not text:
        return 1

    sections = split_body_sections(text)
    points = extract_xiaohongshu_point_sections(text)
    body_len = len(text)

    if body_len <= 180 and len(sections) <= 2 and len(points) <= 1:
        return 1

    if body_len <= 320 and len(points) <= 1:
        return 2

    content_slots = len(points) if points else max(1, len(sections) - 1)
    content_slots = min(4, content_slots)
    wants_summary = body_len > 300 or bool(re.search(r"评论|收藏|聊聊|同感|互动", text))
    total = 1 + content_slots + (1 if wants_summary and content_slots >= 2 else 0)
    return max(XHS_MIN_PAGES, min(XHS_MAX_PAGES, total))


def trim_xiaohongshu_pages(pages: list[dict], *, max_pages: int = XHS_MAX_PAGES) -> list[dict]:
    if len(pages) <= max_pages:
        return pages
    cover = pages[0]
    summary = pages[-1] if pages[-1].get("role") == "summary" else None
    middle = pages[1:-1] if summary else pages[1:]
    budget = max_pages - 1 - (1 if summary else 0)
    trimmed = [cover, *middle[: max(0, budget)]]
    if summary and len(trimmed) < max_pages:
        trimmed.append(summary)
    return trimmed[:max_pages]


@dataclass(frozen=True)
class XiaohongshuCoverStyle:
    id: str
    label: str
    visual_prompt: str
    best_for: str
    example_path: str = ""

    def image_prompt(self, headline: str = "", subheadline: str = "", extra: str = "") -> str:
        text_bits = []
        if headline:
            text_bits.append(f'大字标题「{headline[:16]}」')
        if subheadline:
            text_bits.append(f'副标题「{subheadline[:24]}」')
        text_part = "，".join(text_bits)
        base = (
            f"小红书笔记封面，3:4竖版，{self.label}风格。"
            f"{self.visual_prompt}。"
            "高清、排版清爽、重点突出、真实自然，不要明显 AI 感。"
        )
        if text_part:
            base += f" 画面含{text_part}。"
        if extra:
            base += f" {extra}"
        return base[:900]


def _parse_example_dirname(name: str) -> tuple[str, str] | None:
    match = re.match(r"xiaohongshu_cover_style_(.+?)\._(.+)", name)
    if not match:
        return None
    style_id = match.group(1)
    visual = match.group(2).replace("_", " ").strip()
    return style_id, visual


def load_cover_styles(example_dir: Path | None = None) -> list[XiaohongshuCoverStyle]:
    root = example_dir or EXAMPLE_DIR
    styles: list[XiaohongshuCoverStyle] = []
    if not root.is_dir():
        return [_fallback_style()]

    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        parsed = _parse_example_dirname(child.name)
        if not parsed:
            continue
        style_id, visual = parsed
        example = child / "screen.png"
        styles.append(
            XiaohongshuCoverStyle(
                id=style_id,
                label=_STYLE_LABELS.get(style_id, style_id.replace("_", " ")),
                visual_prompt=visual,
                best_for=_STYLE_BEST_FOR.get(style_id, "通用生活分享"),
                example_path=str(example) if example.exists() else "",
            )
        )
    return styles or [_fallback_style()]


def _fallback_style() -> XiaohongshuCoverStyle:
    return XiaohongshuCoverStyle(
        id=_DEFAULT_STYLE,
        label="暖色纪实摄影",
        visual_prompt="warm documentary photography, rural sunset, cinematic natural light",
        best_for="生活观察、真实分享",
    )


def get_style(style_id: str) -> XiaohongshuCoverStyle:
    for style in load_cover_styles():
        if style.id == style_id:
            return style
    return _fallback_style()


def pick_style_for_content(title: str = "", body: str = "", hint: str = "") -> XiaohongshuCoverStyle:
    text = f"{title} {body} {hint}".lower()
    rules: list[tuple[str, str]] = [
        (r"步骤|教程|指南|怎么|如何|攻略", "step_by_step_or_guide_layout"),
        (r"提问|评论区|聊聊|你有同感|是不是", "question_engagement_layout"),
        (r"观察|深度|社会|角落|纪实", "split_screen_layout"),
        (r"农村|乡村|田园|回村|老家", "warm_documentary_photography_of_a_rural_sunset_over"),
        (r"手作|茶|治愈|慢生活|日记", "journaling_style"),
        (r"对比|之前|之后|故事", "mini_story_collage"),
        (r"清单|避坑|干货|tips|推荐", "minimalist_typography_focused_design"),
        (r"黑白|街拍|城市|喧嚣", "high_contrast_black_and_white_photography_of_a_bustling"),
        (r"文艺|美学|复古", "artistic_lifestyle_photography"),
        (r"拼贴|探店|旅行", "modern_collage_aesthetic"),
    ]
    for pattern, style_id in rules:
        if re.search(pattern, text, re.I):
            return get_style(style_id)
    return get_style(_DEFAULT_STYLE)


def styles_reference_block() -> str:
    lines = ["【小红书封面风格库 — 从以下风格中选 1 种作为 cover_style】"]
    for style in load_cover_styles():
        lines.append(f"- {style.id}: {style.label}（适合：{style.best_for}）")
    return "\n".join(lines)


def resolve_style_for_xhs(
    *,
    title: str = "",
    body: str = "",
    cover_style: str = "",
) -> XiaohongshuCoverStyle:
    style_id = str(cover_style or "").strip()
    if style_id:
        return get_style(style_id)
    return pick_style_for_content(title, body, "")


def series_style_anchor(
    style: XiaohongshuCoverStyle,
    *,
    page_index: int,
    total_pages: int,
) -> str:
    return (
        f"【系列统一】同一篇小红书笔记共{total_pages}张轮播，"
        f"这是第{page_index}张；全系列固定「{style.label}」视觉语言："
        f"{style.visual_prompt}。"
        "配色、字体、排版、插画/摄影质感必须与其他张保持一致，像同一设计师产出。"
    )


def build_xhs_page_prompt(
    *,
    style: XiaohongshuCoverStyle,
    role: str,
    headline: str,
    subheadline: str = "",
    body_text: str = "",
    page_index: int = 1,
    total_pages: int = 1,
) -> str:
    if role == "cover" or page_index == 1:
        core = style.image_prompt(
            headline=headline[:16],
            subheadline=subheadline[:24],
        )
    else:
        core = content_page_prompt(
            headline=headline,
            body_text=body_text,
            page_index=page_index,
            style=style,
        )
    anchor = series_style_anchor(style, page_index=page_index, total_pages=total_pages)
    return f"{core} {anchor}"[:900]


def polish_xiaohongshu_body(body: str) -> str:
    """轻量清洗正文：去多余空行、规范要点标记、控制段落长度。"""
    text = (body or "").strip()
    if not text:
        return text

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    cleaned: list[str] = []
    for para in paragraphs:
        para = re.sub(r"[ \t]+", " ", para)
        para = re.sub(r"^(?:要点|Tip|tip)\s*[:：]\s*", "【要点】", para, flags=re.I)
        if len(para) > 280:
            para = para[:277].rstrip() + "…"
        cleaned.append(para)

    if len(cleaned) == 1 and len(cleaned[0]) > 220:
        chunk = cleaned[0]
        sentences = re.split(r"(?<=[。！？!?])\s*", chunk)
        rebuilt: list[str] = []
        current = ""
        for sentence in sentences:
            if not sentence.strip():
                continue
            if len(current) + len(sentence) <= 120:
                current += sentence
            else:
                if current:
                    rebuilt.append(current.strip())
                current = sentence
        if current:
            rebuilt.append(current.strip())
        if len(rebuilt) >= 2:
            cleaned = rebuilt

    return "\n\n".join(cleaned)


def polish_xiaohongshu_title(title: str, body: str = "") -> str:
    text = (title or "").strip()
    if text:
        text = re.sub(r"[#@]{2,}", "", text)
        text = text[:22]
    elif body:
        first = split_body_sections(body)[0] if body else ""
        text = first[:18].rstrip("，。！？!?") + "…" if len(first) > 18 else first
    return text or "生活观察"


def content_page_prompt(
    *,
    headline: str,
    body_text: str = "",
    page_index: int = 1,
    style: XiaohongshuCoverStyle | None = None,
) -> str:
    style = style or _fallback_style()
    detail = body_text[:80].replace("\n", " ") if body_text else ""
    return (
        f"小红书笔记内页第{page_index}张，3:4竖版，延续「{style.label}」系列风格。"
        f"视觉语言：{style.visual_prompt}。"
        f"简洁背景，突出文字「{headline[:20]}」"
        f"{f'，要点：{detail}' if detail else ''}。"
        "排版清爽、留白充足、真实自然，不要明显 AI 感。"
    )[:900]
