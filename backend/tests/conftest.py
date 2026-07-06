"""Test configuration — default auth off; opt-in via @pytest.mark.auth."""

from __future__ import annotations

import os
import uuid

import pytest

os.environ.setdefault("AUTH_REQUIRED", "false")

from app.config import reload_settings  # noqa: E402

reload_settings()


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "auth: tests requiring AUTH_REQUIRED=true")


@pytest.fixture(autouse=True)
def _auth_env(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    if request.node.get_closest_marker("auth"):
        monkeypatch.setenv("AUTH_REQUIRED", "true")
        monkeypatch.setenv("JWT_SECRET", "test-secret-key-for-auth-tests-only")
        monkeypatch.setenv("ALLOW_REGISTER", "true")
    else:
        monkeypatch.setenv("AUTH_REQUIRED", "false")
    reload_settings()


@pytest.fixture
def unique_username() -> str:
    return f"user_{uuid.uuid4().hex[:10]}"
