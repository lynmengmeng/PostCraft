"""Trends helper tests."""

from __future__ import annotations

from app.models.schemas import Inspiration
from app.services.trends_helpers import collect_saved_trend_ids, inspiration_from_trend


def test_inspiration_from_trend_adds_tag() -> None:
    tags = inspiration_from_trend(["热点工具"], "wechat_hot-abc123")
    assert "trend:wechat_hot-abc123" in tags


def test_collect_saved_trend_ids() -> None:
    class FakeRepo:
        @staticmethod
        def list_all(db, *, user_id, scoped):
            return [
                Inspiration(content="a", tags=["热点工具", "trend:wechat_hot-abc"]),
                Inspiration(content="b", tags=["其他"]),
            ]

    import app.services.trends_helpers as mod

    original = mod.inspiration_repo
    mod.inspiration_repo = FakeRepo()
    try:
        ids = collect_saved_trend_ids(None, user_id=None, scoped=False)
    finally:
        mod.inspiration_repo = original
    assert ids == ["wechat_hot-abc"]
