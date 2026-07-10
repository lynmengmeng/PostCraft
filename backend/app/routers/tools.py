from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.schemas import (
    ContentProject,
    DouyinContent,
    DouyinCoverGenerateRequest,
    DouyinCoverGenerateResponse,
    DouyinOpsBoardResponse,
    SeriesCoverGenerateRequest,
    SeriesEpisodeDetail,
    SeriesExtendRequest,
    SeriesStudioResponse,
    SeriesStudioUpdateRequest,
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
from app.services.douyin_ops_service import DouyinOpsService
from app.services.trends_helpers import collect_saved_trend_ids
from app.deps.auth import get_scope_kwargs, require_auth
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.repository import TopicRepository, project_repo
from app.config import get_settings
from app.services.image_generator import ImageGenerator

router = APIRouter(prefix="/tools", tags=["tools"], dependencies=[Depends(require_auth)])

topic_repo = TopicRepository()


def _scope() -> dict[str, str | bool | None]:
    return get_scope_kwargs()


def _service() -> TrendsService:
    return TrendsService()


def _douyin_service() -> DouyinOpsService:
    return DouyinOpsService()


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


@router.get("/douyin-ops", response_model=DouyinOpsBoardResponse)
async def get_douyin_ops(
    refresh: bool = Query(False, description="强制刷新今日推荐"),
    db: Session = Depends(get_db),
) -> DouyinOpsBoardResponse:
    board = await _douyin_service().get_board(force_refresh=refresh)
    scope = _scope()
    board.saved_pick_ids = collect_saved_trend_ids(
        db,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )
    return board


@router.post("/douyin-ops/refresh", response_model=DouyinOpsBoardResponse)
async def refresh_douyin_ops(db: Session = Depends(get_db)) -> DouyinOpsBoardResponse:
    board = await _douyin_service().get_board(force_refresh=True)
    scope = _scope()
    board.saved_pick_ids = collect_saved_trend_ids(
        db,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )
    return board


@router.post("/douyin-ops/generate-cover", response_model=DouyinCoverGenerateResponse)
async def generate_douyin_cover(
    payload: DouyinCoverGenerateRequest,
) -> DouyinCoverGenerateResponse:
    hook = payload.hook.strip()
    if not hook:
        raise HTTPException(status_code=400, detail="钩子文案不能为空")
    prompt = payload.cover_prompt.strip() or (
        f"抖音竖版封面，生活纪实风格，温暖自然光，画面呼应「{hook[:24]}」，"
        "真实朴素，无文字水印，适合短视频封面"
    )
    generator = ImageGenerator(get_settings())
    cover_url = await generator.generate(prompt, aspect="douyin")
    if payload.pick_id:
        _douyin_service().update_pick_cover(payload.pick_id, cover_url)
    return DouyinCoverGenerateResponse(
        cover_url=cover_url,
        placeholder=generator.last_was_placeholder,
    )


@router.get("/douyin-ops/series", response_model=SeriesStudioResponse)
async def get_series_studio(db: Session = Depends(get_db)) -> SeriesStudioResponse:
    scope = _scope()
    return await _douyin_service().get_series_studio(
        db,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )


@router.patch("/douyin-ops/series", response_model=SeriesStudioResponse)
async def update_series_studio(
    payload: SeriesStudioUpdateRequest,
    db: Session = Depends(get_db),
) -> SeriesStudioResponse:
    scope = _scope()
    return await _douyin_service().update_series_studio_async(
        db,
        intro_copy=payload.intro_copy,
        episode=payload.episode,
        notes=payload.notes,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )


@router.post("/douyin-ops/series/generate-cover", response_model=DouyinCoverGenerateResponse)
async def generate_series_cover(
    payload: SeriesCoverGenerateRequest,
    db: Session = Depends(get_db),
) -> DouyinCoverGenerateResponse:
    service = _douyin_service()
    scope = _scope()
    episode = payload.episode
    title = payload.title.strip()
    if episode and not title and 1 <= episode <= len(service.SERIES.episodes):
        title = service.SERIES.episodes[episode - 1]

    prompt = payload.cover_prompt.strip()
    if not prompt:
        prompt = service._default_series_cover_prompt(
            episode=episode,
            title=title,
        )

    generator = ImageGenerator(get_settings())
    cover_url = await generator.generate(prompt, aspect="douyin")
    await service.save_series_cover(
        db,
        cover_url,
        episode=episode,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )
    return DouyinCoverGenerateResponse(
        cover_url=cover_url,
        placeholder=generator.last_was_placeholder,
    )


@router.post("/douyin-ops/series/episodes/{episode}/generate-script", response_model=SeriesEpisodeDetail)
async def generate_episode_script(
    episode: int,
    db: Session = Depends(get_db),
) -> SeriesEpisodeDetail:
    scope = _scope()
    try:
        return await _douyin_service().generate_episode_script(
            episode,
            db=db,
            user_id=scope.get("user_id"),  # type: ignore[arg-type]
            scoped=bool(scope.get("scoped")),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/douyin-ops/series/extend", response_model=SeriesStudioResponse)
async def extend_series(
    payload: SeriesExtendRequest,
    db: Session = Depends(get_db),
) -> SeriesStudioResponse:
    scope = _scope()
    return await _douyin_service().extend_series(
        db,
        count=payload.count,
        user_id=scope.get("user_id"),  # type: ignore[arg-type]
        scoped=bool(scope.get("scoped")),
    )


@router.post("/douyin-ops/to-topic", response_model=Topic)
def douyin_pick_to_topic(
    payload: TrendToTopicRequest,
    db: Session = Depends(get_db),
) -> Topic:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    topic = Topic(
        title=title,
        content_pillar=payload.content_pillar or "抖音运营",
        direction="社会观察",
        tone=payload.tone,
        inspiration=payload.inspiration or f"抖音运营收录：{title}",
        material_status="idea",
        priority="soon",
        source_type="trend",
        source_url=payload.source_url,
        trend_snapshot=payload.trend_snapshot,
    )
    return topic_repo.create(db, topic, **_scope())


@router.post("/douyin-ops/to-project", response_model=ContentProject)
def douyin_pick_to_project(
    payload: TrendToTopicRequest,
    db: Session = Depends(get_db),
) -> ContentProject:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")

    hook = payload.cover_headline.strip() or title[:36]
    project = ContentProject(
        id=new_id(),
        title=title,
        inspiration=payload.inspiration.strip() or f"抖音选题：{title}",
        content_pillar=payload.content_pillar or "抖音运营",
        platforms={
            "wechat": WechatContent(),
            "xiaohongshu": XiaohongshuContent(),
            "douyin": DouyinContent(hook=hook),
        },
    )
    return project_repo.save_project(db, project, **_scope())
