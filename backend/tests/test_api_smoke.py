"""API smoke tests for core Phase 1 flows."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_auth_config(client: TestClient) -> None:
    response = client.get("/api/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert "auth_required" in data
    assert "allow_register" in data


def test_project_crud_smoke(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={"inspiration": "smoke test inspiration", "title": "Smoke Test"},
    )
    assert create.status_code == 200
    project = create.json()
    project_id = project["id"]
    assert project["inspiration"] == "smoke test inspiration"

    listed = client.get("/api/projects")
    assert listed.status_code == 200
    assert any(item["id"] == project_id for item in listed.json())

    patched = client.patch(
        f"/api/projects/{project_id}",
        json={"humanized": "观察型初稿 smoke", "draft": "观察型初稿 smoke"},
    )
    assert patched.status_code == 200
    assert patched.json()["humanized"] == "观察型初稿 smoke"

    deleted = client.delete(f"/api/projects/{project_id}")
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True


def test_project_draft_export_import_smoke(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={"inspiration": "跨环境初稿测试", "title": "初稿导出测试"},
    )
    assert create.status_code == 200
    project_id = create.json()["id"]

    client.patch(
        f"/api/projects/{project_id}",
        json={
            "draft": "观察型初稿正文",
            "humanized": "观察型人性化初稿",
        },
    )

    exported = client.get(f"/api/projects/{project_id}/export-draft")
    assert exported.status_code == 200
    bundle = exported.json()
    assert bundle["version"] == 1
    assert bundle["kind"] == "draft"
    assert bundle["humanized"] == "观察型人性化初稿"

    imported = client.post(
        "/api/projects/import-draft",
        json={
            "version": 1,
            "kind": "draft",
            "title": bundle["title"],
            "inspiration": bundle["inspiration"],
            "topic_meta": bundle["topic_meta"],
            "content_pillar": bundle["content_pillar"],
            "draft": bundle["draft"],
            "humanized": bundle["humanized"],
            "chat_summary": "用户希望语气更温和",
            "chat_summary_through": 2,
        },
    )
    assert imported.status_code == 200
    new_project = imported.json()
    assert new_project["id"] != project_id
    assert new_project["humanized"] == "观察型人性化初稿"
    assert new_project["chat_summary"] == "用户希望语气更温和"
    assert new_project["platforms"]["wechat"]["body"] == ""
    assert new_project["chat_history"] == []

    client.delete(f"/api/projects/{project_id}")
    client.delete(f"/api/projects/{new_project['id']}")


def test_project_draft_import_rejects_empty(client: TestClient) -> None:
    response = client.post(
        "/api/projects/import-draft",
        json={"version": 1, "kind": "draft", "title": "空包", "inspiration": "仅有灵感"},
    )
    assert response.status_code == 400


def test_chat_generate_draft_mock(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={"inspiration": "chat smoke test"},
    )
    project_id = create.json()["id"]
    chat = client.post(
        f"/api/projects/{project_id}/chat",
        json={"message": "", "selected_platform": "wechat", "stream": False, "action": "generate_draft"},
    )
    assert chat.status_code == 200
    body = chat.json()
    assert body["project"]["id"] == project_id
    assert body["patch"]["intent"] == "generate_draft"
    client.delete(f"/api/projects/{project_id}")


def test_fact_check_returns_warnings_shape(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={"inspiration": "震惊！必看！"},
    )
    project_id = create.json()["id"]
    client.patch(
        f"/api/projects/{project_id}",
        json={"humanized": "包治百病的神奇方法", "draft": "包治百病的神奇方法"},
    )
    check = client.get(f"/api/projects/{project_id}/fact-check")
    assert check.status_code == 200
    warnings = check.json()["warnings"]
    assert isinstance(warnings, list)
    if warnings:
        item = warnings[0]
        assert "phrase" in item
        assert "suggestion" in item
    client.delete(f"/api/projects/{project_id}")


def test_trial_summary(client: TestClient) -> None:
    response = client.get("/api/analytics/trial-summary")
    assert response.status_code == 200
    data = response.json()
    assert "completion_rate" in data
    assert "avg_chat_rounds" in data


def test_parse_patch_field_intent() -> None:
    from app.services.intent_parser import parse_intent

    parsed = parse_intent("只改标题，更吸引人", "wechat", has_draft=True)
    assert parsed.intent == "patch_field"
    assert parsed.patch_fields == ["title"]


def test_restore_version_uses_snapshot_chat_history(client: TestClient) -> None:
    create = client.post(
        "/api/projects",
        json={"inspiration": "版本恢复测试", "title": "版本恢复"},
    )
    assert create.status_code == 200
    project_id = create.json()["id"]

    first = client.post(
        f"/api/projects/{project_id}/chat",
        json={
            "message": "",
            "selected_platform": "wechat",
            "stream": False,
            "action": "generate_draft",
        },
    )
    assert first.status_code == 200
    after_first = first.json()["project"]
    assert len(after_first["chat_history"]) == 2
    first_humanized = after_first["humanized"]

    second = client.post(
        f"/api/projects/{project_id}/chat",
        json={
            "message": "更温和一点",
            "selected_platform": "wechat",
            "stream": False,
        },
    )
    assert second.status_code == 200
    after_second = second.json()["project"]
    assert len(after_second["chat_history"]) == 4
    assert after_second["humanized"] != first_humanized
    version_id = after_second["versions"][1]["id"]

    restored = client.post(f"/api/projects/{project_id}/versions/{version_id}/restore")
    assert restored.status_code == 200
    data = restored.json()
    assert data["humanized"] == first_humanized
    assert len(data["chat_history"]) == 4
    assert data["chat_history"][-1]["content"].startswith("已恢复到版本：")
    assert data["chat_history"][-2]["role"] == "user"
    assert data["chat_history"][-2]["content"] == "更温和一点"

    client.delete(f"/api/projects/{project_id}")
