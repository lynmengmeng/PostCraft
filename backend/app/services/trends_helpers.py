from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.schemas import Inspiration
from app.services.repository import inspiration_repo


def collect_saved_trend_ids(db: Session, *, user_id: str | None, scoped: bool) -> list[str]:
    inspirations = inspiration_repo.list_all(db, user_id=user_id, scoped=scoped)
    saved: list[str] = []
    for item in inspirations:
        for tag in item.tags:
            if tag.startswith("trend:"):
                trend_id = tag.removeprefix("trend:")
                if trend_id:
                    saved.append(trend_id)
    return saved


def inspiration_from_trend(payload_tags: list[str], trend_id: str) -> list[str]:
    tags = list(payload_tags)
    if trend_id:
        marker = f"trend:{trend_id}"
        if marker not in tags:
            tags.append(marker)
    return tags
