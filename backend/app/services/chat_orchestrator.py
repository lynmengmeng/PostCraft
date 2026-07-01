from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Awaitable, Callable

from app.config import Settings
from app.models.schemas import (
    AuthorStyleProfile,
    ChangeRecord,
    ChatMessage,
    ContentPatch,
    ContentProject,
    ProjectVersion,
    RiskWarningItem,
)
from app.services.fact_check import scan_project
from app.services.image_generator import ImageGenerator
from app.services.intent_parser import ParsedIntent, parse_intent
from app.services.llm_client import LLMClient
from app.services.mock_generator import (
    build_mock_cover_assets,
    build_mock_generate_all,
    build_mock_titles,
)
from app.services.pipeline import ContentPipeline
from app.services.repository import apply_patch
from app.services.skill_loader import SkillLoader
from app.skill_pipelines import ALL_PLATFORMS

StreamCallback = Callable[[str], Awaitable[None]] | None


class ChatOrchestrator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = LLMClient(settings)
        self.skills = SkillLoader(settings)
        self.pipeline = ContentPipeline(self.llm, self.skills)
        self.images = ImageGenerator(settings)

    async def handle_message(
        self,
        project: ContentProject,
        message: str,
        selected_platform: str,
        style_profile: AuthorStyleProfile,
        on_delta: StreamCallback = None,
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

        patch = await self._execute(project, message, parsed, style_profile, on_delta)
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
        on_delta: StreamCallback = None,
    ) -> ContentPatch:
        if parsed.intent == "generate_all":
            if self.llm.status().configured:
                patch_data = await self.pipeline.generate_all(
                    project, style_profile, message, on_delta=on_delta
                )
                patch_data = await self._attach_cover_images(patch_data)
                return ContentPatch(
                    intent="generate_all",
                    target_platforms=["wechat", "xiaohongshu", "douyin"],
                    summary="已通过 Skill 流水线生成三平台初稿。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            return build_mock_generate_all(project)

        if parsed.intent == "generate_titles":
            if self.llm.status().configured:
                humanized = project.humanized or project.draft or project.inspiration
                titles = await self.pipeline._generate_titles(
                    project, style_profile, humanized, parsed.title_count
                )
                return ContentPatch(
                    intent="generate_titles",
                    target_platforms=["all"],
                    summary=f"已生成 {len(titles)} 个标题备选。",
                    patch={"titles": titles},
                )
            return build_mock_titles(project, parsed.title_count)

        if parsed.intent == "cover_assets":
            if self.llm.status().configured:
                platforms = {
                    k: v.model_dump(mode="json") for k, v in project.platforms.items()
                }
                assets = await self.pipeline._generate_cover_prompts(project, style_profile, platforms)
                patch_data = {"cover_assets": assets}
                patch_data = await self._attach_cover_images(patch_data)
                return ContentPatch(
                    intent="cover_assets",
                    target_platforms=["all"],
                    summary="已生成封面文案、配图提示词与封面图。",
                    patch=patch_data,
                )
            patch = build_mock_cover_assets(project)
            patch_data = await self._attach_cover_images(patch.patch)
            patch.patch = patch_data
            return patch

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

        if parsed.intent in {"humanize", "patch_platform"}:
            if self.llm.status().configured:
                targets = (
                    ALL_PLATFORMS
                    if parsed.intent == "humanize"
                    else list(parsed.target_platforms)
                )
                patch_data = await self.pipeline.patch_platforms(
                    project, style_profile, message, targets, on_delta=on_delta
                )
                return ContentPatch(
                    intent="patch_platform",
                    target_platforms=targets,  # type: ignore[arg-type]
                    summary="已更新中间体并同步到目标平台。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            patch = build_mock_generate_all(project)
            patch.summary = "已按更温和、真实的观察语气刷新三平台内容。"
            return patch

        if self.llm.status().configured:
            patch_data = await self.pipeline.patch_platforms(
                project, style_profile, message, [selected_platform], on_delta=on_delta
            )
            return ContentPatch(
                intent="patch_platform",
                target_platforms=[selected_platform],  # type: ignore[arg-type]
                summary="已更新内容。",
                patch=patch_data,
                changes=self._changes_from_patch(patch_data),
            )

        fallback = build_mock_generate_all(project)
        fallback.summary = (
            "未识别到更具体的指令，已为你刷新三平台模板内容。"
            "配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后可启用 AI 对话修改。"
        )
        return fallback

    async def _attach_cover_images(self, patch_data: dict[str, Any]) -> dict[str, Any]:
        assets = patch_data.get("cover_assets") or []
        if not assets:
            return patch_data

        updated_assets = []
        image_url = ""
        for asset in assets:
            prompt = asset.get("prompt", "纪实风格封面")
            image_url = await self.images.generate(prompt)
            asset = {**asset, "image_url": image_url}
            updated_assets.append(asset)

        patch_data["cover_assets"] = updated_assets
        if image_url:
            if "platforms.xiaohongshu" in patch_data and isinstance(patch_data["platforms.xiaohongshu"], dict):
                patch_data["platforms.xiaohongshu"]["cover_image"] = image_url
            else:
                patch_data["platforms.xiaohongshu.cover_image"] = image_url
        return patch_data

    def _changes_from_patch(self, patch_data: dict[str, Any]) -> list[ChangeRecord]:
        return [
            ChangeRecord(path=key, action="replace", after_preview=str(value)[:120])
            for key, value in patch_data.items()
        ]

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
