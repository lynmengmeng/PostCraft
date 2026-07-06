from __future__ import annotations

import json
import re
from typing import Any, Callable, Awaitable

from app.skill_pipelines import ALL_PLATFORMS, PLATFORM_CONVERTERS
from app.models.schemas import (
    AuthorStyleProfile,
    ContentProject,
    CoverAsset,
    TitleCandidate,
    WechatContent,
    WechatImagePlacement,
    XiaohongshuImagePage,
)
from app.services.chat_context import build_chat_context_block
from app.services.llm_client import LLMClient
from app.services.repository import parse_json_from_text
from app.services.skill_loader import SkillLoader
from app.services.wechat_html import build_formatted_html, finalize_wechat_content
from app.services.wechat_assets import (
    build_materials_context_block,
    sync_image_placements,
)
from app.services.xiaohongshu_styles import (
    content_page_prompt,
    pick_style_for_content,
    styles_reference_block,
)

StreamCallback = Callable[[str], Awaitable[None]] | None


class ContentPipeline:
    """PRD §13.3: general-writing → humanizer-cn → platform converters."""

    def __init__(self, llm: LLMClient, skills: SkillLoader):
        self.llm = llm
        self.skills = skills

    async def generate_draft(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str = "",
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        if on_delta:
            await on_delta("正在撰写观察型初稿…")

        draft = await self._run_markdown_skill(
            "general-writing",
            project,
            style_profile,
            message or "基于灵感撰写只解决一个具体问题的观察型文章初稿，开头直接从痛点切入，不要背景综述",
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

        return {"draft": draft, "humanized": humanized}

    async def generate_platforms(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        target_platforms: list[str],
        on_delta: StreamCallback = None,
        with_titles: bool = False,
    ) -> dict[str, Any]:
        humanized = (project.humanized or project.draft or "").strip()
        if not humanized:
            raise ValueError("请先生成并确认初稿，再生成平台内容")

        targets = [p for p in target_platforms if p in PLATFORM_CONVERTERS]
        if not targets:
            targets = list(ALL_PLATFORMS)

        patch: dict[str, Any] = {}
        for platform in targets:
            if on_delta:
                await on_delta(f"正在生成{platform}版本…")
            patch[f"platforms.{platform}"] = await self._run_converter(
                PLATFORM_CONVERTERS[platform],
                project,
                style_profile,
                humanized,
            )

        if with_titles or set(targets) == set(ALL_PLATFORMS) or not project.titles:
            if on_delta:
                await on_delta("正在生成标题备选…")
            patch["titles"] = await self._generate_titles(project, style_profile, humanized, count=12)

        return patch

    async def generate_all(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str = "",
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        draft_patch = await self.generate_draft(project, style_profile, message, on_delta)
        platform_patch = await self.generate_platforms(
            project.model_copy(update={"draft": draft_patch["draft"], "humanized": draft_patch["humanized"]}),
            style_profile,
            ALL_PLATFORMS,
            on_delta,
            with_titles=True,
        )
        cover_assets = await self._generate_cover_prompts(
            project,
            style_profile,
            {k.replace("platforms.", ""): v for k, v in platform_patch.items() if k.startswith("platforms.")},
        )
        return {
            **draft_patch,
            **platform_patch,
            "cover_assets": cover_assets,
        }

    async def refine_draft(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str,
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        if on_delta:
            await on_delta("正在理解修改意图…")

        humanized = project.humanized or project.draft or project.inspiration
        skill = self.skills.load("postcraft-orchestrator")
        incorporate_hint = ""
        if len(message.strip()) >= 80:
            incorporate_hint = (
                "若用户消息是个人经历、素材片段或补充内容，请将其自然融入初稿并重写相关段落；"
                "不要只做错别字或语法校对。\n"
            )
        system = (
            f"{skill}\n\n"
            "根据用户指令修改观察型初稿 Markdown，只改初稿，不涉及各平台格式。\n"
            f"{incorporate_hint}"
            '只输出一个 JSON 对象，不要输出其它说明文字：{"humanized":"完整修改后的 Markdown"}'
        )
        user = (
            build_chat_context_block(project)
            + self._style_block(style_profile, ALL_PLATFORMS)
            + f"\n\n选题: {project.inspiration[:500]}\n"
            f"元信息: {json.dumps(project.topic_meta.model_dump(mode='json'), ensure_ascii=False)}\n\n"
            f"当前初稿:\n{humanized}\n\n用户指令: {message}"
        )
        raw = await self.llm.complete(system, user, json_mode=True)
        payload = parse_json_from_text(raw, fallback_key="humanized")
        updated = payload.get("humanized", humanized)
        return {"humanized": updated, "draft": updated}

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
            '只输出一个 JSON 对象：{"humanized":"完整修改后的 Markdown"}'
        )
        targets = list(target_platforms) if target_platforms else ALL_PLATFORMS
        if "all" in targets:
            targets = ALL_PLATFORMS

        user = (
            build_chat_context_block(project)
            + self._style_block(style_profile, targets)
            + f"\n\n选题: {project.inspiration[:500]}\n"
            f"元信息: {json.dumps(project.topic_meta.model_dump(mode='json'), ensure_ascii=False)}\n\n"
            f"当前 humanized:\n{humanized}\n\n用户指令: {message}"
        )
        raw = await self.llm.complete(system, user, json_mode=True)
        payload = parse_json_from_text(raw, fallback_key="humanized")
        updated_humanized = payload.get("humanized", humanized)

        patch: dict[str, Any] = {"humanized": updated_humanized, "draft": updated_humanized}

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

    async def cascade_from_humanized(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        target_platforms: list[str],
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        humanized = project.humanized or project.draft or project.inspiration
        if not humanized.strip():
            return {}

        patch: dict[str, Any] = {}
        for platform in target_platforms:
            if platform not in PLATFORM_CONVERTERS:
                continue
            if on_delta:
                await on_delta(f"正在同步{platform}版本…")
            payload = await self._run_converter(
                PLATFORM_CONVERTERS[platform],
                project,
                style_profile,
                humanized,
            )
            if platform == "wechat" and project.cover_assets:
                payload = finalize_wechat_content(
                    payload,
                    [a.model_dump(mode="json") for a in project.cover_assets],
                )
            patch[f"platforms.{platform}"] = payload
        return patch

    async def patch_platform_field(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str,
        platform: str,
        fields: list[str],
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        if on_delta:
            await on_delta(f"正在精准修改{platform}…")

        humanized = project.humanized or project.draft or project.inspiration
        if platform == "wechat":
            current = project.platforms["wechat"].model_dump(mode="json")
            field_list = fields or ["body"]
            schema_parts = []
            if "title" in field_list:
                schema_parts.append('"title":""')
            if "body" in field_list:
                schema_parts.append('"body":""')
            schema = "{" + ",".join(schema_parts) + "}"
            system = (
                "你是公众号编辑。根据用户指令，仅修改指定字段，其他内容保持不变。\n"
                f"输出 JSON：{schema}\n"
                "body 若修改则输出完整 Markdown 正文；title 若修改则只输出新标题。"
            )
            user = (
                self._style_block(style_profile, ["wechat"])
                + f"\n\n中间体参考:\n{humanized[:1500]}\n\n"
                f"当前标题: {current.get('title', '')}\n"
                f"当前正文:\n{current.get('body', '')}\n\n"
                f"用户指令: {message}"
            )
            raw = await self.llm.complete(system, user, json_mode=True)
            payload = parse_json_from_text(raw, fallback_key=field_list[0] if len(field_list) == 1 else None)
            merged = {**current, **{k: v for k, v in payload.items() if k in field_list and v}}
            merged = self._normalize_wechat_payload(merged)
            if project.cover_assets:
                merged = finalize_wechat_content(
                    merged,
                    [a.model_dump(mode="json") for a in project.cover_assets],
                )
            return {"platforms.wechat": merged}

        if platform == "xiaohongshu":
            current = project.platforms["xiaohongshu"].model_dump(mode="json")
            field_list = fields or ["body"]
            schema_parts = []
            if "title" in field_list:
                schema_parts.append('"title":""')
            if "body" in field_list:
                schema_parts.append('"body":""')
            if "tags" in field_list:
                schema_parts.append('"tags":[]')
            schema = "{" + ",".join(schema_parts) + "}"
            system = (
                "你是小红书编辑。根据用户指令，仅修改指定字段。\n"
                f"输出 JSON：{schema}\n"
                "body 保持短段落、每段 1-2 行、适度 emoji。"
            )
            user = (
                self._style_block(style_profile, ["xiaohongshu"])
                + f"\n\n中间体参考:\n{humanized[:1500]}\n\n"
                f"当前: {json.dumps({k: current.get(k) for k in field_list}, ensure_ascii=False)}\n\n"
                f"用户指令: {message}"
            )
            raw = await self.llm.complete(system, user, json_mode=True)
            payload = parse_json_from_text(raw, fallback_key=field_list[0] if len(field_list) == 1 else None)
            merged = {**current, **{k: v for k, v in payload.items() if k in field_list and v is not None}}
            return {"platforms.xiaohongshu": merged}

        if platform == "douyin":
            current = project.platforms["douyin"].model_dump(mode="json")
            field_list = fields or ["hook"]
            if "body" in field_list or "script" in field_list:
                field_list = ["hook", "script", "duration"]
            schema = '{"hook":"","duration":"90s","script":[{"index":1,"duration":"3s","narration":"","visual":"","subtitle":""}]}'
            system = (
                "你是抖音脚本编辑。根据用户指令修改口播脚本指定部分。\n"
                f"输出 JSON：{schema}"
            )
            user = (
                self._style_block(style_profile, ["douyin"])
                + f"\n\n中间体参考:\n{humanized[:1500]}\n\n"
                f"当前脚本:\n{json.dumps(current, ensure_ascii=False)}\n\n"
                f"用户指令: {message}"
            )
            raw = await self.llm.complete(system, user, json_mode=True)
            payload = parse_json_from_text(raw)
            merged = {**current}
            for key in ("hook", "duration", "script"):
                if key in payload and payload[key]:
                    merged[key] = payload[key]
            return {"platforms.douyin": merged}

        return {}

    async def layout_wechat_images(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        message: str,
        attachment_urls: list[str] | None = None,
        on_delta: StreamCallback = None,
    ) -> dict[str, Any]:
        if on_delta:
            await on_delta("正在调整公众号配图布局…")

        wechat = project.platforms.get("wechat")
        if not wechat or not isinstance(wechat, WechatContent):
            raise ValueError("请先生成公众号内容")

        assets_data = [a.model_dump(mode="json") for a in project.cover_assets]
        system = (
            "你是公众号排版编辑。根据用户指令调整正文中的配图位置与图注。\n"
            "规则：\n"
            "- 保留已有 ![图注](__IMAGE_N__) 占位符，N 与素材 asset_index 一致\n"
            "- 用户上传的素材（source=upload）必须保留，只调整位置和图注\n"
            "- 可新增占位符引用附件 URL 对应的 __IMAGE_N__\n"
            "- 输出 JSON："
            '{"body":"完整 Markdown 正文","image_placements":[{"after_paragraph":1,"asset_index":0,"caption":"","prompt":""}]}'
        )
        user = (
            build_materials_context_block(attachment_urls or [], assets_data)
            + build_chat_context_block(project)
            + self._style_block(style_profile, ["wechat"])
            + f"\n\n当前标题: {wechat.title}\n当前摘要: {wechat.summary}\n\n"
            f"当前正文:\n{wechat.body}\n\n"
            f"已有素材:\n{json.dumps(assets_data, ensure_ascii=False)}\n\n"
            f"用户指令: {message or '请优化配图在正文中的位置与图注'}"
        )
        raw = await self.llm.complete(system, user, json_mode=True)
        payload = parse_json_from_text(raw, fallback_key="body")
        wechat_data = wechat.model_dump(mode="json")
        wechat_data["body"] = payload.get("body", wechat.body)
        if payload.get("image_placements"):
            wechat_data["image_placements"] = payload["image_placements"]
        else:
            wechat_data["image_placements"] = sync_image_placements(
                wechat_data["body"],
                assets_data,
            )
        return {"platforms.wechat": self._normalize_wechat_payload(wechat_data)}

    async def _run_markdown_skill(
        self,
        skill_name: str,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        task: str,
        input_text: str,
    ) -> str:
        skill = self.skills.load(skill_name)
        extra = ""
        if skill_name == "general-writing":
            extra = (
                "\n\n【单问题写作 — 必须遵守】\n"
                "- 全文只回答灵感中的 1 个核心问题\n"
                "- 开头直接从痛点切入，禁止「随着……越来越……」类背景铺垫\n"
                "- 结构：核心问题 + 3-5 个小节 + 「你可以先做这一步」\n"
            )
        system = (
            f"{skill}{extra}\n\n"
            f"{self._style_block(style_profile, ALL_PLATFORMS)}\n\n"
            "只输出 Markdown 正文，不要 JSON，不要解释。\n"
            "排版要求：用 ## 分节；段落间空一行；并列内容用有序/无序列表；避免整篇长段落。"
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
            schema_hint = (
                '{"title":"","body":"","tags":[],"cover_style":"",'
                '"image_pages":[{"page":1,"role":"cover","headline":"","subheadline":"",'
                '"body_text":"","prompt":""}]}'
            )
        else:
            schema_hint = (
                '{"title":"","summary":"","cover_headline":"","cover_subheadline":"","body":"",'
                '"style_theme":{"layout_preset":"classic|lively|story|checklist",'
                '"accent":"","mood":"",'
                '"heading_style":"border_left|underline|plain","quote_bg":"","quote_border":"",'
                '"text_color":"","heading_color":""},'
                '"image_placements":[{"after_paragraph":0,"asset_index":0,"caption":"","prompt":""}]}'
            )

        platform_key = skill_name.replace("-converter", "")
        system = (
            f"{skill}\n\n"
            f"{self._style_block(style_profile, [platform_key])}\n\n"
            f"输出严格 JSON，格式: {schema_hint}\n\n"
            f"{self._formatting_rules(skill_name)}"
        )
        user = f"中间体内容:\n{humanized}"
        raw = await self.llm.complete(system, user, json_mode=True)
        payload = parse_json_from_text(raw)
        if skill_name == "wechat-converter":
            payload = self._normalize_wechat_payload(payload)
        if skill_name == "xiaohongshu-converter":
            payload = self._normalize_xiaohongshu_payload(payload)
        return payload

    async def _generate_titles(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        humanized: str,
        count: int = 12,
    ) -> list[dict[str, Any]]:
        system = (
            "你是中文标题策划，专注公众号冷启动搜索型标题。输出 JSON："
            '{"titles":[{"text":"","style":"搜索问题型|人群痛点型|误区纠正型|对比选择型|结果承诺型"}]}\n'
            "要求：标题含具体场景/人群/动作词，像用户会搜索的问题；"
            "避免空泛词「提高」「全面」「指南」「必看」；不用震惊体。"
        )
        user = (
            self._style_block(style_profile, ALL_PLATFORMS)
            + f"\n请生成 {count} 个标题，避免: {style_profile.banned_phrases}\n\n"
            + humanized[:2000]
        )
        raw = await self.llm.complete(system, user, json_mode=True)
        payload = parse_json_from_text(raw)
        titles = payload.get("titles", [])
        return [
            TitleCandidate(text=t.get("text", ""), style=t.get("style", "搜索问题型")).model_dump(mode="json")
            for t in titles
            if t.get("text")
        ]

    async def _generate_cover_prompts(
        self,
        project: ContentProject,
        style_profile: AuthorStyleProfile,
        platforms: dict[str, Any],
    ) -> list[dict[str, Any]]:
        wechat = platforms.get("wechat", {})
        wechat_title = wechat.get("title", project.title)
        placements = wechat.get("image_placements") or []
        assets: list[dict[str, Any]] = []

        if placements:
            for placement in placements:
                if isinstance(placement, dict):
                    p = WechatImagePlacement.model_validate(placement)
                else:
                    p = placement
                prompt = p.prompt or "纪实风格，暖色生活场景，真实自然，不要明显 AI 感"
                asset = CoverAsset(
                    platform="wechat",
                    headline=str(wechat_title)[:20],
                    subheadline=p.caption or "正文配图",
                    prompt=prompt,
                    after_paragraph=p.after_paragraph,
                    caption=p.caption,
                    asset_index=p.asset_index,
                    source="placeholder",
                )
                assets.append(asset.model_dump(mode="json"))
        else:
            headline, subheadline = self._cover_copy_from_wechat(wechat, str(wechat_title))
            asset = CoverAsset(
                platform="all",
                headline=headline,
                subheadline=subheadline,
                prompt="简洁纪实风格，暖色生活场景，横版构图 2.35:1，主体居中便于方形裁切，少装饰，不要明显 AI 感",
                after_paragraph=-1,
                asset_index=0,
                source="placeholder",
            )
            assets.append(asset.model_dump(mode="json"))

        xhs = platforms.get("xiaohongshu", {})
        if isinstance(xhs, dict) and xhs.get("body"):
            assets.extend(self._generate_xiaohongshu_carousel_assets(xhs, project))

        return assets

    def _normalize_wechat_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        style_theme = payload.get("style_theme") or {}
        if not isinstance(style_theme, dict):
            style_theme = {}
        if style_theme.get("layout_preset") not in {"classic", "lively", "story", "checklist"}:
            style_theme["layout_preset"] = "classic"
        placements_raw = payload.get("image_placements") or []
        placements: list[dict[str, Any]] = []
        for index, item in enumerate(placements_raw[:4]):
            if isinstance(item, dict):
                item.setdefault("asset_index", index)
                placements.append(item)

        body = payload.get("body", "")
        if placements and "__IMAGE_" not in body:
            body = self._inject_image_placeholders(body, placements)
            payload["body"] = body

        payload["style_theme"] = style_theme
        payload["image_placements"] = placements
        payload["cover_headline"] = str(payload.get("cover_headline") or "")[:14]
        payload["cover_subheadline"] = str(payload.get("cover_subheadline") or "")[:18]
        payload.pop("formatted_html", None)
        payload["formatted_html"] = build_formatted_html(payload, [], force_rerender=True)
        return payload

    def _normalize_xiaohongshu_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        title = str(payload.get("title") or "").strip()
        body = str(payload.get("body") or "").strip()
        tags = payload.get("tags") or []
        if not isinstance(tags, list):
            tags = []
        tags = [str(t).lstrip("#").strip() for t in tags if str(t).strip()][:10]

        style = pick_style_for_content(title, body, str(payload.get("cover_style") or ""))
        cover_style = str(payload.get("cover_style") or "").strip() or style.id

        pages_raw = payload.get("image_pages") or []
        pages: list[dict[str, Any]] = []
        for index, item in enumerate(pages_raw[:9]):
            if not isinstance(item, dict):
                continue
            page = XiaohongshuImagePage.model_validate(
                {
                    **item,
                    "page": int(item.get("page") or index + 1),
                }
            )
            pages.append(page.model_dump(mode="json"))

        if len(pages) < 3:
            pages = self._build_xiaohongshu_pages_from_body(title, body, style)

        for index, page in enumerate(pages):
            if not page.get("prompt"):
                role = page.get("role", "content")
                if role == "cover" or index == 0:
                    page["prompt"] = style.image_prompt(
                        headline=str(page.get("headline") or title)[:16],
                        subheadline=str(page.get("subheadline") or "")[:24],
                    )
                else:
                    page["prompt"] = content_page_prompt(
                        headline=str(page.get("headline") or f"第{index + 1}页"),
                        body_text=str(page.get("body_text") or ""),
                        page_index=index + 1,
                        style=style,
                    )

        payload["title"] = title
        payload["body"] = body
        payload["tags"] = tags
        payload["cover_style"] = cover_style
        payload["image_pages"] = pages
        return payload

    def _build_xiaohongshu_pages_from_body(
        self,
        title: str,
        body: str,
        style,
    ) -> list[dict[str, Any]]:
        sections = [s.strip() for s in re.split(r"\n{2,}", body) if s.strip()]
        pages: list[dict[str, Any]] = [
            {
                "page": 1,
                "role": "cover",
                "headline": title[:20],
                "subheadline": sections[0][:30] if sections else "",
                "body_text": "",
                "prompt": style.image_prompt(headline=title[:16], subheadline=sections[0][:24] if sections else ""),
            }
        ]
        content_sections = sections[1:] if len(sections) > 1 else sections
        for index, section in enumerate(content_sections[:5], start=2):
            headline = section.split("\n", 1)[0].strip("·-—【】 ")[:20] or f"要点{index - 1}"
            pages.append(
                {
                    "page": index,
                    "role": "content",
                    "headline": headline,
                    "subheadline": "",
                    "body_text": section[:120],
                    "prompt": content_page_prompt(
                        headline=headline,
                        body_text=section,
                        page_index=index,
                        style=style,
                    ),
                }
            )
        pages.append(
            {
                "page": len(pages) + 1,
                "role": "summary",
                "headline": "收藏备用",
                "subheadline": "有问题评论区见",
                "body_text": "互动引导页",
                "prompt": content_page_prompt(
                    headline="收藏备用",
                    body_text="有问题评论区见",
                    page_index=len(pages) + 1,
                    style=style,
                ),
            }
        )
        return pages[:7]

    def _generate_xiaohongshu_carousel_assets(
        self,
        xhs: dict[str, Any],
        project: ContentProject,
    ) -> list[dict[str, Any]]:
        pages = xhs.get("image_pages") or []
        if not pages:
            style = pick_style_for_content(
                str(xhs.get("title") or ""),
                str(xhs.get("body") or ""),
                str(xhs.get("cover_style") or ""),
            )
            pages = self._build_xiaohongshu_pages_from_body(
                str(xhs.get("title") or ""),
                str(xhs.get("body") or ""),
                style,
            )

        assets: list[dict[str, Any]] = []
        base_index = 100
        for offset, page in enumerate(pages[:7]):
            if not isinstance(page, dict):
                continue
            role = str(page.get("role") or "content")
            headline = str(page.get("headline") or "")[:20]
            subheadline = str(page.get("subheadline") or "")[:24]
            prompt = str(page.get("prompt") or "小红书笔记配图，3:4竖版，简洁清爽")
            asset = CoverAsset(
                platform="xiaohongshu",
                headline=headline or str(xhs.get("title") or "")[:20],
                subheadline=subheadline,
                prompt=prompt,
                after_paragraph=offset,
                caption=headline or f"小红书第{offset + 1}张",
                asset_index=base_index + offset,
                source="placeholder",
            )
            assets.append(asset.model_dump(mode="json"))
        return assets

    def _coldstart_rules_block(self) -> str:
        coldstart = self.skills.load("wechat-coldstart")
        return f"\n\n【公众号冷启动规则 — 必须遵守】\n{coldstart}\n"

    def _cover_copy_from_wechat(self, wechat: dict[str, Any], fallback_title: str) -> tuple[str, str]:
        headline = str(wechat.get("cover_headline") or "").strip()
        subheadline = str(wechat.get("cover_subheadline") or "").strip()
        if headline and subheadline:
            return headline[:14], subheadline[:18]

        title = str(wechat.get("title") or fallback_title or "").strip()
        if not title:
            return "这篇和你有关", "一篇讲清怎么做"

        normalized = title.replace("?", "？")
        if "？" in normalized:
            question, _, rest = normalized.partition("？")
            headline = f"{question.strip()}？"
            subheadline = rest.strip() or "一篇讲清怎么做"
            return headline[:14], subheadline[:18]

        for sep in ("：", ":"):
            if sep in title:
                parts = title.split(sep, 1)
                return parts[0].strip()[:14], (parts[1].strip() or "一篇讲清怎么做")[:18]

        return title[:14], "一篇讲清怎么做"

    def _inject_image_placeholders(self, body: str, placements: list[dict[str, Any]]) -> str:
        paragraphs = [p for p in body.split("\n\n") if p.strip()]
        insertions: dict[int, list[str]] = {}
        for placement in sorted(placements, key=lambda p: p.get("after_paragraph", 0)):
            pos = int(placement.get("after_paragraph", 0))
            index = int(placement.get("asset_index", 0))
            caption = placement.get("caption") or f"配图{index + 1}"
            block = f"![{caption}](__IMAGE_{index}__)"
            insertions.setdefault(pos, []).append(block)

        result: list[str] = []
        for idx, block in enumerate(paragraphs):
            result.append(block)
            if (idx + 1) in insertions:
                result.extend(insertions.pop(idx + 1))

        for pos in sorted(insertions.keys()):
            if pos >= len(paragraphs):
                result.extend(insertions[pos])

        return "\n\n".join(result)

    def _formatting_rules(self, skill_name: str) -> str:
        if skill_name == "wechat-converter":
            return (
                self._coldstart_rules_block()
                + "body 排版要求（Markdown）：\n"
                "- 用 ## 作为小节标题，标题与正文之间空一行\n"
                "- 段落之间必须空一行，每段 2-4 句为宜\n"
                "- 并列要点用「1. 2. 3.」有序列表，每项单独一行\n"
                "- 引用/金句用 > 开头，引用块前后各空一行\n"
                "- h2/h3 层级清晰，避免跳级\n"
                "- 避免整篇一大段文字，保持公众号阅读节奏\n"
                "- 开头前 3 段：痛点场景 → 反常识 → 本文承诺；禁止背景综述式引言\n"
                "- 全文只解决 1 个核心问题；结尾给 1 个可执行行动\n"
                "- 在正文中用 ![图注](__IMAGE_N__) 标记配图位置（N 从 0 起）\n"
                "- 根据文章调性输出 style_theme（accent/quote_bg 等 HEX 色值）\n"
                "- style_theme.layout_preset：步骤清单/干货罗列 → checklist；"
                "生活观察/情感叙事 → lively 或 story；严肃深度长文 → classic\n"
                "- checklist 预设下可用 > 💡 提示、> ⚠️ 警示 引导读者\n"
                "- 输出 image_placements：2-3 处正文配图，含 after_paragraph、caption、prompt\n"
                "- 必须输出 cover_headline（痛点问句 ≤14 字）和 cover_subheadline（结果/方法 ≤18 字）"
            )
        if skill_name == "xiaohongshu-converter":
            return (
                styles_reference_block()
                + "\n\nbody 排版要求：\n"
                "- 短段落，每段 1-2 句（不超过 2 行），段与段之间用 \\n\\n 分隔\n"
                "- 口语化、有节奏感，适度使用 1-2 个 Emoji（不过密，每段最多 1 个）\n"
                "- 可用「·」或短句分行制造呼吸感；要点用【要点一】格式\n"
                "- 分隔用 ————— 或空行，避免装饰过载\n"
                "- 结尾留互动引导（如「你有同感吗？」「评论区聊聊」）\n"
                "- 正文 300-800 字，标签 3-6 个\n"
                "- 必须输出 cover_style（从风格库选 1 个 id）\n"
                "- 必须输出 image_pages：5-7 张图方案\n"
                "  · 第 1 张 role=cover：封面 headline+subheadline\n"
                "  · 中间 role=content：每张一个判断点/要点，headline ≤12字，body_text 为该页要点\n"
                "  · 最后 1 张 role=summary：总结+互动引导\n"
                "  · 每页 prompt 描述该张图的视觉风格（3:4竖版、排版清爽）"
            )
        if skill_name == "douyin-converter":
            return (
                "script 排版要求：\n"
                "- 每镜 narration 控制在 1-2 句口播，口语化\n"
                "- subtitle 为屏幕大字，8 字以内\n"
                "- visual 描述具体画面，便于拍摄\n"
                "- duration 字段与 script 各镜 duration 之和一致（如 90s 目标约 85-95s）\n"
                "- 输出 duration 如 \"90s\"，各镜 duration 如 \"3s\"、\"8s\""
            )
        return ""

    def _style_block(
        self,
        style_profile: AuthorStyleProfile,
        platforms: list[str] | None = None,
    ) -> str:
        snippets = "\n".join(f"- {s}" for s in style_profile.personal_snippets[:8])
        banned = "、".join(style_profile.banned_phrases) or "无"
        lines = [
            "【作者风格档案 — 必须遵守】",
            f"- 语气偏好: {style_profile.tone_preference}",
            f"- 禁用表达（全文不得出现）: {banned}",
            f"- 可复用个人素材（合适时自然融入）:\n{snippets or '  - 无'}",
        ]
        defaults = style_profile.platform_defaults or {}
        if platforms:
            for platform in platforms:
                hint = defaults.get(platform, "")
                if hint:
                    lines.append(f"- {platform} 平台风格: {hint}")
        elif defaults:
            for platform, hint in defaults.items():
                if hint:
                    lines.append(f"- {platform} 平台风格: {hint}")
        if platforms and "wechat" in platforms:
            lines.append(
                "- 公众号额外遵循: 搜索型标题、痛点开头、单问题结构、实用可转发"
            )
        lines.append("- 表达原则: 现象观察、有分寸、去 AI 味、去营销号套路")
        return "\n".join(lines)
