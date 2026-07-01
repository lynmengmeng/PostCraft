from __future__ import annotations

from app.models.schemas import ChatMessage, ContentProject
from app.services.llm_client import LLMClient

RECENT_MESSAGE_LIMIT = 6


def recent_chat_messages(project: ContentProject) -> list[ChatMessage]:
    """Return messages kept in full for LLM context (after summary cutoff)."""
    through = max(0, project.chat_summary_through)
    if through <= 0 and len(project.chat_history) <= RECENT_MESSAGE_LIMIT:
        return list(project.chat_history)
    if through <= 0 and len(project.chat_history) > RECENT_MESSAGE_LIMIT:
        return list(project.chat_history[-RECENT_MESSAGE_LIMIT:])
    return list(project.chat_history[through:])


def should_refresh_summary(project: ContentProject) -> bool:
    """Re-summarize when history exceeds the recent window."""
    return len(project.chat_history) > RECENT_MESSAGE_LIMIT


def messages_to_summarize(project: ContentProject) -> list[ChatMessage]:
    total = len(project.chat_history)
    if total <= RECENT_MESSAGE_LIMIT:
        return []
    return list(project.chat_history[: total - RECENT_MESSAGE_LIMIT])


def summarize_chat_fallback(messages: list[ChatMessage]) -> str:
    if not messages:
        return ""
    lines: list[str] = []
    for item in messages[-12:]:
        role = "用户" if item.role == "user" else "助手"
        text = item.content.replace("\n", " ").strip()[:120]
        lines.append(f"- {role}：{text}")
    return "近期对话要点：\n" + "\n".join(lines)


async def summarize_chat(llm: LLMClient, messages: list[ChatMessage]) -> str:
    if not messages:
        return ""
    if not llm.status().configured:
        return summarize_chat_fallback(messages)

    transcript = "\n".join(
        f"{'用户' if m.role == 'user' else '助手'}: {m.content[:400]}"
        for m in messages[-24:]
    )
    system = (
        "你是创作室对话摘要助手。用 3-6 条 bullet 总结："
        "用户核心诉求、已完成的修改、当前内容方向、待解决偏好。"
        "只输出摘要正文，不要 JSON。"
    )
    user = f"请摘要以下对话：\n\n{transcript}"
    raw = (await llm.complete(system, user)).strip()
    return raw or summarize_chat_fallback(messages)


def build_chat_context_block(project: ContentProject) -> str:
    """Inject into LLM user prompt: summary + recent turns."""
    parts: list[str] = []
    if project.chat_summary.strip():
        parts.append(f"对话摘要（较早轮次）：\n{project.chat_summary.strip()}")

    recent = recent_chat_messages(project)
    if recent:
        lines = [
            f"{'用户' if m.role == 'user' else '助手'}: {m.content[:300]}"
            for m in recent
        ]
        parts.append("最近对话：\n" + "\n".join(lines))

    if not parts:
        return ""
    return "\n\n".join(parts) + "\n\n"
