from __future__ import annotations

import re
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
from app.services.wechat_assets import next_asset_index
from app.services.xiaohongshu_assets import generate_xiaohongshu_carousel
from app.services.wechat_html import finalize_wechat_content
from app.skill_pipelines import ALL_PLATFORMS

StreamCallback = Callable[[str], Awaitable[None]] | None


def _has_platform_content(project: ContentProject) -> bool:
    return bool(
        project.platforms["wechat"].body
        or project.platforms["xiaohongshu"].body
        or project.platforms["douyin"].script
    )


def _cover_style_hint(message: str) -> str:
    hints: list[str] = []
    if re.search(r"暖色", message):
        hints.append("暖色调")
    if re.search(r"纪实", message):
        hints.append("纪实摄影风格")
    if re.search(r"极简|大字|排版", message):
        hints.append("极简排版，大字标题")
    if re.search(r"分屏|上下", message):
        hints.append("上下分屏布局")
    if re.search(r"手帐|治愈", message):
        hints.append("手帐治愈风")
    if re.search(r"拼贴|步骤|指南", message):
        hints.append("多图拼贴或步骤指南风")
    if re.search(r"提问|互动", message):
        hints.append("提问互动式封面")
    if re.search(r"少.*AI|不要.*AI|真实", message):
        hints.append("真实自然，不要明显 AI 感")
    return "，".join(hints) if hints else "纪实风格，暖色生活场景，真实自然，不要明显 AI 感"


def _sync_xiaohongshu_images(patch_data: dict[str, Any]) -> dict[str, Any]:
    assets = patch_data.get("cover_assets") or []
    xhs_assets = [a for a in assets if isinstance(a, dict) and a.get("platform") == "xiaohongshu"]
    if not xhs_assets:
        return patch_data

    carousel = [a.get("image_url") for a in xhs_assets if a.get("image_url")]
    cover_url = carousel[0] if carousel else ""

    xhs_patch: dict[str, Any] = {}
    if "platforms.xiaohongshu" in patch_data and isinstance(patch_data["platforms.xiaohongshu"], dict):
        xhs_patch = dict(patch_data["platforms.xiaohongshu"])
    elif isinstance(patch_data.get("platforms", {}).get("xiaohongshu"), dict):
        xhs_patch = dict(patch_data["platforms"]["xiaohongshu"])

    if carousel:
        xhs_patch["carousel_images"] = carousel
    if cover_url:
        xhs_patch["cover_image"] = cover_url

    if xhs_patch:
        if "platforms.xiaohongshu" in patch_data:
            patch_data["platforms.xiaohongshu"] = {**dict(patch_data.get("platforms.xiaohongshu") or {}), **xhs_patch}
        else:
            patch_data["platforms.xiaohongshu"] = xhs_patch
            if cover_url and "platforms.xiaohongshu.cover_image" not in patch_data:
                patch_data["platforms.xiaohongshu.cover_image"] = cover_url
    return patch_data


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
        if (
            not message.strip()
            and parsed.intent == "generate_draft"
            and project.inspiration.strip()
        ):
            user_content = project.inspiration.strip()
        if attachment_urls:
            user_content += f"\n[附件: {', '.join(attachment_urls)}]"
        project.chat_history.append(
            ChatMessage(
                role="user",
                content=user_content,
                action=action or None,
                target_platforms=list(target_platforms or []),
                attachment_urls=list(attachment_urls or []),
            )
        )

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

    async def handle_cascade(
        self,
        project: ContentProject,
        target_platforms: list[str],
        style_profile: AuthorStyleProfile,
        on_delta: StreamCallback = None,
    ) -> tuple[ContentProject, ContentPatch, ChatMessage]:
        targets = [p for p in target_platforms if p in ALL_PLATFORMS] or ALL_PLATFORMS
        if not (project.humanized or project.draft):
            patch = ContentPatch(
                intent="cascade",
                target_platforms=targets,  # type: ignore[arg-type]
                summary="请先完善初稿，再同步到平台。",
                patch={},
            )
            assistant = ChatMessage(role="assistant", content=patch.summary)
            project.chat_history.append(assistant)
            return project, patch, assistant

        if self.llm.status().configured:
            patch_data = await self.pipeline.cascade_from_humanized(
                project, style_profile, list(targets), on_delta=on_delta
            )
        else:
            mock = build_mock_platforms(project, list(targets))
            patch_data = mock.patch

        self._snapshot(project, "同步平台版本")
        patch = ContentPatch(
            intent="cascade",
            target_platforms=targets,  # type: ignore[arg-type]
            summary=f"已根据当前初稿同步到：{'、'.join(targets)}。",
            patch=patch_data,
            changes=self._changes_from_patch(patch_data),
        )
        updated = apply_patch(project, patch)
        updated.updated_at = datetime.utcnow()
        updated.risk_warnings = self._build_warnings(updated, style_profile)
        assistant = ChatMessage(role="assistant", content=patch.summary)
        updated.chat_history.append(assistant)
        return updated, patch, assistant

    async def regenerate_assistant(
        self,
        project: ContentProject,
        assistant_message_id: str,
        selected_platform: str,
        style_profile: AuthorStyleProfile,
        on_delta: StreamCallback = None,
    ) -> tuple[ContentProject, ContentPatch, ChatMessage]:
        idx = next(
            (i for i, item in enumerate(project.chat_history) if item.id == assistant_message_id),
            -1,
        )
        if idx < 0 or project.chat_history[idx].role != "assistant":
            raise ValueError("找不到可重新生成的助手消息")
        if idx == 0 or project.chat_history[idx - 1].role != "user":
            raise ValueError("无法重新生成此消息")

        user_msg = project.chat_history[idx - 1]
        turn_index = sum(1 for item in project.chat_history[:idx] if item.role == "assistant")
        if turn_index >= len(project.versions):
            raise ValueError("该消息缺少版本快照，请重新发送指令或使用「撤销上一版」")

        restored = ContentProject.model_validate(deepcopy(project.versions[turn_index].snapshot))
        restored.id = project.id
        restored.versions = list(project.versions[:turn_index])

        message = user_msg.content
        if "\n[附件:" in message:
            message = message.split("\n[附件:")[0].strip()

        attachment_urls = list(user_msg.attachment_urls or [])
        action = user_msg.action or None
        target_platforms = list(user_msg.target_platforms or []) or None

        parsed = self._resolve_intent(
            message,
            selected_platform,
            action,
            target_platforms,
            restored,
            attachment_urls=attachment_urls or None,
        )

        if on_delta:
            await on_delta("正在重新生成回复…")

        patch = await self._execute(
            restored,
            message,
            parsed,
            style_profile,
            on_delta,
            attachment_urls=attachment_urls or None,
        )
        self._snapshot(restored, patch.summary)
        updated = apply_patch(restored, patch)
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
            "generate_xhs_carousel": "一键生成全部轮播图",
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
                if not project.cover_assets or "xiaohongshu" in targets or "wechat" in targets:
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
                if ("xiaohongshu" in targets or "wechat" in targets) and patch_data.get("cover_assets"):
                    if targets == ["xiaohongshu"]:
                        summary += " 已同步生成小红书轮播配图占位。"
                    elif targets == ["wechat"]:
                        summary += " 已同步生成公众号封面与配图占位。"
                    else:
                        summary += " 已同步生成封面与配图占位。"
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

        if parsed.intent == "cover_assets" or parsed.intent == "regenerate_cover":
            style_hint = _cover_style_hint(message)
            if self.llm.status().configured:
                platforms = {
                    k: v.model_dump(mode="json") for k, v in project.platforms.items()
                }
                assets = await self.pipeline._generate_cover_prompts(project, style_profile, platforms)
                for asset in assets:
                    base = asset.get("prompt") or ""
                    asset["prompt"] = f"{style_hint}。{base}" if base else style_hint
                    asset["source"] = "placeholder"
                    asset.pop("image_url", None)
                patch_data = {"cover_assets": assets}
                patch_data = self._assign_placeholder_images(patch_data)
                wechat = project.platforms.get("wechat")
                if wechat and wechat.body:
                    patch_data["platforms.wechat"] = finalize_wechat_content(
                        wechat.model_dump(mode="json"),
                        patch_data.get("cover_assets") or [],
                    )
                summary = (
                    "已按你的风格要求更新封面与配图方案（默认占位）。"
                    "确认正文后可在配图区逐张上传或 AI 生成。"
                    if parsed.intent == "regenerate_cover"
                    else "已生成封面文案与配图提示词（默认占位）。确认内容后请逐张上传或 AI 生成。"
                )
                return ContentPatch(
                    intent="cover_assets",
                    target_platforms=["all"],
                    summary=summary,
                    patch=patch_data,
                )
            patch = build_mock_cover_assets(project)
            patch_data = self._assign_placeholder_images(patch.patch)
            patch.patch = patch_data
            return patch

        if parsed.intent == "generate_xhs_carousel":
            xhs = project.platforms.get("xiaohongshu")
            if not xhs or not (xhs.body or "").strip():
                return ContentPatch(
                    intent="generate_xhs_carousel",
                    target_platforms=["xiaohongshu"],
                    summary="请先生成小红书内容，再批量生成轮播图。",
                    patch={},
                )
            if on_delta:
                await on_delta("正在批量生成小红书轮播图…")
            try:
                updated, generated = await generate_xiaohongshu_carousel(
                    project,
                    self.images,
                    self.pipeline,
                )
            except ValueError as exc:
                return ContentPatch(
                    intent="generate_xhs_carousel",
                    target_platforms=["xiaohongshu"],
                    summary=str(exc),
                    patch={},
                )
            patch_data = {
                "cover_assets": [a.model_dump(mode="json") for a in updated.cover_assets],
                "platforms.xiaohongshu": updated.platforms["xiaohongshu"].model_dump(mode="json"),
            }
            return ContentPatch(
                intent="generate_xhs_carousel",
                target_platforms=["xiaohongshu"],
                summary=f"已批量生成 {generated} 张小红书轮播图，可在预览区查看。",
                patch=patch_data,
                changes=self._changes_from_patch(patch_data),
            )

        if parsed.intent == "layout_preset":
            wechat = project.platforms.get("wechat")
            if not wechat or not (wechat.body or "").strip():
                return ContentPatch(
                    intent="layout_preset",
                    target_platforms=["wechat"],
                    summary="请先生成公众号内容，再切换排版预设。",
                    patch={},
                )
            preset = parsed.layout_preset or "classic"
            wechat_data = wechat.model_dump(mode="json")
            style_theme = dict(wechat_data.get("style_theme") or {})
            style_theme["layout_preset"] = preset
            wechat_data["style_theme"] = style_theme
            assets = [a.model_dump(mode="json") for a in project.cover_assets]
            finalized = finalize_wechat_content(wechat_data, assets)
            preset_labels = {
                "classic": "经典",
                "lively": "活泼",
                "story": "故事",
                "checklist": "清单",
            }
            label = preset_labels.get(preset, preset)
            patch = {"platforms.wechat": finalized}
            return ContentPatch(
                intent="layout_preset",
                target_platforms=["wechat"],
                summary=f"已切换为{label}排版，正文未改动。",
                patch=patch,
                changes=self._changes_from_patch(patch),
            )

        if parsed.intent == "patch_field":
            targets = [p for p in parsed.target_platforms if p in ALL_PLATFORMS]
            platform = targets[0] if targets else "wechat"
            fields = parsed.patch_fields or ["body"]
            if self.llm.status().configured:
                patch_data = await self.pipeline.patch_platform_field(
                    project,
                    style_profile,
                    message,
                    str(platform),
                    fields,
                    on_delta=on_delta,
                )
                field_label = "、".join(fields)
                return ContentPatch(
                    intent="patch_field",
                    target_platforms=[platform],  # type: ignore[list-item]
                    summary=f"已精准修改{platform}的{field_label}。",
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                )
            patch = build_mock_platforms(project, [str(platform)])
            patch.summary = f"已更新{platform}内容模板。"
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
            hints = ["cascade_available"] if _has_platform_content(project) else []
            if self.llm.status().configured:
                patch_data = await self.pipeline.refine_draft(
                    project, style_profile, message, on_delta=on_delta
                )
                summary = (
                    "已更新初稿。请选择是否同步到已有平台版本。"
                    if hints
                    else "已更新初稿。满意后可生成各平台内容。"
                )
                return ContentPatch(
                    intent="refine_draft",
                    target_platforms=[],
                    summary=summary,
                    patch=patch_data,
                    changes=self._changes_from_patch(patch_data),
                    preview_hints=hints,
                )
            return build_mock_refine_draft(project, message)

        if self.llm.status().configured:
            patch_data = await self.pipeline.refine_draft(
                project, style_profile, message, on_delta=on_delta
            )
            hints = ["cascade_available"] if _has_platform_content(project) else []
            return ContentPatch(
                intent="refine_draft",
                target_platforms=[],
                summary="已更新初稿。",
                patch=patch_data,
                changes=self._changes_from_patch(patch_data),
                preview_hints=hints,
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

        regenerated = {key for key in platforms if key in {"wechat", "xiaohongshu"}}
        new_assets = await self.pipeline._generate_cover_prompts(
            project,
            style_profile,
            platforms,
        )
        existing = [a.model_dump(mode="json") for a in project.cover_assets]
        if patch_data.get("cover_assets"):
            existing = list(patch_data["cover_assets"])

        merged: list[dict[str, Any]] = []
        for asset in existing:
            platform = asset.get("platform")
            if platform == "xiaohongshu" and "xiaohongshu" in regenerated:
                continue
            if platform in {"wechat", "all"} and "wechat" in regenerated:
                continue
            merged.append(asset)
        merged.extend(new_assets)

        result = self._assign_placeholder_images({**patch_data, "cover_assets": merged})
        return self._finalize_wechat_in_patch(result)

    def _assign_placeholder_images(self, patch_data: dict[str, Any]) -> dict[str, Any]:
        assets = patch_data.get("cover_assets") or []
        if not assets:
            return patch_data

        updated_assets: list[dict[str, Any]] = []
        for index, asset in enumerate(assets):
            if asset.get("image_url") and asset.get("source") not in ("placeholder", None):
                updated_assets.append(asset)
                continue

            after_paragraph = asset.get("after_paragraph", -1)
            is_cover = after_paragraph is None or after_paragraph < 0
            is_xhs = asset.get("platform") == "xiaohongshu"
            aspect = "xhs" if is_xhs or not is_cover else "wechat"
            caption = asset.get("caption") or asset.get("subheadline") or "待配图"
            placeholder_url = self.images.slot_placeholder(aspect, caption=str(caption)[:24])
            updated = {
                **asset,
                "image_url": placeholder_url,
                "source": "placeholder",
            }
            updated_assets.append(updated)

        patch_data["cover_assets"] = updated_assets
        patch_data = _sync_xiaohongshu_images(patch_data)
        return patch_data

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

    async def _attach_cover_images(
        self,
        patch_data: dict[str, Any],
        *,
        only_uploaded: bool = False,
    ) -> dict[str, Any]:
        assets = patch_data.get("cover_assets") or []
        if not assets:
            return patch_data

        updated_assets = []
        image_url = ""
        for index, asset in enumerate(assets):
            if asset.get("image_url") and asset.get("source") == "upload":
                updated_assets.append(asset)
                image_url = asset.get("image_url") or image_url
                continue
            if only_uploaded:
                updated_assets.append(asset)
                if asset.get("image_url") and asset.get("source") != "placeholder":
                    image_url = asset.get("image_url") or image_url
                continue
            if asset.get("image_url") and asset.get("source") != "placeholder":
                updated_assets.append(asset)
                image_url = asset.get("image_url") or image_url
                continue
            prompt = asset.get("prompt", "纪实风格封面")
            after_paragraph = asset.get("after_paragraph", -1)
            is_cover = after_paragraph is None or after_paragraph < 0
            is_xhs = asset.get("platform") == "xiaohongshu"
            aspect = "xhs" if is_xhs or not is_cover else "wechat"
            image_url = await self.images.generate(prompt, aspect=aspect)
            asset = {**asset, "image_url": image_url, "source": "generated"}
            updated_assets.append(asset)

        patch_data["cover_assets"] = updated_assets
        patch_data = _sync_xiaohongshu_images(patch_data)
        if image_url and not patch_data.get("platforms.xiaohongshu", {}).get("cover_image"):
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
