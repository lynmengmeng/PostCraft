from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.repository import topic_repo


def collect_saved_trend_ids(db: Session, *, user_id: str | None, scoped: bool) -> list[str]:
    topics = topic_repo.list_all(db, user_id=user_id, scoped=scoped)
    saved: list[str] = []
    for topic in topics:
        snapshot = topic.trend_snapshot
        if snapshot and snapshot.trend_id:
            saved.append(snapshot.trend_id)
    return saved
