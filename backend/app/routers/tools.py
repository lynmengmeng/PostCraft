from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.schemas import (
    Inspiration,
    Topic,
    TrendAnalysis,
    TrendAnalysisRequest,
    TrendRelatedItem,
    TrendToTopicRequest,
    TrendsBoardResponse,
)
from app.services.trends_service import TrendsService
from app.deps.auth import get_scope_kwargs, require_auth
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.repository import InspirationRepository, TopicRepository

router = APIRouter(prefix="/tools", tags=["tools"], dependencies=[Depends(require_auth)])

topic_repo = TopicRepository()
inspiration_repo = InspirationRepository()


def _scope() -> dict[str, str | bool | None]:
    return get_scope_kwargs()


def _service() -> TrendsService:
    return TrendsService()


@router.get("/trends", response_model=TrendsBoardResponse)
async def get_trends(
    refresh: bool = Query(False, description="强制刷新热点缓存"),
) -> TrendsBoardResponse:
    return await _service().get_board_with_picks(force_refresh=refresh)


@router.post("/trends/refresh", response_model=TrendsBoardResponse)
async def refresh_trends() -> TrendsBoardResponse:
    return await _service().get_board_with_picks(force_refresh=True)


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
    )
    return topic_repo.create(db, topic, **_scope())


@router.post("/trends/to-inspiration", response_model=Inspiration)
def trend_to_inspiration(
    payload: TrendToTopicRequest,
    db: Session = Depends(get_db),
) -> Inspiration:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    content = payload.inspiration.strip() or f"热点：{title}"
    inspiration = Inspiration(
        content=content,
        source_type="link",
        source_url="",
        tags=["热点工具", payload.content_pillar or "热点观察"],
    )
    return inspiration_repo.create(db, inspiration, **_scope())
