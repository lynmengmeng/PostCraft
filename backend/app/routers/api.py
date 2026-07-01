from __future__ import annotations

import json
from collections.abc import AsyncIterator
from copy import deepcopy
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.database import get_db
from app.models.schemas import (
    ApplyTitleRequest,
    AuthorStyleProfile,
    ChatRequest,
    ContentProject,
    Inspiration,
    InspirationCreate,
    LLMStatus,
    ProjectCreate,
    ProjectUpdate,
    Topic,
    TopicCreate,
    TopicMeta,
    ChatMessage,
    new_id,
)
from app.services.chat_orchestrator import ChatOrchestrator
from app.services.fact_check import scan_project
from app.services.llm_client import LLMClient
from app.services.repository import inspiration_repo, project_repo, style_repo, topic_repo

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/llm/status", response_model=LLMStatus)
def llm_status() -> LLMStatus:
    return LLMClient(get_settings()).status()


@router.get("/projects", response_model=list[ContentProject])
def list_projects(db: Session = Depends(get_db)) -> list[ContentProject]:
    return project_repo.list_projects(db)


@router.post("/projects", response_model=ContentProject)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ContentProject:
    project = ContentProject(
        id=new_id(),
        title=payload.title or (payload.inspiration[:24] or "未命名项目"),
        inspiration=payload.inspiration,
        topic_meta=payload.topic_meta or TopicMeta(),
        content_pillar=payload.content_pillar,
    )
    return project_repo.save_project(db, project)


@router.get("/projects/{project_id}", response_model=ContentProject)
def get_project(project_id: str, db: Session = Depends(get_db)) -> ContentProject:
    project = project_repo.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/projects/{project_id}", response_model=ContentProject)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    project.updated_at = datetime.utcnow()
    return project_repo.save_project(db, project)


@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not project_repo.delete_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@router.post("/projects/{project_id}/apply-title", response_model=ContentProject)
def apply_title(
    project_id: str,
    payload: ApplyTitleRequest,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id)
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
    return project_repo.save_project(db, project)


@router.post("/projects/{project_id}/versions/{version_id}/restore", response_model=ContentProject)
def restore_version(
    project_id: str,
    version_id: str,
    db: Session = Depends(get_db),
) -> ContentProject:
    project = project_repo.get_project(db, project_id)
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
    return project_repo.save_project(db, restored)


@router.get("/projects/{project_id}/fact-check")
def fact_check(project_id: str, db: Session = Depends(get_db)) -> dict:
    project = project_repo.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    style = style_repo.get(db)
    warnings = scan_project(project, style.banned_phrases)
    return {"warnings": warnings}


async def _chat_once(
    project: ContentProject,
    payload: ChatRequest,
    db: Session,
) -> dict:
    orchestrator = ChatOrchestrator(get_settings())
    style_profile = style_repo.get(db)
    updated, patch, assistant = await orchestrator.handle_message(
        project,
        payload.message,
        payload.selected_platform,
        style_profile,
    )
    saved = project_repo.save_project(db, updated)
    return {
        "project": saved.model_dump(mode="json"),
        "patch": patch.model_dump(mode="json"),
        "assistant_message": assistant.model_dump(mode="json"),
    }


@router.post("/projects/{project_id}/chat")
async def chat_with_project(
    project_id: str,
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    project = project_repo.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.stream:
        return await _chat_once(project, payload, db)

    async def event_stream() -> AsyncIterator[str]:
        yield f"event: delta\ndata: {json.dumps({'text': '正在处理你的指令…'}, ensure_ascii=False)}\n\n"
        result = await _chat_once(project, payload, db)
        yield f"event: done\ndata: {json.dumps(result, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/inspirations", response_model=list[Inspiration])
def list_inspirations(db: Session = Depends(get_db)) -> list[Inspiration]:
    return inspiration_repo.list_all(db)


@router.post("/inspirations", response_model=Inspiration)
def create_inspiration(payload: InspirationCreate, db: Session = Depends(get_db)) -> Inspiration:
    inspiration = Inspiration(content=payload.content, source_type=payload.source_type, tags=payload.tags)
    return inspiration_repo.create(db, inspiration)


@router.post("/inspirations/{inspiration_id}/to-topic")
def inspiration_to_topic(inspiration_id: str, db: Session = Depends(get_db)) -> dict:
    inspirations = inspiration_repo.list_all(db)
    inspiration = next((item for item in inspirations if item.id == inspiration_id), None)
    if not inspiration:
        raise HTTPException(status_code=404, detail="Inspiration not found")

    topic = Topic(
        title=inspiration.content[:40],
        inspiration=inspiration.content,
        direction="社会观察",
        tone="温和共情",
    )
    saved_topic = topic_repo.create(db, topic)
    project = ContentProject(
        id=new_id(),
        title=saved_topic.title,
        inspiration=saved_topic.inspiration,
        topic_meta=TopicMeta(direction=saved_topic.direction, tone=saved_topic.tone),
    )
    saved_project = project_repo.save_project(db, project)
    return {
        "topic": saved_topic.model_dump(mode="json"),
        "project": saved_project.model_dump(mode="json"),
    }


@router.delete("/inspirations/{inspiration_id}")
def delete_inspiration(inspiration_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not inspiration_repo.delete(db, inspiration_id):
        raise HTTPException(status_code=404, detail="Inspiration not found")
    return {"ok": True}


@router.get("/topics", response_model=list[Topic])
def list_topics(db: Session = Depends(get_db)) -> list[Topic]:
    return topic_repo.list_all(db)


@router.post("/topics", response_model=Topic)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)) -> Topic:
    topic = Topic(**payload.model_dump())
    return topic_repo.create(db, topic)


@router.post("/topics/{topic_id}/to-project", response_model=ContentProject)
def topic_to_project(topic_id: str, db: Session = Depends(get_db)) -> ContentProject:
    topics = topic_repo.list_all(db)
    topic = next((item for item in topics if item.id == topic_id), None)
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
    return project_repo.save_project(db, project)


@router.delete("/topics/{topic_id}")
def delete_topic(topic_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not topic_repo.delete(db, topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"ok": True}


@router.get("/settings/style", response_model=AuthorStyleProfile)
def get_style_profile(db: Session = Depends(get_db)) -> AuthorStyleProfile:
    return style_repo.get(db)


@router.put("/settings/style", response_model=AuthorStyleProfile)
def update_style_profile(
    payload: AuthorStyleProfile,
    db: Session = Depends(get_db),
) -> AuthorStyleProfile:
    return style_repo.save(db, payload)
