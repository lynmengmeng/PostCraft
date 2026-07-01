from __future__ import annotations

import json
from typing import Any, Callable, Awaitable

from app.skill_pipelines import ALL_PLATFORMS, PLATFORM_CONVERTERS
from app.models.schemas import AuthorStyleProfile, ContentProject, CoverAsset, TitleCandidate
from app.services.llm_client import LLMClient
from app.services.repository import parse_json_from_text
from app.services.skill_loader import SkillLoader

StreamCallback = Callable[[str], Awaitable[None]] | None


class ContentPipeline:
    """PRD §13.3: general-writing → humanizer-cn → platform converters."""

    def __init__(self, llm: LLMClient, skills: SkillLoader):
        self.llm = llm
        self.skills = skills

    async def generate_all(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str = "",
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        if on_delta:
            await on_delta("正在撰写通用初稿…")

        draft = await self._run_markdown_skill(
            "general-writing",
            project,
            style_profile,
            message or "基于灵感撰写观察型文章初稿",
            input_text=project.inspiration or project.title,
        )

        if on_delta:
            await on_delta("正在去 AI 化与人性化润色…")

        humanized = await self._run_markdown_skill(
            "humanizer-cn",
            project,
            style_profile,
            "对以下文章做去 AI 化、真实观察语气润色，保留观点与分寸感",
            input_text=draft,
        )

        platforms: dict[str, Any] = {}
        for platform in ALL_PLATFORMS:
            if on_delta:
                await on_delta(f"正在生成{platform}版本…")
            platforms[platform] = await self._run_converter(
                PLATFORM_CONVERTERS[platform],
                project,
                style_profile,
                humanized,
            )

        if on_delta:
            await on_delta("正在生成标题与封面提示…")

        titles = await self._generate_titles(project, style_profile, humanized, count=12)
        cover_assets = await self._generate_cover_prompts(project, style_profile, platforms)

        return {
            "draft": draft,
            "humanized": humanized,
            "platforms.wechat": platforms["wechat"],
            "platforms.xiaohongshu": platforms["xiaohongshu"],
            "platforms.douyin": platforms["douyin"],
            "titles": titles,
            "cover_assets": cover_assets,
        }

    async def patch_platforms(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str,
        target_platforms: list[str],
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        if on_delta:
            await on_delta("正在理解修改意图…")

        humanized = project.humanized or project.draft or project.inspiration
        skill = self.skills.load("postcraft-orchestrator")
        system = (
            f"{skill}\n\n"
            "执行 patch：根据用户指令修改 humanized 中间体 Markdown。"
            "输出 JSON：{\"humanized\":\"完整修改后的 Markdown\"}"
        )
        user = (
            self._style_block(style_profile)
            + f"\n\n当前 humanized:\n{humanized}\n\n用户指令: {message}"
        )
        raw = await self.llm.complete(system, user)
        payload = parse_json_from_text(raw)
        updated_humanized = payload.get("humanized", humanized)

        patch: dict[str, Any] = {"humanized": updated_humanized, "draft": updated_humanized}
        targets = list(target_platforms) if target_platforms else ALL_PLATFORMS
        if "all" in targets:
            targets = ALL_PLATFORMS

        for platform in targets:
            if platform not in PLATFORM_CONVERTERS:
                continue
            if on_delta:
                await on_delta(f"正在同步{platform}版本…")
            patch[f"platforms.{platform}"] = await self._run_converter(
                PLATFORM_CONVERTERS[platform],
                project,
                style_profile,
                updated_humanized,
            )

        return patch

    async def _run_markdown_skill(
        self,
        skill_name: str,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        task: str,
        input_text: str,
    ) -> str:
        skill = self.skills.load(skill_name)
        system = (
            f"{skill}\n\n"
            f"{self._style_block(style_profile)}\n\n"
            "只输出 Markdown 正文，不要 JSON，不要解释。"
        )
        user = (
            f"选题/灵感: {project.inspiration}\n"
            f"元信息: {json.dumps(project.topic_meta.model_dump(mode='json'), ensure_ascii=False)}\n"
            f"任务: {task}\n\n"
            f"输入内容:\n{input_text}"
        )
        return (await self.llm.complete(system, user)).strip()

    async def _run_converter(
        self,
        skill_name: str,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        humanized: str,
    ) -> dict[str, Any]:
        skill = self.skills.load(skill_name)
        if skill_name == "douyin-converter":
            schema_hint = (
                '{"hook":"","duration":"90s","script":[{"index":1,"duration":"3s",'
                '"narration":"","visual":"","subtitle":""}]}'
            )
        elif skill_name == "xiaohongshu-converter":
            schema_hint = '{"title":"","body":"","tags":[]}'
        else:
            schema_hint = '{"title":"","summary":"","body":""}'

        system = (
            f"{skill}\n\n"
            f"{self._style_block(style_profile)}\n\n"
            f"输出严格 JSON，格式: {schema_hint}"
        )
        user = f"中间体内容:\n{humanized}"
        raw = await self.llm.complete(system, user)
        return parse_json_from_text(raw)

    async def _generate_titles(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        humanized: str,
        count: int = 12,
    ) -> list[dict[str, Any]]:
        system = (
            "你是中文标题策划。输出 JSON："
            '{"titles":[{"text":"","style":"情绪共鸣型|问题型|警醒型|深度型|故事型"}]}'
        )
        user = (
            self._style_block(style_profile)
            + f"\n请生成 {count} 个标题，避免: {style_profile.banned_phrases}\n\n"
            + humanized[:2000]
        )
        raw = await self.llm.complete(system, user)
        payload = parse_json_from_text(raw)
        titles = payload.get("titles", [])
        return [
            TitleCandidate(text=t.get("text", ""), style=t.get("style", "深度型")).model_dump(mode="json")
            for t in titles
            if t.get("text")
        ]

    async def _generate_cover_prompts(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        platforms: dict[str, Any],
    ) -> list[dict[str, Any]]:
        wechat_title = platforms.get("wechat", {}).get("title", project.title)
        asset = CoverAsset(
            platform="all",
            headline=str(wechat_title)[:20],
            subheadline="真实观察 · 温和提醒",
            prompt="纪实风格，暖色乡村傍晚，真实生活场景，不要明显 AI 感",
        )
        return [asset.model_dump(mode="json")]

    def _style_block(self, style_profile: AuthorStyleProfile) -> str:
        snippets = "\n".join(f"- {s}" for s in style_profile.personal_snippets[:5])
        banned = "、".join(style_profile.banned_phrases)
        defaults = json.dumps(style_profile.platform_defaults, ensure_ascii=False)
        return (
            f"作者风格:\n"
            f"- 语气: {style_profile.tone_preference}\n"
            f"- 禁用表达: {banned}\n"
            f"- 个人素材:\n{snippets or '- 无'}\n"
            f"- 平台偏好: {defaults}"
        )
