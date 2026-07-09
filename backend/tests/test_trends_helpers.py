"""Trends helper tests."""

from __future__ import annotations

from app.models.schemas import Topic, TrendAnalysis, TrendInspirationSnapshot
from app.services.trends_helpers import collect_saved_trend_ids


def test_collect_saved_trend_ids_from_topics() -> None:
    class FakeRepo:
        @staticmethod
        def list_all(db, *, user_id, scoped):
            return [
                Topic(
                    title="热点选题 A",
                    trend_snapshot=TrendInspirationSnapshot(
                        trend_id="wechat_hot-abc",
                        title="热点选题 A",
                        analysis=TrendAnalysis(why_hot="讨论度高"),
                    ),
                ),
                Topic(title="普通选题"),
            ]

    import app.services.trends_helpers as mod

    original = mod.topic_repo
    mod.topic_repo = FakeRepo()
    try:
        ids = collect_saved_trend_ids(None, user_id=None, scoped=False)
    finally:
        mod.topic_repo = original
    assert ids == ["wechat_hot-abc"]
