from __future__ import annotations

import re
from dataclasses import dataclass

DEFAULT_PATTERNS: list[tuple[str, str, str, str]] = [
    (
        r"一定|必然|肯定|百分之百",
        "避免绝对化表述，建议改为「可能」「往往」等观察语气",
        "default",
        "",
    ),
    (
        r"所有人|每个家庭都|全网|全国",
        "避免以偏概全，建议补充「在我身边」「我观察到」",
        "default",
        "",
    ),
    (
        r"震惊|必看|赶紧转发|不看后悔",
        "营销号风格词汇，建议删除或改写",
        "default",
        "",
    ),
    (
        r"包治|根治|特效|立刻见效|药到病除|一吃就好",
        "健康类表述风险较高，建议加「个人观察，非医疗建议」",
        "health",
        "以上仅为个人观察与生活记录，不构成医疗建议。如有健康问题，请咨询专业医生。",
    ),
    (
        r"官方已证实|国家已经宣布",
        "若缺乏可靠来源，建议删除或改为「有报道提到」",
        "default",
        "",
    ),
]

HEALTH_DISCLAIMER = (
    "以上仅为个人观察与生活记录，不构成医疗建议。如有健康问题，请咨询专业医生。"
)


@dataclass
class RiskWarning:
    phrase: str
    suggestion: str
    source: str
    suggested_insert: str = ""
    warning_type: str = "default"


def scan_text(text: str, extra_banned: list[str] | None = None) -> list[RiskWarning]:
    warnings: list[RiskWarning] = []
    if not text.strip():
        return warnings

    for pattern, suggestion, warning_type, suggested_insert in DEFAULT_PATTERNS:
        for match in re.finditer(pattern, text):
            warnings.append(
                RiskWarning(
                    phrase=match.group(0),
                    suggestion=suggestion,
                    source="default",
                    suggested_insert=suggested_insert,
                    warning_type=warning_type,
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


def get_health_disclaimer_insert(warnings: list[RiskWarning]) -> str:
    for item in warnings:
        if item.warning_type == "health" and item.suggested_insert:
            return item.suggested_insert
    return ""


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
        {
            "phrase": item.phrase,
            "suggestion": item.suggestion,
            "source": item.source,
            "suggested_insert": item.suggested_insert,
            "warning_type": item.warning_type,
        }
        for item in scan_text(merged, extra_banned)
    ]
