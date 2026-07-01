from __future__ import annotations

import re
from dataclasses import dataclass

from app.models.schemas import Platform


@dataclass
class ParsedIntent:
    intent: str
    target_platforms: list[Platform | str]
    constraints: list[str]
    title_count: int = 10


QUICK_INTENTS = [
    (re.compile(r"更温和|温和一点"), "humanize", ["温和"]),
    (re.compile(r"更犀利|犀利一点"), "humanize", ["犀利"]),
    (re.compile(r"缩短|精简|短一点"), "patch_platform", ["shorter"]),
    (re.compile(r"(\d+)个标题"), "generate_titles", []),
    (re.compile(r"生成.*初稿|三个平台|全平台"), "generate_all", []),
    (re.compile(r"撤销|回退|上一版"), "rollback", []),
    (re.compile(r"封面|配图"), "cover_assets", []),
    (re.compile(r"检查|敏感|夸大|风险"), "fact_check", []),
]


def parse_intent(message: str, selected_platform: Platform) -> ParsedIntent:
    text = message.strip()

    for pattern, intent, constraints in QUICK_INTENTS:
        match = pattern.search(text)
        if match:
            title_count = 10
            if intent == "generate_titles" and match.groups():
                title_count = int(match.group(1))
            return ParsedIntent(
                intent=intent,
                target_platforms=_resolve_platforms(text, selected_platform),
                constraints=constraints,
                title_count=title_count,
            )

    if re.search(r"只改|仅改|公众号", text):
        return ParsedIntent("patch_platform", ["wechat"], [])
    if re.search(r"小红书|笔记", text):
        return ParsedIntent("patch_platform", ["xiaohongshu"], [])
    if re.search(r"抖音|口播|脚本", text):
        return ParsedIntent("patch_platform", ["douyin"], [])

    return ParsedIntent("patch_platform", [selected_platform], [])


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
