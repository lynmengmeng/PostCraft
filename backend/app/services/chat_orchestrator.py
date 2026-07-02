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
from app.services.chat_context import (
    RECENT_MESSAGE_LIMIT,
    build_chat_context_block,
    messages_to_summarize,
    should_refresh_summary,
    summarize_chat,
)
from app.services.fact_check import scan_project
from app.services.image_generator import ImageGenerator
from app.services.intent_parser import (
    NARRATIVE_REFINE_THRESHOLD,
    ParsedIntent,
    is_explicit_fact_check_request,
    parse_intent,
)
from app.services.llm_client import LLMClient
from app.services.mock_generator import (
    build_mock_cover_assets,
    build_mock_draft,
    build_mock_platforms,
    build_mock_refine_draft,
    build_mock_titles,
)
from app.services.pipeline import ContentPipeline
from app.services.repository import apply_patch
from app.services.skill_loader import SkillLoader
from app.services.wechat_html import finalize_wechat_content
from app.services.wechat_assets import next_asset_index
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
        action: str | None = None,
        target_platforms: list[str] | None = None,
        attachment_urls: list[str] | None = None,
    ) -> tuple[ContentProject, ContentPatch, ChatMessage]:
        parsed = self._resolve_intent(
            message,
            selected_platform,
            action,
            target_platforms,
            project,
            attachment_urls=attachment_urls,
        )
        user_content = message.strip() or self._default_user_label(parsed)
        if attachment_urls:
            user_content += f"\n[附件: {', '.join(attachment_urls)}]"
        project.chat_history.append(ChatMessage(role="user", content=user_content))

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

        patch = await self._execute(
            project,
            message,
            parsed,
            style_profile,
            on_delta,
            attachment_urls=attachment_urls,
        )
        self._snapshot(project, patch.summary)
        updated = apply_patch(project, patch)
        updated.updated_at = datetime.utcnow()
        await self._maybe_refresh_chat_summary(updated)
        updated.risk_warnings = self._build_warnings(updated, style_profile)
        if updated.risk_warnings and patch.intent != "fact_check":
            patch.summary += f" 检测到 {len(updated.risk_warnings)} 处表述风险，请在内容区查看。"
        assistant = ChatMessage(role="assistant", content=patch.summary)
        updated.chat_history.append(assistant)
        return updated, patch, assistant

    def _resolve_intent(
        self,
        message: str,
        selected_platform: str,
        action: str | None,
        target_platforms: list[str] | None,
        project: ContentProject,
        attachment_urls: list[str] | None = None,
    ) -> ParsedIntent:
        if action == "generate_draft":
            return ParsedIntent("generate_draft", [], [])
        if action == "generate_all":
            return ParsedIntent("generate_all", ALL_PLATFORMS, [])
        if action == "generate_platform":
            platforms = target_platforms or [selected_platform]
            return ParsedIntent("generate_platform", platforms, [])
        if action == "refine_draft":
            return ParsedIntent("refine_draft", [], [])
        if action == "layout_images":
            return ParsedIntent("layout_images", ["wechat"], [])
        has_draft = bool(project.humanized or project.draft)
        parsed = parse_intent(message, selected_platform, has_draft=has_draft)  # type: ignore[arg-type]
        parsed = self._coerce_draft_refine_intent(message, parsed, has_draft, action)
        if attachment_urls and parsed.intent == "refine_draft":
            return ParsedIntent("layout_images", ["wechat"], [])
        return parsed

    def _coerce_draft_refine_intent(
        self,
        message: str,
        parsed: ParsedIntent,
        has_draft: bool,
        action: str | None,
    ) -> ParsedIntent:
        """已有初稿时，避免「添加了这个检查」等日常用语误触 fact_check。"""
        if not has_draft or action:
            return parsed

        text = message.strip()
        if parsed.intent == "fact_check" and not is_explicit_fact_check_request(text):
            return ParsedIntent("refine_draft", [], parsed.constraints)

        if len(text) >= NARRATIVE_REFINE_THRESHOLD and parsed.intent in {
            "fact_check",
            "patch_platform",
            "cover_assets",
        }:
            return ParsedIntent("refine_draft", [], parsed.constraints)

        return parsed

    def _default_user_label(self, parsed: ParsedIntent) -> str:
        labels = {
            "generate_draft": "撰写观察型初稿",
            "generate_all": "一键生成三平台内容",
            "generate_platform": "生成平台内容",
            "refine_draft": "继续完善初稿",
            "layout_images": "调整公众号配图布局",
        }
        return labels.get(parsed.intent, parsed.intent)

    async def _execute(
        self,
        project: ContentProject,
        message: str,
        parsed: ParsedIntent,
        style_profile: AuthorStyleProfile,
        on_delta: StreamCallback = None,
        attachment_urls: list[str] | None = None,
    ) -> ContentPatch:
        if parsed.intent == "generate_draft":
            if self.llm.status().configured:
                patch_data = await self.pipeline.generate_draft(
                    project, style_profile, message, on_delta=on_delta
                )
                return ContentPatch(
                    intent="generate_draft",
                    target_platforms=[],
                    summary="已根据灵感生成观察型初稿，可在「初稿」区查看并继续对话打磨。满意后再生成各平台内容。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            return build_mock_draft(project)

        if parsed.intent == "generate_all":
            if not (project.humanized or project.draft):
                return ContentPatch(
                    intent="generate_all",
                    target_platforms=ALL_PLATFORMS,
                    summary="请先生成并确认初稿，再一键生成三平台内容。",
                    patch={},
                )
            if self.llm.status().configured:
                patch_data = await self.pipeline.generate_platforms(
                    project,
                    style_profile,
                    ALL_PLATFORMS,
                    on_delta=on_delta,
                    with_titles=True,
                )
                patch_data = await self._ensure_cover_assets(project, patch_data, style_profile)
                return ContentPatch(
                    intent="generate_all",
                    target_platforms=ALL_PLATFORMS,
                    summary="已根据当前初稿生成公众号、小红书、抖音三平台内容。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            patch = build_mock_platforms(project, ALL_PLATFORMS, with_titles=True)
            patch.patch = await self._ensure_cover_assets(project, patch.patch, style_profile)
            return patch

        if parsed.intent == "generate_platform":
            targets = [p for p in parsed.target_platforms if p in ALL_PLATFORMS] or ALL_PLATFORMS
            if not (project.humanized or project.draft):
                return ContentPatch(
                    intent="generate_platform",
                    target_platforms=targets,  # type: ignore[arg-type]
                    summary="请先生成并确认初稿，再生成平台内容。",
                    patch={},
                )
            if self.llm.status().configured:
                patch_data = await self.pipeline.generate_platforms(
                    project,
                    style_profile,
                    list(targets),
                    on_delta=on_delta,
                )
                if not project.cover_assets:
                    patch_data = await self._ensure_cover_assets(
                        project, patch_data, style_profile
                    )
                elif "wechat" in targets:
                    patch_data = self._finalize_wechat_in_patch(
                        patch_data,
                        [a.model_dump(mode="json") for a in project.cover_assets],
                    )
                label = "、".join(targets)
                summary = f"已根据当前初稿生成 {label} 内容。"
                if not project.cover_assets and patch_data.get("cover_assets"):
                    summary += " 已同步生成封面与配图。"
                return ContentPatch(
                    intent="generate_platform",
                    target_platforms=targets,  # type: ignore[arg-type]
                    summary=summary,
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            patch = build_mock_platforms(project, list(targets))
            if not project.cover_assets:
                patch.patch = await self._ensure_cover_assets(
                    project, patch.patch, style_profile
                )
            return patch

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
                wechat = project.platforms.get("wechat")
                if wechat and wechat.body:
                    patch_data["platforms.wechat"] = finalize_wechat_content(
                        wechat.model_dump(mode="json"),
                        patch_data.get("cover_assets") or [],
                    )
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

        if parsed.intent == "layout_images":
            if not project.platforms.get("wechat") or not project.platforms["wechat"].body:
                return ContentPatch(
                    intent="layout_images",
                    target_platforms=["wechat"],
                    summary="请先生成公众号正文，再调整配图位置。",
                    patch={},
                )
            if self.llm.status().configured:
                patch_data = await self.pipeline.layout_wechat_images(
                    project,
                    style_profile,
                    message,
                    attachment_urls=attachment_urls,
                    on_delta=on_delta,
                )
                patch_data = self._merge_uploaded_attachments(patch_data, attachment_urls or [])
                patch_data = self._finalize_wechat_in_patch(
                    patch_data,
                    patch_data.get("cover_assets")
                    or [a.model_dump(mode="json") for a in project.cover_assets],
                )
                return ContentPatch(
                    intent="layout_images",
                    target_platforms=["wechat"],
                    summary="已根据你的素材与指令调整公众号配图位置。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            return ContentPatch(
                intent="layout_images",
                target_platforms=["wechat"],
                summary="配置 LLM 后可自动调整配图布局；你也可在正文中手动写 ![图注](__IMAGE_0__)。",
                patch={},
            )

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

        if parsed.intent == "patch_platform":
            if self.llm.status().configured:
                targets = list(parsed.target_platforms) or ALL_PLATFORMS
                patch_data = await self.pipeline.patch_platforms(
                    project, style_profile, message, targets, on_delta=on_delta
                )
                if "wechat" in targets and project.cover_assets:
                    patch_data = self._finalize_wechat_in_patch(
                        patch_data,
                        [a.model_dump(mode="json") for a in project.cover_assets],
                    )
                return ContentPatch(
                    intent="patch_platform",
                    target_platforms=targets,  # type: ignore[arg-type]
                    summary="已更新初稿并同步到目标平台。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            patch = build_mock_platforms(project, list(parsed.target_platforms) or ALL_PLATFORMS)
            patch.summary = "已按指令刷新目标平台内容。"
            return patch

        if parsed.intent == "refine_draft":
            if self.llm.status().configured:
                patch_data = await self.pipeline.refine_draft(
                    project, style_profile, message, on_delta=on_delta
                )
                return ContentPatch(
                    intent="refine_draft",
                    target_platforms=[],
                    summary="已更新初稿。满意后可生成各平台内容。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            return build_mock_refine_draft(project, message)

        if self.llm.status().configured:
            patch_data = await self.pipeline.refine_draft(
                project, style_profile, message, on_delta=on_delta
            )
            return ContentPatch(
                intent="refine_draft",
                target_platforms=[],
                summary="已更新初稿。",
                patch=patch_data,
                changes=self._changes_from_patch(patch_data),
            )

        fallback = build_mock_refine_draft(project, message)
        fallback.summary = (
            "已更新初稿模板。"
            "配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后可启用 AI 对话润色。"
        )
        return fallback

    def _platform_dict_from_patch(
        self,
        project: ContentProject,
        patch_data: dict[str, Any],
    ) -> dict[str, Any]:
        platforms: dict[str, Any] = {}
        for key, value in patch_data.items():
            if key.startswith("platforms."):
                platforms[key.replace("platforms.", "", 1)] = value
        for key, content in project.platforms.items():
            if key in platforms:
                continue
            data = content.model_dump(mode="json")
            if data.get("body") or data.get("title") or data.get("script"):
                platforms[key] = data
        return platforms

    async def _ensure_cover_assets(
        self,
        project: ContentProject,
        patch_data: dict[str, Any],
        style_profile: AuthorStyleProfile,
    ) -> dict[str, Any]:
        platforms = self._platform_dict_from_patch(project, patch_data)
        if not platforms:
            return patch_data
        result = await self._attach_cover_images(
            {
                **patch_data,
                "cover_assets": await self.pipeline._generate_cover_prompts(
                    project,
                    style_profile,
                    platforms,
                ),
            }
        )
        return self._finalize_wechat_in_patch(result)

    def _finalize_wechat_in_patch(
        self,
        patch_data: dict[str, Any],
        existing_assets: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if "platforms.wechat" not in patch_data or not isinstance(patch_data["platforms.wechat"], dict):
            return patch_data
        assets = patch_data.get("cover_assets") or existing_assets or []
        patch_data["platforms.wechat"] = finalize_wechat_content(
            patch_data["platforms.wechat"],
            assets,
        )
        return patch_data

    async def _attach_cover_images(self, patch_data: dict[str, Any]) -> dict[str, Any]:
        assets = patch_data.get("cover_assets") or []
        if not assets:
            return patch_data

        updated_assets = []
        image_url = ""
        for asset in assets:
            if asset.get("image_url") and asset.get("source") == "upload":
                updated_assets.append(asset)
                image_url = asset.get("image_url") or image_url
                continue
            if asset.get("image_url"):
                updated_assets.append(asset)
                image_url = asset.get("image_url") or image_url
                continue
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

    def _merge_uploaded_attachments(
        self,
        patch_data: dict[str, Any],
        attachment_urls: list[str],
    ) -> dict[str, Any]:
        if not attachment_urls:
            return patch_data

        assets = list(patch_data.get("cover_assets") or [])
        existing_urls = {a.get("image_url") for a in assets if isinstance(a, dict)}
        next_index = next_asset_index(assets)

        for url in attachment_urls:
            if url in existing_urls:
                continue
            assets.append(
                {
                    "platform": "wechat",
                    "headline": f"用户素材{next_index + 1}",
                    "subheadline": "用户上传",
                    "prompt": "用户上传素材",
                    "image_url": url,
                    "caption": "用户素材",
                    "asset_index": next_index,
                    "source": "upload",
                }
            )
            next_index += 1

        patch_data["cover_assets"] = assets
        return patch_data

    def _changes_from_patch(self, patch_data: dict[str, Any]) -> list[ChangeRecord]:
        return [
            ChangeRecord(path=key, action="replace", after_preview=str(value)[:120])
            for key, value in patch_data.items()
        ]

    async def _maybe_refresh_chat_summary(self, project: ContentProject) -> None:
        if not should_refresh_summary(project):
            return
        older = messages_to_summarize(project)
        if not older:
            return
        project.chat_summary = await summarize_chat(self.llm, older)
        project.chat_summary_through = len(project.chat_history) - RECENT_MESSAGE_LIMIT

    def _build_warnings(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
    ) -> list[RiskWarningItem]:
        raw = scan_project(project, style_profile.banned_phrases)
        return [RiskWarningItem.model_validate(item) for item in raw]

    def _snapshot(self, project: ContentProject, label: str) -> None:
        data = project.model_dump(mode="json")
        # 快照中不嵌套 versions，避免每次对话指数级膨胀
        data["versions"] = []
        snapshot = ProjectVersion(
            label=label[:80],
            snapshot=data,
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
