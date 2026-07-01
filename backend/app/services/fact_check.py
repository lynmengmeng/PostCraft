from __future__ import annotations

import re
from dataclasses import dataclass

DEFAULT_PATTERNS: list[tuple[str, str]] = [
    (r"一定|必然|肯定|百分之百", "避免绝对化表述，建议改为「可能」「往往」等观察语气"),
    (r"所有人|每个家庭都|全网|全国", "避免以偏概全，建议补充「在我身边」「我观察到」"),
    (r"震惊|必看|赶紧转发|不看后悔", "营销号风格词汇，建议删除或改写"),
    (r"包治|根治|特效|立刻见效", "健康类表述风险较高，建议加「个人观察，非医疗建议」"),
    (r"官方已证实|国家已经宣布", "若缺乏可靠来源，建议删除或改为「有报道提到」"),
]


@dataclass
class RiskWarning:
    phrase: str
    suggestion: str
    source: str


def scan_text(text: str, extra_banned: list[str] | None = None) -> list[RiskWarning]:
    warnings: list[RiskWarning] = []
    if not text.strip():
        return warnings

    for pattern, suggestion in DEFAULT_PATTERNS:
        for match in re.finditer(pattern, text):
            warnings.append(
                RiskWarning(
                    phrase=match.group(0),
                    suggestion=suggestion,
                    source="default",
                )
            )

    for phrase in extra_banned or []:
        if phrase and phrase in text:
            warnings.append(
                RiskWarning(
                    phrase=phrase,
                    suggestion="命中作者禁用表达，建议替换",
                    source="style_profile",
                )
            )

    unique: dict[tuple[str, str], RiskWarning] = {}
    for item in warnings:
        unique[(item.phrase, item.suggestion)] = item
    return list(unique.values())


def scan_project(project, extra_banned: list[str] | None = None) -> list[dict[str, str]]:
    chunks: list[str] = [
        project.inspiration,
        project.humanized,
        project.platforms["wechat"].title,
        project.platforms["wechat"].body,
        project.platforms["xiaohongshu"].title,
        project.platforms["xiaohongshu"].body,
        project.platforms["douyin"].hook,
        " ".join(scene.narration for scene in project.platforms["douyin"].script),
    ]
    merged = "\n".join(part for part in chunks if part)
    return [
        {"phrase": item.phrase, "suggestion": item.suggestion, "source": item.source}
        for item in scan_text(merged, extra_banned)
    ]
