"""Smoke tests for content category API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_content_categories_defaults(client: TestClient) -> None:
    response = client.get("/api/content-categories")
    assert response.status_code == 200
    categories = response.json()["categories"]
    names = {item["name"] for item in categories}
    assert "周末出走计划" in names
    assert "便宜但有用" in names
    assert "一个小故事" in names
    assert "路上听什么" in names
    assert "普通人观察" in names
    assert all(item["builtin"] for item in categories)


def test_content_categories_custom_crud(client: TestClient) -> None:
    create = client.post(
        "/api/content-categories",
        json={
            "name": "测试自定义栏目",
            "description": "仅用于测试",
            "structure_hint": "测试结构",
            "title_style": "测试标题",
        },
    )
    assert create.status_code == 200
    created = create.json()
    assert created["name"] == "测试自定义栏目"
    assert created["builtin"] is False
    assert created["structure_hint"] == "测试结构"

    patch = client.patch(
        f"/api/content-categories/{created['id']}",
        json={"prompt_hint": "更新后的写作指引", "cover_mood": "测试封面气质"},
    )
    assert patch.status_code == 200
    updated = patch.json()
    assert updated["prompt_hint"] == "更新后的写作指引"
    assert updated["cover_mood"] == "测试封面气质"

    listed = client.get("/api/content-categories")
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()["categories"]}
    assert created["id"] in ids

    deleted = client.delete(f"/api/content-categories/{created['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True


def test_content_categories_builtin_override(client: TestClient) -> None:
    patch = client.patch(
        "/api/content-categories/weekend-out",
        json={"prompt_hint": "用户自定义周末出走指引"},
    )
    assert patch.status_code == 200
    data = patch.json()
    assert data["prompt_hint"] == "用户自定义周末出走指引"
    assert data["builtin"] is True


def test_project_with_content_pillar(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={
            "inspiration": "骑电动车去东西湖大堤",
            "content_pillar": "周末出走计划",
        },
    )
    assert create.status_code == 200
    project = create.json()
    assert project["content_pillar"] == "周末出走计划"

    patched = client.patch(
        f"/api/projects/{project['id']}",
        json={"content_pillar": "路上听什么"},
    )
    assert patched.status_code == 200
    assert patched.json()["content_pillar"] == "路上听什么"
    assert patched.json()["topic_meta"]["content_pillar"] == "路上听什么"


def test_create_project_syncs_topic_meta_pillar(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={
            "inspiration": "测试同步",
            "content_pillar": "普通人观察",
        },
    )
    assert create.status_code == 200
    data = create.json()
    assert data["content_pillar"] == "普通人观察"
    assert data["topic_meta"]["content_pillar"] == "普通人观察"
