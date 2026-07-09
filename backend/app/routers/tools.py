from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.schemas import (
    ContentProject,
    DouyinContent,
    Topic,
    TrendAnalysis,
    TrendAnalysisRequest,
    TrendRelatedItem,
    TrendToTopicRequest,
    TrendsBoardResponse,
    WechatContent,
    XiaohongshuContent,
    new_id,
)
from app.services.trends_service import TrendsService
from app.services.trends_helpers import collect_saved_trend_ids
from app.deps.auth import get_scope_kwargs, require_auth
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.repository import TopicRepository, project_repo

router = APIRouter(prefix="/tools", tags=["tools"], dependencies=[Depends(require_auth)])

topic_repo = TopicRepository()


def _scope() -> dict[str, str | bool | None]:
    return get_scope_kwargs()


def _service() -> TrendsService:
    return TrendsService()


@router.get("/trends", response_model=TrendsBoardResponse)
async def get_trends(
    refresh: bool = Query(False, description="强制刷新热点缓存"),
    db: Session = Depends(get_db),
) -> TrendsBoardResponse:
    board = await _service().get_board_with_picks(force_refresh=refresh)
    scope = _scope()
    board.saved_trend_ids = collect_saved_trend_ids(
        db,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )
    return board


@router.post("/trends/refresh", response_model=TrendsBoardResponse)
async def refresh_trends(db: Session = Depends(get_db)) -> TrendsBoardResponse:
    board = await _service().get_board_with_picks(force_refresh=True)
    scope = _scope()
    board.saved_trend_ids = collect_saved_trend_ids(
        db,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )
    return board


@router.get("/trends/related", response_model=list[TrendRelatedItem])
def trend_related(
    keyword: str = Query(..., min_length=1),
    platform: str = Query("", description="热点来源标识，如 douyin_hot / wechat_hot"),
) -> list[TrendRelatedItem]:
    return _service().fetch_related(keyword, platform=platform)


@router.post("/trends/analyze", response_model=TrendAnalysis)
async def analyze_trend(payload: TrendAnalysisRequest) -> TrendAnalysis:
    try:
        return await _service().analyze(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/trends/to-topic", response_model=Topic)
def trend_to_topic(
    payload: TrendToTopicRequest,
    db: Session = Depends(get_db),
) -> Topic:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    topic = Topic(
        title=title,
        content_pillar=payload.content_pillar,
        direction="社会观察",
        tone=payload.tone,
        inspiration=payload.inspiration or f"热点工具收录：{title}",
        material_status="idea",
        priority="soon",
        source_type="trend",
        source_url=payload.source_url,
        trend_snapshot=payload.trend_snapshot,
    )
    return topic_repo.create(db, topic, **_scope())


@router.post("/trends/to-project", response_model=ContentProject)
def trend_to_project(
    payload: TrendToTopicRequest,
    db: Session = Depends(get_db),
) -> ContentProject:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")

    headline = payload.cover_headline.strip() or title[:20]
    subheadline = payload.cover_subheadline.strip() or title[:40]
    project = ContentProject(
        id=new_id(),
        title=title,
        inspiration=payload.inspiration.strip() or f"热点：{title}",
        content_pillar=payload.content_pillar,
        platforms={
            "wechat": WechatContent(cover_headline=headline, cover_subheadline=subheadline),
            "xiaohongshu": XiaohongshuContent(),
            "douyin": DouyinContent(),
        },
    )
    return project_repo.save_project(db, project, **_scope())
