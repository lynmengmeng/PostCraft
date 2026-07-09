"""Tests for Topic ↔ ContentProject linkage."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import TrendAnalysis, TrendInspirationSnapshot


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _create_topic(client: TestClient, *, with_trend: bool = False) -> str:
    payload: dict = {
        "title": "关联测试选题",
        "inspiration": "测试灵感正文",
        "content_pillar": "社会观察",
        "direction": "社会观察",
        "tone": "温和共情",
    }
    if with_trend:
        payload["source_type"] = "trend"
        payload["trend_snapshot"] = TrendInspirationSnapshot(
            trend_id="trend-1",
            title="热点标题",
            summary="热点摘要",
            analysis=TrendAnalysis(
                why_hot="讨论度高",
                account_angle="从家庭观察切入",
                topic_ideas=["角度一", "角度二"],
                platform_tips={"wechat": "公众号建议"},
            ),
        ).model_dump(mode="json")
    response = client.post("/api/topics", json=payload)
    assert response.status_code == 200
    return response.json()["id"]


def test_topic_to_project_links_both_sides(client: TestClient) -> None:
    topic_id = _create_topic(client, with_trend=True)

    first = client.post(f"/api/topics/{topic_id}/to-project")
    assert first.status_code == 200
    project = first.json()
    assert project["topic_id"] == topic_id
    assert project["topic_title"] == "关联测试选题"
    assert project["source_type"] == "trend"
    assert project["trend_snapshot"]["analysis"]["why_hot"] == "讨论度高"

    topic = client.get("/api/topics")
    assert topic.status_code == 200
    linked = next(item for item in topic.json() if item["id"] == topic_id)
    assert linked["project_id"] == project["id"]
    assert linked["status"] == "writing"

    second = client.post(f"/api/topics/{topic_id}/to-project")
    assert second.status_code == 200
    assert second.json()["id"] == project["id"]

    client.delete(f"/api/projects/{project['id']}")
    client.delete(f"/api/topics/{topic_id}")


def test_inspiration_to_project_creates_topic_and_links(client: TestClient) -> None:
    created = client.post(
        "/api/inspirations",
        json={
            "content": "灵感直接开写测试",
            "tags": ["测试栏目"],
            "source_type": "link",
            "source_url": "https://example.com/article",
        },
    )
    assert created.status_code == 200
    inspiration_id = created.json()["id"]

    project_resp = client.post(f"/api/inspirations/{inspiration_id}/to-project")
    assert project_resp.status_code == 200
    project = project_resp.json()
    assert project["topic_id"]
    assert project["source_type"] == "topic"
    assert project["source_url"] == "https://example.com/article"
    assert project["inspiration"] == "灵感直接开写测试"

    topics = client.get("/api/topics").json()
    linked = next(item for item in topics if item["id"] == project["topic_id"])
    assert linked["project_id"] == project["id"]
    assert linked["status"] == "writing"
    assert linked["material_status"] == "ready"
    assert linked["source_url"] == "https://example.com/article"

    missing = client.post(f"/api/inspirations/{inspiration_id}/to-project")
    assert missing.status_code == 404

    client.delete(f"/api/projects/{project['id']}")
    client.delete(f"/api/topics/{project['topic_id']}")


def test_topic_to_project_updates_material_status(client: TestClient) -> None:
    topic_id = _create_topic(client)
    client.post(f"/api/topics/{topic_id}/to-project")
    topic = next(item for item in client.get("/api/topics").json() if item["id"] == topic_id)
    assert topic["material_status"] == "ready"
    assert topic["status"] == "writing"
    if topic.get("project_id"):
        client.delete(f"/api/projects/{topic['project_id']}")
    client.delete(f"/api/topics/{topic_id}")


def test_create_project_defaults_to_direct(client: TestClient) -> None:
    response = client.post("/api/projects", json={"inspiration": "工作台直开写"})
    assert response.status_code == 200
    project = response.json()
    assert project["source_type"] == "direct"
    client.delete(f"/api/projects/{project['id']}")


def test_creation_context_block() -> None:
    from app.models.schemas import ContentProject, TopicMeta
    from app.services.creation_context import build_creation_context_block, platform_tip_block

    project = ContentProject(
        title="测试",
        inspiration="灵感",
        topic_id="topic-1",
        topic_title="测试选题",
        trend_snapshot=TrendInspirationSnapshot(
            trend_id="t1",
            title="热点",
            analysis=TrendAnalysis(
                why_hot="很火",
                account_angle="家庭视角",
                platform_tips={"wechat": "用故事开头"},
            ),
        ),
        topic_meta=TopicMeta(direction="社会观察", tone="温和"),
    )
    block = build_creation_context_block(project)
    assert "来源选题: 测试选题" in block
    assert "为什么热: 很火" in block
    assert "账号切入角度: 家庭视角" in block
    assert "用故事开头" in platform_tip_block(project, "wechat")
