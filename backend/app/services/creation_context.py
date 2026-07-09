from __future__ import annotations

from app.models.schemas import ContentProject

PLATFORM_LABELS = {
    "wechat": "公众号",
    "xiaohongshu": "小红书",
    "douyin": "抖音",
}


def build_creation_context_block(project: ContentProject) -> str:
    """Inject topic planning + hot trend analysis into LLM prompts."""
    parts: list[str] = []

    if project.topic_id and project.topic_title:
        parts.append(f"来源选题: {project.topic_title}")

    meta = project.topic_meta
    planning: list[str] = []
    if meta.direction:
        planning.append(f"方向: {meta.direction}")
    if meta.tone:
        planning.append(f"基调: {meta.tone}")
    if meta.audience:
        planning.append(f"受众: {meta.audience}")
    if meta.series:
        planning.append(f"系列: {meta.series}")
    if planning:
        parts.append("选题规划: " + "；".join(planning))

    snap = project.trend_snapshot
    if snap and (snap.analysis.why_hot or snap.analysis.account_angle or snap.summary):
        trend_lines = ["【热点分析背景】"]
        if snap.title:
            trend_lines.append(f"热点标题: {snap.title}")
        if snap.summary:
            trend_lines.append(f"摘要: {snap.summary}")
        if snap.analysis.why_hot:
            trend_lines.append(f"为什么热: {snap.analysis.why_hot}")
        if snap.analysis.account_angle:
            trend_lines.append(f"账号切入角度: {snap.analysis.account_angle}")
        ideas = [idea for idea in snap.analysis.topic_ideas if idea.strip()]
        if ideas:
            trend_lines.append("可参考选题角度: " + "；".join(ideas[:5]))
        if snap.analysis.caution:
            trend_lines.append(f"注意事项: {snap.analysis.caution}")
        parts.append("\n".join(trend_lines))

    media: list[str] = []
    if project.source_url.strip():
        media.append(f"参考链接: {project.source_url.strip()}")
    if project.image_url.strip():
        media.append(f"参考截图: {project.image_url.strip()}")
    if media:
        parts.append("原始素材: " + "；".join(media))

    if not parts:
        return ""
    return "\n\n".join(parts) + "\n\n"


def platform_tip_block(project: ContentProject, platform: str) -> str:
    snap = project.trend_snapshot
    if not snap or not snap.analysis.platform_tips:
        return ""
    tip = (snap.analysis.platform_tips.get(platform) or "").strip()
    if not tip:
        return ""
    label = PLATFORM_LABELS.get(platform, platform)
    return f"\n\n【{label}平台建议】\n{tip}\n"
