"""Image path and upload security tests."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.utils.image_bytes import detect_image_content_type
from app.utils.image_path import resolve_image_path


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_detect_png_bytes() -> None:
    png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    assert detect_image_content_type(png_header) == "image/png"


def test_detect_rejects_random_bytes() -> None:
    assert detect_image_content_type(b"not-an-image") is None


def test_resolve_image_path_rejects_traversal() -> None:
    settings = get_settings()
    with pytest.raises(HTTPException) as exc:
        resolve_image_path(settings.images_dir, "../postcraft.db")
    assert exc.value.status_code == 404


def test_get_image_rejects_traversal(client: TestClient) -> None:
    response = client.get("/api/images/..%2Fpostcraft.db")
    assert response.status_code == 404


def test_get_image_missing_file(client: TestClient) -> None:
    response = client.get("/api/images/does-not-exist-abc123.png")
    assert response.status_code == 404
