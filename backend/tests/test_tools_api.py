"""Tools API smoke tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_get_trends(client: TestClient) -> None:
    response = client.get("/api/tools/trends")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "wechat_picks" in data
    assert "saved_trend_ids" in data


def test_get_douyin_ops(client: TestClient) -> None:
    response = client.get("/api/tools/douyin-ops")
    assert response.status_code == 200
    data = response.json()
    assert "picks" in data
    assert "saved_pick_ids" in data
    assert isinstance(data["picks"], list)


def test_get_series_studio(client: TestClient) -> None:
    response = client.get("/api/tools/douyin-ops/series")
    assert response.status_code == 200
    data = response.json()
    assert data["series_name"]
    assert len(data["episodes"]) == 30
    assert data["episodes"][0]["episode"] == 1


def test_generate_episode_script(client: TestClient) -> None:
    response = client.post("/api/tools/douyin-ops/series/episodes/1/generate-script")
    assert response.status_code == 200
    data = response.json()
    assert data["hook"]
    assert data["status"] == "scripted"


def test_douyin_pick_to_project(client: TestClient) -> None:
    response = client.post(
        "/api/tools/douyin-ops/to-project",
        json={
            "title": "你有没有发现，越来越多年轻人开始反向消费？",
            "inspiration": "抖音运营推荐",
            "cover_headline": "反向消费背后",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["platforms"]["douyin"]["hook"] == "反向消费背后"


def test_trend_to_project_prefills_cover(client: TestClient) -> None:
    response = client.post(
        "/api/tools/trends/to-project",
        json={
            "title": "农村老人总说没事，子女怎么判断？",
            "inspiration": "热点推荐",
            "cover_headline": "老人总说没事",
            "cover_subheadline": "子女先查这3件事",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["platforms"]["wechat"]["cover_headline"] == "老人总说没事"


def test_trend_analyze(client: TestClient) -> None:
    response = client.post(
        "/api/tools/trends/analyze",
        json={
            "title": "欧洲热浪持续，普通人如何应对",
            "source": "微博热搜",
            "summary": "测试摘要",
            "platform": "weibo_hot",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["why_hot"]
    assert isinstance(data["topic_ideas"], list)
    assert len(data["topic_ideas"]) >= 1


def test_trend_to_topic_with_snapshot(client: TestClient) -> None:
    response = client.post(
        "/api/tools/trends/to-topic",
        json={
            "title": "等退休是场巨大的骗局",
            "inspiration": "热点分析摘要",
            "content_pillar": "热点观察",
            "trend_id": "wechat_hot-abc",
            "trend_snapshot": {
                "trend_id": "wechat_hot-abc",
                "title": "等退休是场巨大的骗局",
                "source_label": "公众号热文",
                "summary": "写作角度说明",
                "url": "",
                "analysis": {
                    "why_hot": "讨论度高",
                    "account_angle": "从理财规划切入",
                    "topic_ideas": ["选题 1"],
                    "platform_tips": {"wechat": "写长文"},
                    "caution": "",
                    "related": [],
                },
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "等退休是场巨大的骗局"
    assert data["trend_snapshot"]["analysis"]["why_hot"] == "讨论度高"
