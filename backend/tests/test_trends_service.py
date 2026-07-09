from __future__ import annotations

from datetime import timedelta
from unittest.mock import MagicMock, patch

from app.models.schemas import TrendAnalysisRequest
from app.services import trends_service as mod
from app.models.schemas import TrendItem
from app.services.trends_service import TrendsService, _strip_html


def test_strip_html() -> None:
    assert _strip_html("<em>test</em>") == "test"


def test_get_board_uses_cache() -> None:
    service = TrendsService()
    sample = service._fallback_items()
    mod._cache["items"] = sample
    mod._cache["fetched_at"] = mod._now()
    mod._cache["sources"] = ["fallback"]
    mod._cache["wechat_picks"] = service._rule_wechat_picks(sample)

    board = service.get_board(force_refresh=False)
    assert board.cache_hit is True
    assert len(board.items) >= 1


def test_get_board_invalidates_stale_day_cache() -> None:
    service = TrendsService()
    sample = service._fallback_items()
    stale_at = mod._now() - timedelta(days=1)
    mod._cache["items"] = sample
    mod._cache["fetched_at"] = stale_at
    mod._cache["sources"] = ["fallback"]

    with patch.object(service, "_fetch_bilibili_hotwords", side_effect=RuntimeError("offline")):
        with patch.object(service, "_fetch_bilibili_popular", side_effect=RuntimeError("offline")):
            with patch.object(service, "_fetch_douyin_hot", side_effect=RuntimeError("offline")):
                with patch.object(service, "_fetch_douyin_popular", side_effect=RuntimeError("offline")):
                    with patch.object(service, "_fetch_wechat_hot", side_effect=RuntimeError("offline")):
                        with patch.object(service, "_fetch_wechat_search", side_effect=RuntimeError("offline")):
                            with patch.object(service, "_fetch_weibo_hot", side_effect=RuntimeError("offline")):
                                with patch.object(service, "_fetch_xiaohongshu_hot", side_effect=RuntimeError("offline")):
                                    board = service.get_board(force_refresh=False)

    assert board.cache_hit is False
    assert board.fetched_at is not None
    assert board.fetched_at > stale_at


def test_analyze_uses_same_day_cache() -> None:
    import asyncio

    service = TrendsService()
    payload = TrendAnalysisRequest(
        title="测试热点",
        source="微博热搜",
        platform="weibo_hot",
    )
    cached = mod.TrendAnalysis(
        why_hot="缓存内容",
        account_angle="缓存角度",
        topic_ideas=["选题 1"],
    )
    mod._analyze_cache[mod._analyze_cache_key(payload)] = (mod._now(), cached)

    with patch.object(service, "fetch_related") as mock_related:
        result = asyncio.run(service.analyze(payload))

    assert result.why_hot == "缓存内容"
    mock_related.assert_not_called()


def test_rule_wechat_picks_filters_negative() -> None:
    service = TrendsService()
    items = [
        *service._fallback_items(),
        TrendItem(
            id="bad-1",
            title="某明星官宣恋情",
            source="weibo_hot",
            source_label="微博热搜",
            rank=1,
            heat=99,
            heat_label="",
            url="",
            summary="",
        ),
    ]
    picks = service._rule_wechat_picks(items, limit=10)
    assert len(picks) <= 10
    assert all("官宣" not in pick.title for pick in picks)


def test_rule_wechat_picks_prefers_wechat_sources() -> None:
    service = TrendsService()
    items = [
        TrendItem(
            id="w1",
            title="农村老人总说没事，子女怎么判断该不该就医？",
            source="wechat_search",
            source_label="搜一搜热词",
            rank=3,
            heat=80,
            heat_label="",
            url="",
            summary="",
        ),
        TrendItem(
            id="d1",
            title="某游戏新版本上线",
            source="douyin_popular",
            source_label="抖音热门视频",
            rank=1,
            heat=95,
            heat_label="",
            url="",
            summary="",
        ),
    ]
    picks = service._rule_wechat_picks(items, limit=2)
    assert picks[0].source == "wechat_search"
    assert picks[0].article_title


@patch("app.services.trends_service.httpx.Client")
def test_fetch_bilibili_hotwords(mock_client_cls: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "code": 0,
        "list": [{"show_name": "测试热搜", "keyword": "测试热搜", "score": 10}],
    }
    mock_resp.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    service = TrendsService()
    items = service._fetch_bilibili_hotwords()
    assert len(items) == 1
    assert items[0].source == "bilibili_hot"


@patch("app.services.trends_service.httpx.Client")
def test_fetch_douyin_hot(mock_client_cls: MagicMock) -> None:
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "data": {"word_list": [{"word": "抖音测试热点", "hot_value": 12_000_000, "video_count": 100}]},
    }
    mock_resp.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    items = TrendsService()._fetch_douyin_hot()
    assert items[0].source == "douyin_hot"
    assert "抖音测试" in items[0].title


def test_parse_tophub_board_wechat() -> None:
    service = TrendsService()
    html = """
    <div class="cc-cd"><a href="/n/WnBe01o371"><span>微信</span></a>
    <a href="https://tophub.today/link?domain=taobao.com"><div class="cc-cd-cb-ll">
    <span class="s h">1</span><span class="t">商品链接应被过滤</span><span class="e">1</span>
    </div></a>
    <div class="i-o" hashid="WnBe01o371"></div>
    <a href="https://mp.weixin.qq.com/s/abc"><div class="cc-cd-cb-ll">
    <span class="s h">1</span><span class="t">测试公众号热文</span><span class="e">10.0万</span>
    </div></a></div>
    """
    mod._cache["tophub_html"] = html
    rows = service._parse_tophub_board("WnBe01o371", url_must_contain="mp.weixin.qq.com")
    assert len(rows) == 1
    assert rows[0]["title"] == "测试公众号热文"
    assert "mp.weixin.qq.com" in rows[0]["url"]
