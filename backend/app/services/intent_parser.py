from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.models.schemas import Platform
from app.services.xiaohongshu_styles import parse_xhs_page_count_request


@dataclass
class ParsedIntent:
    intent: str
    target_platforms: list[Platform | str]
    constraints: list[str]
    title_count: int = 10
    title_search_friendly: bool = False
    patch_fields: list[str] = field(default_factory=list)
    layout_preset: str | None = None
    xhs_page_count: int | None = None


LAYOUT_PRESET_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"排版.*活泼|活泼一点|更活泼|活泼.*排版"), "lively"),
    (re.compile(r"清单风|干货清单|换成清单|清单.*排版"), "checklist"),
    (re.compile(r"故事风|叙事排版|故事.*排版|换成故事"), "story"),
    (re.compile(r"恢复经典|经典排版|换回经典|经典.*排版"), "classic"),
]


# 已有初稿时，较长消息视为补充素材/修改意见，优先 refine 而非误触 fact_check
NARRATIVE_REFINE_THRESHOLD = 80

QUICK_INTENTS = [
    (re.compile(r"不要太\s*AI|去\s*AI\s*化|少点\s*AI|AI\s*味|不像\s*AI|减少\s*AI"), "humanize", []),
    (re.compile(r"更温和|温和一点"), "refine_draft", ["温和"]),
    (re.compile(r"更犀利|犀利一点"), "refine_draft", ["犀利"]),
    (re.compile(r"缩短|精简|短一点"), "refine_draft", ["shorter"]),
    (re.compile(r"搜一搜友好.*标题|搜索友好.*标题|搜一搜.*标题"), "generate_titles", []),
    (re.compile(r"(\d+)\s*个标题"), "generate_titles", []),
    (re.compile(r"生成标题|标题备选|再来.*标题|重新.*标题"), "generate_titles", []),
    (re.compile(r"优化开头|开头.*痛点|前\s*3\s*段.*痛点"), "optimize_opening", []),
    (re.compile(r"加.*互动提问|具体互动|互动提问"), "add_engagement_question", []),
    (re.compile(r"撰写.*初稿|生成初稿|写初稿|观察型初稿|填充.*初稿"), "generate_draft", []),
    (re.compile(r"三个平台|全平台|一键生成|生成全部平台|生成三平台"), "generate_all", []),
    (re.compile(r"生成公众号|公众号版本|转成公众号"), "generate_platform", ["wechat"]),
    (re.compile(r"生成小红书|小红书版本|转成小红书"), "generate_platform", ["xiaohongshu"]),
    (re.compile(r"生成抖音|抖音版本|口播脚本|转成抖音"), "generate_platform", ["douyin"]),
    (re.compile(r"撤销|回退|上一版"), "rollback", []),
    (re.compile(r"调整配图|配图位置|移动.*图|图.*移到|重新排版.*图|插入配图|图片位置"), "layout_images", []),
    (re.compile(r"一键.*轮播|批量.*轮播|全部.*轮播|生成.*轮播图|轮播图.*生成|轮播.*配图"), "generate_xhs_carousel", []),
    (re.compile(r"封面.*暖色|暖色.*封面|纪实.*封面|封面.*纪实|少.*AI|重新.*封面|封面.*风格"), "regenerate_cover", []),
    (re.compile(r"封面|配图"), "cover_assets", []),
    (re.compile(r"同步.*平台|更新.*平台"), "patch_platform", []),
]

# 仅匹配明确的合规/风险扫描指令，避免「体检检查」等日常用语误触
RE_EXPLICIT_FACT_CHECK = re.compile(
    r"(?:"
    r"检查.*(?:敏感|夸大|风险|表述|错别字|违规)"
    r"|(?:敏感|夸大).*(?:表述|说法|内容|用语)"
    r"|(?:有没有|是否存在).*(?:敏感|夸大|风险)"
    r"|风险扫描|扫描.*风险|事实核查"
    r"|^检查(?:一下)?(?:敏感|夸大|风险|表述)"
    r")"
)


def is_explicit_fact_check_request(message: str) -> bool:
    return bool(RE_EXPLICIT_FACT_CHECK.search(message.strip()))


def parse_intent(
    message: str,
    selected_platform: Platform,
    *,
    has_draft: bool = False,
) -> ParsedIntent:
    text = message.strip()
    narrative_refine = has_draft and len(text) >= NARRATIVE_REFINE_THRESHOLD

    for pattern, preset in LAYOUT_PRESET_PATTERNS:
        if pattern.search(text):
            return ParsedIntent(
                intent="layout_preset",
                target_platforms=["wechat"],
                constraints=[],
                layout_preset=preset,
            )

    for pattern, intent, constraints in QUICK_INTENTS:
        match = pattern.search(text)
        if not match:
            continue
        if narrative_refine and intent == "cover_assets":
            continue
        title_count = 10
        title_search_friendly = False
        if intent == "generate_titles":
            if match.groups():
                title_count = int(match.group(1))
            if re.search(r"搜一搜|搜索友好", text):
                title_search_friendly = True
        platforms = (
            list(constraints)
            if intent == "generate_platform" and constraints
            else _resolve_platforms(text, selected_platform)
        )
        return ParsedIntent(
            intent=intent,
            target_platforms=platforms,
            constraints=constraints,
            title_count=title_count,
            title_search_friendly=title_search_friendly,
        )

    if not narrative_refine and RE_EXPLICIT_FACT_CHECK.search(text):
        return ParsedIntent("fact_check", [], [])

    xhs_count = parse_xhs_page_count_request(text)
    if xhs_count is not None and (
        selected_platform == "xiaohongshu"
        or re.search(r"图|轮播|配图|小红书|笔记|单图", text)
    ):
        return ParsedIntent(
            intent="xhs_page_count",
            target_platforms=["xiaohongshu"],
            constraints=[],
            xhs_page_count=xhs_count,
        )

    if not narrative_refine:
        if re.search(r"只改.*标题|改一下标题|修改标题|标题改|换个标题", text):
            return ParsedIntent(
                "patch_field",
                _resolve_platforms(text, selected_platform),
                [],
                patch_fields=["title"],
            )
        if re.search(r"只改.*标签|改.*话题|标签改|换.*标签", text):
            return ParsedIntent("patch_field", ["xiaohongshu"], [], patch_fields=["tags"])
        if re.search(r"只改.*正文|改.*段落|缩短.*段|正文改|改一下正文", text):
            return ParsedIntent(
                "patch_field",
                _resolve_platforms(text, selected_platform),
                [],
                patch_fields=["body"],
            )
        if re.search(r"只改|仅改|(?:^|[，。！？\s])公众号", text):
            return ParsedIntent("patch_platform", ["wechat"], [])
        if re.search(r"只改|仅改|小红书|笔记", text):
            return ParsedIntent("patch_platform", ["xiaohongshu"], [])
        if re.search(r"只改|仅改|抖音|口播|脚本", text):
            return ParsedIntent("patch_platform", ["douyin"], [])

    return ParsedIntent("refine_draft", [], [])


def _resolve_platforms(text: str, selected_platform: Platform) -> list[Platform | str]:
    if re.search(r"全部|三个平台|全平台", text):
        return ["wechat", "xiaohongshu", "douyin"]
    if re.search(r"公众号|微信", text):
        return ["wechat"]
    if re.search(r"小红书|笔记", text):
        return ["xiaohongshu"]
    if re.search(r"抖音|口播|脚本", text):
        return ["douyin"]
    return [selected_platform]
