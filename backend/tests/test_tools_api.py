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


def test_trend_to_inspiration(client: TestClient) -> None:
    response = client.post(
        "/api/tools/trends/to-inspiration",
        json={
            "title": "测试灵感标题",
            "inspiration": "热点推荐测试",
            "content_pillar": "热点观察",
            "source_url": "https://mp.weixin.qq.com/s/test",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"]
    assert "热点工具" in data["tags"]
