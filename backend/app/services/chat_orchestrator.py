from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime

from app.config import Settings
from app.models.schemas import (
    AuthorStyleProfile,
    ChatMessage,
    ContentPatch,
    ContentProject,
    ProjectVersion,
    RiskWarningItem,
)
from app.services.intent_parser import ParsedIntent, parse_intent
from app.services.llm_client import LLMClient
from app.services.mock_generator import (
    build_mock_cover_assets,
    build_mock_generate_all,
    build_mock_titles,
)
from app.services.fact_check import scan_project
from app.services.repository import apply_patch, parse_json_from_text
from app.services.skill_loader import SkillLoader


class ChatOrchestrator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = LLMClient(settings)
        self.skills = SkillLoader(settings)

    async def handle_message(
        self,
        project: ContentProject,
        message: str,
        selected_platform: str,
        style_profile: AuthorStyleProfile,
    ) -> tuple[ContentProject, ContentPatch, ChatMessage]:
        parsed = parse_intent(message, selected_platform)  # type: ignore[arg-type]
        project.chat_history.append(ChatMessage(role="user", content=message))

        if parsed.intent == "rollback":
            restored = self._rollback(project)
            patch = ContentPatch(
                intent="rollback",
                target_platforms=[],
                summary="已回退到上一版本。",
                patch={},
            )
            assistant = ChatMessage(role="assistant", content=patch.summary)
            restored.chat_history.append(assistant)
            return restored, patch, assistant

        patch = await self._execute(project, message, parsed, style_profile)
        self._snapshot(project, patch.summary)
        updated = apply_patch(project, patch)
        updated.updated_at = datetime.utcnow()
        updated.risk_warnings = self._build_warnings(updated, style_profile)
        if updated.risk_warnings and patch.intent != "fact_check":
            patch.summary += f" 检测到 {len(updated.risk_warnings)} 处表述风险，请在内容区查看。"
        assistant = ChatMessage(role="assistant", content=patch.summary)
        updated.chat_history.append(assistant)
        return updated, patch, assistant

    async def _execute(
        self,
        project: ContentProject,
        message: str,
        parsed: ParsedIntent,
        style_profile: AuthorStyleProfile,
    ) -> ContentPatch:
        if parsed.intent == "generate_all":
            if self.llm.status().configured:
                return await self._llm_generate_all(project, message, style_profile)
            return build_mock_generate_all(project)

        if parsed.intent == "generate_titles":
            if self.llm.status().configured:
                return await self._llm_titles(project, parsed.title_count, style_profile)
            return build_mock_titles(project, parsed.title_count)

        if parsed.intent == "cover_assets":
            if self.llm.status().configured:
                return await self._llm_cover_assets(project, style_profile)
            return build_mock_cover_assets(project)

        if parsed.intent == "fact_check":
            warnings = self._build_warnings(project, style_profile)
            summary = (
                f"已完成风险扫描，发现 {len(warnings)} 处需留意的表述。"
                if warnings
                else "未发现明显敏感或夸大表述。"
            )
            return ContentPatch(
                intent="fact_check",
                target_platforms=["all"],
                summary=summary,
                patch={},
            )

        if parsed.intent == "humanize":
            if self.llm.status().configured:
                humanized = ParsedIntent("patch_platform", parsed.target_platforms, parsed.constraints)
                return await self._llm_patch(project, message, humanized, style_profile)
            patch = build_mock_generate_all(project)
            patch.summary = "已按更温和、真实的观察语气刷新三平台内容。"
            return patch

        if self.llm.status().configured:
            return await self._llm_patch(project, message, parsed, style_profile)

        fallback = build_mock_generate_all(project)
        fallback.summary = (
            "未识别到更具体的指令，已为你刷新三平台模板内容。"
            "配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后可启用 AI 对话修改。"
        )
        return fallback

    async def _llm_generate_all(
        self,
        project: ContentProject,
        message: str,
        style_profile: AuthorStyleProfile,
    ) -> ContentPatch:
        skill = self.skills.load("postcraft-orchestrator")
        system_prompt = (
            f"{skill}\n\n"
            "你现在执行 generate_all。请输出 JSON，格式如下：\n"
            '{"summary":"...", "patch": {"humanized":"...", "draft":"...", '
            '"platforms.wechat": {"title":"","summary":"","body":""}, '
            '"platforms.xiaohongshu": {"title":"","body":"","tags":[]}, '
            '"platforms.douyin": {"hook":"","duration":"90s","script":[{"index":1,"duration":"3s","narration":"","visual":"","subtitle":""}]}, '
            '"titles":[{"text":"","style":""}], '
            '"cover_assets":[{"platform":"all","headline":"","subheadline":"","prompt":""}]}}'
        )
        user_prompt = self._build_user_context(project, message, style_profile)
        raw = await self.llm.complete(system_prompt, user_prompt)
        payload = parse_json_from_text(raw)
        return ContentPatch(
            intent="generate_all",
            target_platforms=["wechat", "xiaohongshu", "douyin"],
            summary=payload.get("summary", "已生成三平台初稿。"),
            patch=payload.get("patch", {}),
        )

    async def _llm_patch(
        self,
        project: ContentProject,
        message: str,
        parsed: ParsedIntent,
        style_profile: AuthorStyleProfile,
    ) -> ContentPatch:
        skill = self.skills.load("postcraft-orchestrator")
        system_prompt = (
            f"{skill}\n\n"
            "你现在执行 patch_platform。只修改必要字段，输出 JSON："
            '{"summary":"...", "patch": {"platforms.wechat.body":"..."}}'
        )
        user_prompt = (
            self._build_user_context(project, message, style_profile)
            + f"\n\n目标平台: {parsed.target_platforms}\n用户指令: {message}"
        )
        raw = await self.llm.complete(system_prompt, user_prompt)
        payload = parse_json_from_text(raw)
        return ContentPatch(
            intent="patch_platform",
            target_platforms=parsed.target_platforms,  # type: ignore[arg-type]
            summary=payload.get("summary", "已更新内容。"),
            patch=payload.get("patch", {}),
        )

    async def _llm_titles(
        self,
        project: ContentProject,
        count: int,
        style_profile: AuthorStyleProfile,
    ) -> ContentPatch:
        system_prompt = "你是中文标题策划，输出 JSON：{\"summary\":\"...\",\"patch\":{\"titles\":[{\"text\":\"\",\"style\":\"\"}]}}"
        user_prompt = (
            self._build_user_context(project, f"生成{count}个标题", style_profile)
            + f"\n请生成 {count} 个标题，避免营销词：{style_profile.banned_phrases}"
        )
        raw = await self.llm.complete(system_prompt, user_prompt)
        payload = parse_json_from_text(raw)
        return ContentPatch(
            intent="generate_titles",
            target_platforms=["all"],
            summary=payload.get("summary", f"已生成 {count} 个标题。"),
            patch=payload.get("patch", {}),
        )

    async def _llm_cover_assets(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
    ) -> ContentPatch:
        system_prompt = (
            "你是封面策划，输出 JSON："
            '{"summary":"...","patch":{"cover_assets":[{"platform":"all","headline":"","subheadline":"","prompt":""}]}}'
        )
        user_prompt = self._build_user_context(project, "生成封面文案和配图提示词", style_profile)
        raw = await self.llm.complete(system_prompt, user_prompt)
        payload = parse_json_from_text(raw)
        return ContentPatch(
            intent="cover_assets",
            target_platforms=["all"],
            summary=payload.get("summary", "已生成封面素材。"),
            patch=payload.get("patch", {}),
        )

    def _build_user_context(
        self,
        project: ContentProject,
        message: str,
        style_profile: AuthorStyleProfile,
    ) -> str:
        context = {
            "inspiration": project.inspiration,
            "topic_meta": project.topic_meta.model_dump(mode="json"),
            "platforms": {
                key: value.model_dump(mode="json")
                for key, value in project.platforms.items()
            },
            "style_profile": style_profile.model_dump(mode="json"),
            "message": message,
        }
        return json.dumps(context, ensure_ascii=False, indent=2)

    def _build_warnings(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
    ) -> list[RiskWarningItem]:
        raw = scan_project(project, style_profile.banned_phrases)
        return [RiskWarningItem.model_validate(item) for item in raw]

    def _snapshot(self, project: ContentProject, label: str) -> None:
        snapshot = ProjectVersion(
            label=label[:80],
            snapshot=project.model_dump(mode="json"),
        )
        project.versions.append(snapshot)
        if len(project.versions) > 20:
            project.versions = project.versions[-20:]

    def _rollback(self, project: ContentProject) -> ContentProject:
        if len(project.versions) < 2:
            return project
        previous = project.versions[-2].snapshot
        restored = ContentProject.model_validate(deepcopy(previous))
        restored.versions = project.versions[:-1]
        return restored
