from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from copy import deepcopy
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from openai import APIStatusError, AuthenticationError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.database import get_db
from app.deps.auth import get_scope_kwargs, require_auth
from app.http_errors import llm_http_exception, repo_http_exception
from app.models.schemas import (
    ApplyTitleRequest,
    AuthorStyleProfile,
    CascadeRequest,
    ChatRequest,
    RegenerateChatRequest,
    ContentProject,
    Inspiration,
    InspirationCreate,
    InspirationFromLink,
    InspirationImportPayload,
    InspirationStats,
    InspirationUpdate,
    LLMStatus,
    ProjectCreate,
    ProjectDraftExport,
    ProjectDraftImportPayload,
    ProjectUpdate,
    Topic,
    TopicCreate,
    TopicMeta,
    TopicStats,
    TopicUpdate,
    TrialMetricsSummary,
    ContentCategory,
    ContentCategoryCreate,
    ContentCategoriesResponse,
    ChatMessage,
    RiskWarningItem,
    WechatContent,
    XiaohongshuContent,
    DouyinContent,
    CoverAsset,
    new_id,
)
from app.services.wechat_assets import (
    insert_placeholder_in_body,
    next_asset_index,
    sync_image_placements,
)
from app.services.wechat_html import finalize_wechat_content
from app.services.chat_orchestrator import ChatOrchestrator
from app.services.fact_check import scan_project
from app.services.image_generator import ImageGenerator
from app.services.llm_client import LLMClient
from app.services.pipeline import ContentPipeline
from app.services.skill_loader import SkillLoader
from app.services.repository import (
    category_repo,
    inspiration_repo,
    project_repo,
    style_repo,
    sync_content_pillar,
    topic_repo,
)
from app.services.xiaohongshu_assets import (
    generate_xiaohongshu_carousel,
    sync_xiaohongshu_from_assets,
)
from app.utils.image_path import resolve_image_path

public_router = APIRouter()
protected_router = APIRouter(dependencies=[Depends(require_auth)])
router = APIRouter()


def _scope() -> dict[str, str | bool | None]:
    return get_scope_kwargs()


def _save_project(db: Session, project: ContentProject) -> ContentProject:
    try:
        return project_repo.save_project(db, project, **_scope())
    except ValueError as exc:
        raise repo_http_exception(exc) from exc


def _scan_and_attach_warnings(project: ContentProject, db: Session) -> ContentProject:
    style = style_repo.get(db, **_scope())
    raw = scan_project(project, style.banned_phrases)
    project.risk_warnings = [RiskWarningItem.model_validate(item) for item in raw]
    return project


def _caption_for_asset_index(wechat: WechatContent, asset_index: int) -> str:
    for placement in wechat.image_placements or []:
        if placement.asset_index == asset_index and placement.caption:
            return placement.caption
    for match in re.finditer(rf"!\[([^\]]*)\]\(__IMAGE_{asset_index}__\)", wechat.body or ""):
        if match.group(1).strip():
            return match.group(1).strip()
    return f"配图{asset_index + 1}"


def _ensure_cover_asset_slot(
    project: ContentProject,
    asset_index: int,
    *,
    is_cover: bool = False,
) -> tuple[list[CoverAsset], int]:
    assets = list(project.cover_assets)
    slot = next((i for i, a in enumerate(assets) if a.asset_index == asset_index), None)
    if slot is not None:
        return assets, slot

    wechat = project.platforms["wechat"]
    caption = _caption_for_asset_index(wechat, asset_index)
    generator = ImageGenerator(get_settings())
    aspect = "wechat" if is_cover else "xhs"
    placeholder_url = generator.slot_placeholder(aspect, caption=caption[:24])
    assets.append(
        CoverAsset(
            platform="wechat",
            headline=caption[:20],
            subheadline=caption,
            prompt="待上传或 AI 生成",
            image_url=placeholder_url,
            caption=caption,
            asset_index=asset_index,
            source="placeholder",
        )
    )
    return assets, len(assets) - 1


@public_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@protected_router.get("/llm/status", response_model=LLMStatus)
def llm_status() -> LLMStatus:
    return LLMClient(get_settings()).status()


@protected_router.get("/projects", response_model=list[ContentProject])
def list_projects(db: Session = Depends(get_db)) -> list[ContentProject]:
    return project_repo.list_projects(db, **_scope())


@protected_router.post("/projects", response_model=ContentProject)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ContentProject:
    topic_meta = payload.topic_meta or TopicMeta()
    if payload.content_pillar:
        topic_meta.content_pillar = payload.content_pillar
    project = ContentProject(
        id=new_id(),
        title=payload.title or (payload.inspiration[:24] or "未命名项目"),
        inspiration=payload.inspiration,
        topic_meta=topic_meta,
        content_pillar=payload.content_pillar,
    )
    return _save_project(db, project)


@protected_router.get("/projects/{project_id}", response_model=ContentProject)
def get_project(project_id: str, db: Session = Depends(get_db)) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@protected_router.patch("/projects/{project_id}", response_model=ContentProject)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_unset=True)
    wechat_updated = False
    if "platforms" in data and data["platforms"]:
        incoming = data.pop("platforms")
        for key, value in incoming.items():
            if key == "wechat":
                project.platforms["wechat"] = WechatContent.model_validate(value)
                wechat_updated = True
            elif key == "xiaohongshu":
                project.platforms["xiaohongshu"] = XiaohongshuContent.model_validate(value)
            elif key == "douyin":
                project.platforms["douyin"] = DouyinContent.model_validate(value)
    for key, value in data.items():
        setattr(project, key, value)
    if "content_pillar" in data:
        sync_content_pillar(project, data["content_pillar"] or "")
    if "cover_assets" in data and data["cover_assets"] is not None:
        project.cover_assets = [CoverAsset.model_validate(item) for item in data["cover_assets"]]
    if wechat_updated:
        wechat = project.platforms.get("wechat")
        if wechat:
            wechat_data = finalize_wechat_content(
                wechat.model_dump(mode="json"),
                [a.model_dump(mode="json") for a in project.cover_assets],
            )
            project.platforms["wechat"] = WechatContent.model_validate(wechat_data)
    project.updated_at = datetime.utcnow()
    content_fields = {"platforms", "draft", "humanized", "cover_assets"}
    if content_fields.intersection(data.keys()):
        project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not project_repo.delete_project(db, project_id, **_scope()):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


def _project_has_draft_content(project: ContentProject) -> bool:
    return bool(
        project.inspiration.strip()
        or project.draft.strip()
        or project.humanized.strip()
    )


@protected_router.get("/projects/{project_id}/export-draft", response_model=ProjectDraftExport)
def export_project_draft(project_id: str, db: Session = Depends(get_db)) -> ProjectDraftExport:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _project_has_draft_content(project):
        raise HTTPException(status_code=400, detail="项目尚无灵感或初稿内容，无法导出")
    return ProjectDraftExport(
        exported_at=datetime.utcnow(),
        title=project.title,
        inspiration=project.inspiration,
        topic_meta=project.topic_meta,
        content_pillar=project.content_pillar,
        draft=project.draft,
        humanized=project.humanized,
        chat_summary=project.chat_summary,
        chat_summary_through=project.chat_summary_through,
    )


@protected_router.post("/projects/import-draft", response_model=ContentProject)
def import_project_draft(
    payload: ProjectDraftImportPayload,
    db: Session = Depends(get_db),
) -> ContentProject:
    if not payload.draft.strip() and not payload.humanized.strip():
        raise HTTPException(status_code=400, detail="导入包缺少初稿内容")
    project = ContentProject(
        id=new_id(),
        title=payload.title.strip() or payload.inspiration[:24] or "未命名项目",
        inspiration=payload.inspiration,
        topic_meta=payload.topic_meta,
        content_pillar=payload.content_pillar,
        draft=payload.draft,
        humanized=payload.humanized,
        chat_summary=payload.chat_summary,
        chat_summary_through=payload.chat_summary_through,
    )
    if project.humanized.strip():
        project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.post("/projects/{project_id}/apply-title", response_model=ContentProject)
def apply_title(
    project_id: str,
    payload: ApplyTitleRequest,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.title_index < 0 or payload.title_index >= len(project.titles):
        raise HTTPException(status_code=400, detail="Invalid title index")

    title = project.titles[payload.title_index].text
    if payload.platform == "wechat":
        project.platforms["wechat"].title = title
    elif payload.platform == "xiaohongshu":
        project.platforms["xiaohongshu"].title = title
    else:
        project.platforms["douyin"].hook = title

    for index, item in enumerate(project.titles):
        item.applied = index == payload.title_index

    project.updated_at = datetime.utcnow()
    project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.post("/projects/{project_id}/versions/{version_id}/restore", response_model=ContentProject)
def restore_version(
    project_id: str,
    version_id: str,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target = next((item for item in project.versions if item.id == version_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Version not found")

    restored = ContentProject.model_validate(deepcopy(target.snapshot))
    restored.id = project.id
    restored.versions = project.versions
    restored.chat_history = list(project.chat_history)
    restored.chat_history.append(
        ChatMessage(role="assistant", content=f"已恢复到版本：{target.label}")
    )
    restored.updated_at = datetime.utcnow()
    return _save_project(db, restored)


@protected_router.get("/projects/{project_id}/fact-check")
def fact_check(project_id: str, db: Session = Depends(get_db)) -> dict:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    style = style_repo.get(db, **_scope())
    warnings = scan_project(project, style.banned_phrases)
    project.risk_warnings = [RiskWarningItem.model_validate(item) for item in warnings]
    _save_project(db, project)
    return {"warnings": warnings}


async def _chat_once(
    project: ContentProject,
    payload: ChatRequest,
    db: Session,
    deltas: list[str] | None = None,
) -> dict:
    orchestrator = ChatOrchestrator(get_settings())
    style_profile = style_repo.get(db, **_scope())

    async def on_delta(text: str) -> None:
        if deltas is not None:
            deltas.append(text)

    categories = category_repo.list_all(db, **_scope())
    updated, patch, assistant = await orchestrator.handle_message(
        project,
        payload.message,
        payload.selected_platform,
        style_profile,
        on_delta=on_delta if payload.stream else None,
        action=payload.action or None,
        target_platforms=payload.target_platforms,
        attachment_urls=payload.attachment_urls or None,
        content_categories=categories,
    )
    saved = _save_project(db, updated)
    return {
        "project": saved.model_dump(mode="json"),
        "patch": patch.model_dump(mode="json"),
        "assistant_message": assistant.model_dump(mode="json"),
    }


async def _cascade_once(
    project: ContentProject,
    payload: CascadeRequest,
    db: Session,
    deltas: list[str] | None = None,
) -> dict:
    orchestrator = ChatOrchestrator(get_settings())
    style_profile = style_repo.get(db, **_scope())

    async def on_delta(text: str) -> None:
        if deltas is not None:
            deltas.append(text)

    updated, patch, assistant = await orchestrator.handle_cascade(
        project,
        list(payload.target_platforms),
        style_profile,
        on_delta=on_delta if payload.stream else None,
    )
    saved = _save_project(db, updated)
    return {
        "project": saved.model_dump(mode="json"),
        "patch": patch.model_dump(mode="json"),
        "assistant_message": assistant.model_dump(mode="json"),
    }


@protected_router.get("/analytics/trial-summary", response_model=TrialMetricsSummary)
def trial_summary(db: Session = Depends(get_db)) -> TrialMetricsSummary:
    projects = project_repo.list_projects(db, **_scope())
    total = len(projects)
    completed = sum(1 for p in projects if p.status in ("ready", "published"))
    chat_rounds = [sum(1 for m in p.chat_history if m.role == "user") for p in projects]
    multi_platform = 0
    for project in projects:
        count = 0
        if project.platforms["wechat"].body:
            count += 1
        if project.platforms["xiaohongshu"].body:
            count += 1
        if project.platforms["douyin"].script:
            count += 1
        if count >= 2:
            multi_platform += 1
    avg_rounds = sum(chat_rounds) / len(chat_rounds) if chat_rounds else 0.0
    return TrialMetricsSummary(
        total_projects=total,
        completed_projects=completed,
        completion_rate=round(completed / total, 4) if total else 0.0,
        avg_chat_rounds=round(avg_rounds, 2),
        multi_platform_rate=round(multi_platform / total, 4) if total else 0.0,
    )


async def _regenerate_once(
    project: ContentProject,
    payload: RegenerateChatRequest,
    db: Session,
    deltas: list[str] | None = None,
) -> dict:
    orchestrator = ChatOrchestrator(get_settings())
    style_profile = style_repo.get(db, **_scope())

    async def on_delta(text: str) -> None:
        if deltas is not None:
            deltas.append(text)

    try:
        updated, patch, assistant = await orchestrator.regenerate_assistant(
            project,
            payload.assistant_message_id,
            payload.selected_platform,
            style_profile,
            on_delta=on_delta if payload.stream else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    saved = _save_project(db, updated)
    return {
        "project": saved.model_dump(mode="json"),
        "patch": patch.model_dump(mode="json"),
        "assistant_message": assistant.model_dump(mode="json"),
    }


@public_router.get("/images/{filename}")
def get_image(filename: str):
    settings = get_settings()
    path = resolve_image_path(settings.images_dir, filename)
    media_types = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    media_type = media_types.get(path.suffix.lower())
    if media_type:
        return FileResponse(path, media_type=media_type)
    return FileResponse(path)


@protected_router.post("/projects/{project_id}/upload-cover", response_model=ContentProject)
async def upload_cover(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    content_type = file.content_type or "image/jpeg"
    try:
        image_url = ImageGenerator(get_settings()).save_upload(content, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project.platforms["xiaohongshu"].cover_image = image_url
    if project.cover_assets:
        project.cover_assets[0].image_url = image_url
    project.updated_at = datetime.utcnow()
    project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.post("/projects/{project_id}/upload-asset", response_model=ContentProject)
async def upload_asset(
    project_id: str,
    file: UploadFile = File(...),
    caption: str = Form(""),
    insert_placeholder: bool = Form(True),
    asset_index: int | None = Form(None),
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    content_type = file.content_type or "image/jpeg"
    try:
        image_url = ImageGenerator(get_settings()).save_upload(content, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    assets = list(project.cover_assets)
    wechat = project.platforms["wechat"]
    wechat_data = wechat.model_dump(mode="json")

    if asset_index is not None:
        assets, slot = _ensure_cover_asset_slot(project, asset_index)
        existing = assets[slot]
        label = caption.strip() or existing.caption or existing.subheadline or f"配图{asset_index + 1}"
        assets[slot] = CoverAsset(
            **{
                **existing.model_dump(),
                "image_url": image_url,
                "source": "upload",
                "caption": label,
                "subheadline": label,
            }
        )
    else:
        new_index = next_asset_index([a.model_dump(mode="json") for a in assets])
        label = caption.strip() or f"配图{new_index + 1}"
        asset = CoverAsset(
            platform="wechat",
            headline=label[:20],
            subheadline=label,
            prompt="用户上传素材",
            image_url=image_url,
            caption=label,
            asset_index=new_index,
            source="upload",
        )
        assets.append(asset)
        if insert_placeholder and wechat.body.strip():
            wechat_data["body"] = insert_placeholder_in_body(wechat.body, new_index, label)
        elif insert_placeholder:
            wechat_data["body"] = insert_placeholder_in_body("", new_index, label)

    wechat_data["image_placements"] = sync_image_placements(
        wechat_data.get("body", wechat.body),
        [a.model_dump(mode="json") for a in assets],
    )
    wechat_data = finalize_wechat_content(wechat_data, [a.model_dump(mode="json") for a in assets])
    project.platforms["wechat"] = WechatContent.model_validate(wechat_data)
    project.cover_assets = assets
    if asset_index is not None and asset_index == 0:
        project.platforms["xiaohongshu"].cover_image = image_url
    sync_xiaohongshu_from_assets(project)
    project.updated_at = datetime.utcnow()
    project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.post("/projects/{project_id}/assets/{asset_index}/generate", response_model=ContentProject)
async def generate_asset_image(
    project_id: str,
    asset_index: int,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    assets, slot = _ensure_cover_asset_slot(
        project,
        asset_index,
        is_cover=asset_index == 0,
    )
    existing = assets[slot]
    after_paragraph = existing.after_paragraph
    is_cover = after_paragraph is None or after_paragraph < 0 or slot == 0
    is_xhs = existing.platform == "xiaohongshu"
    aspect = "xhs" if is_xhs or not is_cover else "wechat"
    if is_xhs:
        from app.services.xiaohongshu_assets import resolve_xhs_generation_prompt

        prompt = resolve_xhs_generation_prompt(project, existing)
    else:
        prompt = existing.prompt or "纪实风格，暖色生活场景，真实自然，不要明显 AI 感"
    generator = ImageGenerator(get_settings())
    image_url = await generator.generate(prompt, aspect=aspect)
    asset_source = "placeholder" if generator.last_was_placeholder else "generated"

    assets[slot] = CoverAsset(
        **{
            **existing.model_dump(),
            "image_url": image_url,
            "prompt": prompt,
            "source": asset_source,
        }
    )

    wechat = project.platforms["wechat"]
    wechat_data = finalize_wechat_content(
        wechat.model_dump(mode="json"),
        [a.model_dump(mode="json") for a in assets],
    )
    project.platforms["wechat"] = WechatContent.model_validate(wechat_data)
    project.cover_assets = assets
    sync_xiaohongshu_from_assets(project)
    project.updated_at = datetime.utcnow()
    project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.post("/projects/{project_id}/xiaohongshu/carousel/generate", response_model=ContentProject)
async def generate_xiaohongshu_carousel_images(
    project_id: str,
    force: bool = False,
    plan_only: bool = False,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    settings = get_settings()
    pipeline = ContentPipeline(LLMClient(settings), SkillLoader(settings))
    try:
        if plan_only:
            from app.services.xiaohongshu_assets import ensure_xiaohongshu_carousel_assets

            project.cover_assets = ensure_xiaohongshu_carousel_assets(project, pipeline)
        else:
            generator = ImageGenerator(settings)
            project, _generated = await generate_xiaohongshu_carousel(
                project,
                generator,
                pipeline,
                force=force,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project.updated_at = datetime.utcnow()
    project = _scan_and_attach_warnings(project, db)
    return _save_project(db, project)


@protected_router.post("/projects/{project_id}/chat")
async def chat_with_project(
    project_id: str,
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.stream:
        try:
            return await _chat_once(project, payload, db)
        except (AuthenticationError, APIStatusError) as exc:
            raise llm_http_exception(exc) from exc

    async def event_stream() -> AsyncIterator[str]:
        deltas: list[str] = []
        yield f"event: delta\ndata: {json.dumps({'text': '开始处理…'}, ensure_ascii=False)}\n\n"

        async def run_chat() -> dict:
            return await _chat_once(project, payload, db, deltas=deltas)

        import asyncio

        from openai import APIStatusError, AuthenticationError

        task = asyncio.create_task(run_chat())
        seen = 0
        while not task.done():
            while seen < len(deltas):
                yield f"event: delta\ndata: {json.dumps({'text': deltas[seen]}, ensure_ascii=False)}\n\n"
                seen += 1
            await asyncio.sleep(0.15)
        while seen < len(deltas):
            yield f"event: delta\ndata: {json.dumps({'text': deltas[seen]}, ensure_ascii=False)}\n\n"
            seen += 1
        try:
            result = task.result()
        except AuthenticationError:
            message = (
                "LLM API Key 无效或已过期，请检查 .env 中的 DEEPSEEK_API_KEY / OPENAI_API_KEY "
                "是否与 LLM_PROVIDER 匹配，修改后重启后端。"
            )
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except APIStatusError as exc:
            message = f"LLM 请求失败（{exc.status_code}）：{exc}"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except Exception as exc:
            message = f"生成失败：{exc}"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        yield f"event: done\ndata: {json.dumps(result, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@protected_router.post("/projects/{project_id}/chat/regenerate")
async def regenerate_chat_message(
    project_id: str,
    payload: RegenerateChatRequest,
    db: Session = Depends(get_db),
):
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.stream:
        try:
            return await _regenerate_once(project, payload, db)
        except (AuthenticationError, APIStatusError) as exc:
            raise llm_http_exception(exc) from exc

    async def event_stream() -> AsyncIterator[str]:
        deltas: list[str] = []
        yield f"event: delta\ndata: {json.dumps({'text': '开始重新生成…'}, ensure_ascii=False)}\n\n"

        async def run_regenerate() -> dict:
            return await _regenerate_once(project, payload, db, deltas=deltas)

        import asyncio

        from openai import APIStatusError, AuthenticationError

        task = asyncio.create_task(run_regenerate())
        seen = 0
        while not task.done():
            while seen < len(deltas):
                yield f"event: delta\ndata: {json.dumps({'text': deltas[seen]}, ensure_ascii=False)}\n\n"
                seen += 1
            await asyncio.sleep(0.15)
        while seen < len(deltas):
            yield f"event: delta\ndata: {json.dumps({'text': deltas[seen]}, ensure_ascii=False)}\n\n"
            seen += 1
        try:
            result = task.result()
        except HTTPException as exc:
            message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except AuthenticationError:
            message = (
                "LLM API Key 无效或已过期，请检查 .env 中的 DEEPSEEK_API_KEY / OPENAI_API_KEY "
                "是否与 LLM_PROVIDER 匹配，修改后重启后端。"
            )
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except APIStatusError as exc:
            message = f"LLM 请求失败（{exc.status_code}）：{exc}"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except Exception as exc:
            message = f"重新生成失败：{exc}"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        yield f"event: done\ndata: {json.dumps(result, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@protected_router.post("/projects/{project_id}/cascade")
async def cascade_project_platforms(
    project_id: str,
    payload: CascadeRequest,
    db: Session = Depends(get_db),
):
    project = project_repo.get_project(db, project_id, **_scope())
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.stream:
        try:
            return await _cascade_once(project, payload, db)
        except (AuthenticationError, APIStatusError) as exc:
            raise llm_http_exception(exc) from exc

    async def event_stream() -> AsyncIterator[str]:
        deltas: list[str] = []
        yield f"event: delta\ndata: {json.dumps({'text': '开始同步平台…'}, ensure_ascii=False)}\n\n"

        async def run_cascade() -> dict:
            return await _cascade_once(project, payload, db, deltas=deltas)

        import asyncio

        from openai import APIStatusError, AuthenticationError

        task = asyncio.create_task(run_cascade())
        seen = 0
        while not task.done():
            while seen < len(deltas):
                yield f"event: delta\ndata: {json.dumps({'text': deltas[seen]}, ensure_ascii=False)}\n\n"
                seen += 1
            await asyncio.sleep(0.15)
        while seen < len(deltas):
            yield f"event: delta\ndata: {json.dumps({'text': deltas[seen]}, ensure_ascii=False)}\n\n"
            seen += 1
        try:
            result = task.result()
        except AuthenticationError:
            message = "LLM API Key 无效或已过期，请检查配置后重启后端。"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except APIStatusError as exc:
            message = f"LLM 请求失败（{exc.status_code}）：{exc}"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        except Exception as exc:
            message = f"同步失败：{exc}"
            yield f"event: error\ndata: {json.dumps({'message': message}, ensure_ascii=False)}\n\n"
            return
        yield f"event: done\ndata: {json.dumps(result, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@protected_router.get("/inspirations", response_model=list[Inspiration])
def list_inspirations(db: Session = Depends(get_db)) -> list[Inspiration]:
    return inspiration_repo.list_all(db, **_scope())


@protected_router.post("/inspirations", response_model=Inspiration)
def create_inspiration(payload: InspirationCreate, db: Session = Depends(get_db)) -> Inspiration:
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    inspiration = Inspiration(
        content=content,
        source_type=payload.source_type,
        source_url=payload.source_url.strip(),
        image_url=payload.image_url.strip(),
        tags=payload.tags,
    )
    return inspiration_repo.create(db, inspiration, **_scope())


@protected_router.post("/inspirations/upload-screenshot", response_model=Inspiration)
async def upload_inspiration_screenshot(
    file: UploadFile = File(...),
    content: str = "",
    tags: str = "",
    db: Session = Depends(get_db),
) -> Inspiration:
    raw = await file.read()
    content_type = file.content_type or "image/jpeg"
    try:
        image_url = ImageGenerator(get_settings()).save_upload(raw, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    note = content.strip()
    if not note:
        note = f"截图灵感：{file.filename or '未命名图片'}"

    tag_list = [item.strip() for item in tags.replace("，", ",").split(",") if item.strip()]
    inspiration = Inspiration(
        content=note,
        source_type="screenshot",
        image_url=image_url,
        tags=tag_list,
    )
    return inspiration_repo.create(db, inspiration, **_scope())


@protected_router.post("/inspirations/from-link", response_model=Inspiration)
def create_inspiration_from_link(
    payload: InspirationFromLink,
    db: Session = Depends(get_db),
) -> Inspiration:
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    content = payload.content.strip() or f"网页剪藏：{url}"
    inspiration = Inspiration(
        content=content,
        source_type="link",
        source_url=url,
        tags=payload.tags,
    )
    return inspiration_repo.create(db, inspiration, **_scope())


@protected_router.get("/inspirations/export")
def export_inspirations(db: Session = Depends(get_db)) -> dict:
    items = inspiration_repo.list_all(db, **_scope())
    return {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "items": [item.model_dump(mode="json") for item in items],
    }


@protected_router.post("/inspirations/import")
def import_inspirations(
    payload: InspirationImportPayload,
    db: Session = Depends(get_db),
) -> dict[str, int]:
    created: list[Inspiration] = []
    for item in payload.items:
        content = item.content.strip()
        if not content:
            continue
        created.append(
            Inspiration(
                content=content,
                source_type=item.source_type,
                source_url=item.source_url.strip(),
                image_url=item.image_url.strip(),
                tags=item.tags,
            )
        )
    if created:
        inspiration_repo.bulk_create(db, created, **_scope())
    return {"imported": len(created)}


@protected_router.get("/inspirations/stats", response_model=InspirationStats)
def inspiration_stats(db: Session = Depends(get_db)) -> InspirationStats:
    items = inspiration_repo.list_all(db, **_scope())
    by_source = {"manual": 0, "screenshot": 0, "link": 0}
    highlight_count = 0
    for item in items:
        by_source[item.source_type] = by_source.get(item.source_type, 0) + 1
        if item.is_highlight:
            highlight_count += 1
    return InspirationStats(total=len(items), by_source=by_source, highlight_count=highlight_count)


@protected_router.patch("/inspirations/{inspiration_id}", response_model=Inspiration)
def update_inspiration(
    inspiration_id: str,
    payload: InspirationUpdate,
    db: Session = Depends(get_db),
) -> Inspiration:
    inspiration = inspiration_repo.get(db, inspiration_id, **_scope())
    if not inspiration:
        raise HTTPException(status_code=404, detail="Inspiration not found")

    data = inspiration.model_dump(mode="python")
    updates = payload.model_dump(exclude_unset=True)
    if "content" in updates and updates["content"] is not None:
        content = updates["content"].strip()
        if not content:
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        data["content"] = content
    if "tags" in updates and updates["tags"] is not None:
        data["tags"] = updates["tags"]
    if "is_highlight" in updates and updates["is_highlight"] is not None:
        data["is_highlight"] = updates["is_highlight"]

    updated = Inspiration.model_validate(data)
    return inspiration_repo.update(db, updated, **_scope())


@protected_router.post("/inspirations/{inspiration_id}/to-topic")
def inspiration_to_topic(inspiration_id: str, db: Session = Depends(get_db)) -> dict:
    inspiration = inspiration_repo.get(db, inspiration_id, **_scope())
    if not inspiration:
        raise HTTPException(status_code=404, detail="Inspiration not found")

    topic_title = inspiration.content[:64]
    if inspiration.trend_snapshot and inspiration.trend_snapshot.title.strip():
        topic_title = inspiration.trend_snapshot.title.strip()[:64]
    elif inspiration.content.strip():
        topic_title = inspiration.content.strip().splitlines()[0][:64]

    topic = Topic(
        title=topic_title,
        inspiration=inspiration.content,
        direction="社会观察",
        tone="温和共情",
        content_pillar=inspiration.tags[0] if inspiration.tags else "",
        trend_snapshot=inspiration.trend_snapshot,
    )
    saved_topic = topic_repo.create(db, topic, **_scope())
    pillar = saved_topic.content_pillar
    project = ContentProject(
        id=new_id(),
        title=saved_topic.title,
        inspiration=saved_topic.inspiration,
        topic_meta=TopicMeta(
            direction=saved_topic.direction,
            tone=saved_topic.tone,
            content_pillar=pillar,
        ),
        content_pillar=pillar,
    )
    saved_project = _save_project(db, project)
    return {
        "topic": saved_topic.model_dump(mode="json"),
        "project": saved_project.model_dump(mode="json"),
    }


@protected_router.delete("/inspirations/{inspiration_id}")
def delete_inspiration(inspiration_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not inspiration_repo.delete(db, inspiration_id, **_scope()):
        raise HTTPException(status_code=404, detail="Inspiration not found")
    return {"ok": True}


@protected_router.get("/topics", response_model=list[Topic])
def list_topics(db: Session = Depends(get_db)) -> list[Topic]:
    return topic_repo.list_all(db, **_scope())


@protected_router.post("/topics", response_model=Topic)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)) -> Topic:
    topic = Topic(**payload.model_dump())
    return topic_repo.create(db, topic, **_scope())


@protected_router.patch("/topics/{topic_id}", response_model=Topic)
def update_topic(
    topic_id: str,
    payload: TopicUpdate,
    db: Session = Depends(get_db),
) -> Topic:
    topic = topic_repo.get(db, topic_id, **_scope())
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    data = topic.model_dump(mode="python")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            data[key] = value
    updated = Topic.model_validate(data)
    return topic_repo.update(db, updated, **_scope())


@protected_router.get("/topics/stats", response_model=TopicStats)
def topic_stats(db: Session = Depends(get_db)) -> TopicStats:
    items = topic_repo.list_all(db, **_scope())
    by_tone: dict[str, int] = {}
    by_platform: dict[str, int] = {}
    by_material_status: dict[str, int] = {"idea": 0, "cases": 0, "ready": 0}

    for item in items:
        by_tone[item.tone] = by_tone.get(item.tone, 0) + 1
        by_material_status[item.material_status] = by_material_status.get(item.material_status, 0) + 1
        for platform in item.platforms:
            by_platform[platform] = by_platform.get(platform, 0) + 1

    top_tone = max(by_tone, key=by_tone.get) if by_tone else None
    return TopicStats(
        total=len(items),
        by_tone=by_tone,
        by_platform=by_platform,
        by_material_status=by_material_status,
        top_tone=top_tone,
    )


@protected_router.post("/topics/{topic_id}/to-project", response_model=ContentProject)
def topic_to_project(topic_id: str, db: Session = Depends(get_db)) -> ContentProject:
    topic = topic_repo.get(db, topic_id, **_scope())
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    project = ContentProject(
        id=new_id(),
        title=topic.title,
        inspiration=topic.inspiration or topic.title,
        content_pillar=topic.content_pillar,
        topic_meta=TopicMeta(
            direction=topic.direction,
            tone=topic.tone,
            audience=topic.audience,
            platforms=topic.platforms,
            content_pillar=topic.content_pillar,
            series=topic.series,
        ),
    )
    return _save_project(db, project)


@protected_router.delete("/topics/{topic_id}")
def delete_topic(topic_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not topic_repo.delete(db, topic_id, **_scope()):
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"ok": True}


@protected_router.get("/settings/style", response_model=AuthorStyleProfile)
def get_style_profile(db: Session = Depends(get_db)) -> AuthorStyleProfile:
    return style_repo.get(db, **_scope())


@protected_router.put("/settings/style", response_model=AuthorStyleProfile)
def update_style_profile(
    payload: AuthorStyleProfile,
    db: Session = Depends(get_db),
) -> AuthorStyleProfile:
    return style_repo.save(db, payload, **_scope())


@protected_router.get("/content-categories", response_model=ContentCategoriesResponse)
def list_content_categories(db: Session = Depends(get_db)) -> ContentCategoriesResponse:
    return ContentCategoriesResponse(categories=category_repo.list_all(db, **_scope()))


@protected_router.post("/content-categories", response_model=ContentCategory)
def create_content_category(
    payload: ContentCategoryCreate,
    db: Session = Depends(get_db),
) -> ContentCategory:
    try:
        return category_repo.add_custom(db, payload, **_scope())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@protected_router.delete("/content-categories/{category_id}")
def delete_content_category(category_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    try:
        if not category_repo.delete_custom(db, category_id, **_scope()):
            raise HTTPException(status_code=404, detail="Category not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


router.include_router(public_router)
router.include_router(protected_router)
