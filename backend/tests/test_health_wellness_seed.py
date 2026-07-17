"""Tests for health & wellness seed presets."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.data.health_wellness_seed import (
    HEALTH_WELLNESS_CATEGORIES,
    HEALTH_WELLNESS_STYLE,
    HEALTH_WELLNESS_TOPICS,
)
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_wellness_seed_structure() -> None:
    assert len(HEALTH_WELLNESS_CATEGORIES) == 3
    assert len(HEALTH_WELLNESS_TOPICS) == 6

    category_names = {cat.name for cat in HEALTH_WELLNESS_CATEGORIES}
    assert category_names == {"身体信号", "情绪与低耗", "健康消费避坑"}

    for topic in HEALTH_WELLNESS_TOPICS:
        assert topic.content_pillar in category_names
        assert topic.title.strip()
        assert topic.inspiration.strip()

    assert "健康" in HEALTH_WELLNESS_STYLE.account_positioning
    assert "震惊" in HEALTH_WELLNESS_STYLE.banned_phrases


def test_seed_health_wellness_idempotent(client: TestClient) -> None:
    from app.data.health_wellness_seed import apply_health_wellness_seed
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        apply_health_wellness_seed(db)
    finally:
        db.close()
    categories = client.get("/api/content-categories").json()["categories"]
    names = {item["name"] for item in categories}
    assert "身体信号" in names
    assert "情绪与低耗" in names
    assert "健康消费避坑" in names

    topics = client.get("/api/topics").json()
    seeded_titles = {topic.title for topic in HEALTH_WELLNESS_TOPICS}
    assert seeded_titles.issubset({item["title"] for item in topics})

    db = SessionLocal()
    try:
        apply_health_wellness_seed(db)
    finally:
        db.close()

    topics_after = client.get("/api/topics").json()
    assert sum(1 for item in topics_after if item["title"] in seeded_titles) == 6
