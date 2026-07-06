"""Auth integration tests with AUTH_REQUIRED=true."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.mark.auth
def test_protected_route_requires_auth(client: TestClient) -> None:
    response = client.get("/api/projects")
    assert response.status_code == 401


@pytest.mark.auth
def test_register_login_and_access(client: TestClient, unique_username: str) -> None:
    password = "testpass123"

    register = client.post(
        "/api/auth/register",
        json={"username": unique_username, "password": password},
    )
    assert register.status_code == 200
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    projects = client.get("/api/projects", headers=headers)
    assert projects.status_code == 200
    assert isinstance(projects.json(), list)

    create = client.post(
        "/api/projects",
        json={"inspiration": "auth test", "title": "Auth Test"},
        headers=headers,
    )
    assert create.status_code == 200
    project_id = create.json()["id"]

    other = TestClient(app)
    forbidden = other.get(f"/api/projects/{project_id}")
    assert forbidden.status_code == 401

    other_user = f"other_{unique_username}"
    wrong_user_register = client.post(
        "/api/auth/register",
        json={"username": other_user, "password": password},
    )
    assert wrong_user_register.status_code == 200
    other_token = wrong_user_register.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    not_found = client.get(f"/api/projects/{project_id}", headers=other_headers)
    assert not_found.status_code == 404
