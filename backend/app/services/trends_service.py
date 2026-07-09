from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

import hashlib
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings, get_settings
from app.models.schemas import (
    TrendAnalysis,
    TrendAnalysisRequest,
    TrendItem,
    TrendRelatedItem,
    TrendsBoardResponse,
    WechatInspirationPick,
)
from app.services.llm_client import LLMClient
from app.services.repository import parse_json_from_text

logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

BILI_REFERER = {"Referer": "https://www.bilibili.com"}
DOUYIN_REFERER = {"Referer": "https://www.douyin.com/"}
WEIBO_REFERER = {"Referer": "https://weibo.com/"}

TOPHUB_HOME = "https://tophub.today/"
TOPHUB_ITEM_RE = re.compile(
    r'<a href="([^"]+)"[^>]*>\s*<div class="cc-cd-cb-ll">\s*'
    r'<span class="s[^"]*">(\d+)</span>\s*'
    r'<span class="t">([^<]+)</span>\s*'
    r'<span class="e">([^<]*)</span>',
    re.S,
)

_cache: dict[str, Any] = {
    "items": [],
    "fetched_at": None,
    "tophub_html": None,
    "wechat_picks": [],
}
_analyze_cache: dict[str, tuple[datetime, TrendAnalysis]] = {}
# 按北京时间（UTC+8）自然日判定「当天缓存」
_CACHE_TZ = timezone(timedelta(hours=8))


def _cache_day(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_CACHE_TZ).date()


def _is_same_day_cache(fetched_at: datetime | None) -> bool:
    if fetched_at is None:
        return False
    return _cache_day(fetched_at) == _cache_day(_now())


def _analyze_cache_key(payload: TrendAnalysisRequest) -> str:
    raw = "|".join(
        [
            payload.platform.strip(),
            payload.title.strip(),
            payload.source.strip(),
        ]
    )
    return hashlib.sha1(raw.encode()).hexdigest()

_WECHAT_SOURCE_BOOST: dict[str, float] = {
    "wechat_hot": 28,
    "wechat_search": 24,
    "bilibili_hot": 10,
    "weibo_hot": 6,
    "douyin_hot": 5,
    "bilibili_popular": 4,
    "douyin_popular": 2,
    "xiaohongshu_hot": 0,
    "fallback": 8,
}

_WECHAT_POSITIVE = (
    "怎么", "如何", "为什么", "哪些", "哪些", "是否", "能不能", "该不该",
    "老人", "孩子", "家庭", "健康", "职场", "消费", "生活", "农村", "城市",
    "判断", "识别", "避免", "误区", "真相", "方法", "步骤", "信号",
)

_WECHAT_NEGATIVE_RE = re.compile(
    r"官宣|恋情|离婚|出轨|吃瓜|爆料|坠机|地震|爆炸|遇难|去世|逝世|封杀|"
    r"夺冠|晋级|决赛|比分|世界杯|NBA|CBA|欧冠|转会|官宣|应援|打榜|"
    r"抽奖|优惠券|限时|秒杀|带货|直播间",
)

_QUESTION_RE = re.compile(r"[?？]|怎么|如何|为什么|哪些|是否|该不该|能不能")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _heat_from_rank(rank: int, total: int) -> float:
    if total <= 1:
        return 100.0
    return round(100 - (rank - 1) * (85 / max(total - 1, 1)), 1)


def _trend_id(source: str, title: str) -> str:
    digest = hashlib.sha1(f"{source}:{title}".encode()).hexdigest()[:12]
    return f"{source}-{digest}"


def _parse_metric_heat(metric: str, rank: int, total: int) -> tuple[float, str]:
    heat = _heat_from_rank(rank, total)
    metric = metric.strip()
    if not metric:
        return heat, ""
    digits = re.sub(r"[^\d.]", "", metric.replace("万", ""))
    try:
        value = float(digits) if digits else 0
        if "万" in metric:
            value *= 10_000
        if value >= 1_000_000:
            heat = min(100.0, heat + 12)
        elif value >= 100_000:
            heat = min(100.0, heat + 8)
        elif value >= 10_000:
            heat = min(100.0, heat + 4)
    except ValueError:
        pass
    return round(heat, 1), metric or ""


class TrendsService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.llm = LLMClient(self.settings)

    def get_board(self, *, force_refresh: bool = False) -> TrendsBoardResponse:
        fetched_at = _cache.get("fetched_at")
        cache_hit = (
            not force_refresh
            and _is_same_day_cache(fetched_at)
            and _cache.get("items")
        )
        if cache_hit:
            return TrendsBoardResponse(
                items=_cache["items"],
                fetched_at=fetched_at,
                sources=_cache.get("sources", []),
                cache_hit=True,
                wechat_picks=_cache.get("wechat_picks") or [],
            )

        if force_refresh:
            _cache["tophub_html"] = None
            _analyze_cache.clear()

        items: list[TrendItem] = []
        sources: list[str] = []
        fetchers: list[tuple[str, Any]] = [
            ("bilibili_hot", self._fetch_bilibili_hotwords),
            ("bilibili_popular", self._fetch_bilibili_popular),
            ("douyin_hot", self._fetch_douyin_hot),
            ("douyin_popular", self._fetch_douyin_popular),
            ("wechat_hot", self._fetch_wechat_hot),
            ("wechat_search", self._fetch_wechat_search),
            ("weibo_hot", self._fetch_weibo_hot),
            ("xiaohongshu_hot", self._fetch_xiaohongshu_hot),
        ]
        with ThreadPoolExecutor(max_workers=6) as pool:
            future_map = {pool.submit(fetcher): source_key for source_key, fetcher in fetchers}
            for future in as_completed(future_map):
                source_key = future_map[future]
                try:
                    batch = future.result()
                    if batch:
                        items.extend(batch)
                        sources.append(source_key)
                except Exception as exc:
                    logger.warning("%s fetch failed: %s", source_key, exc)

        if not items:
            items = self._fallback_items()
            sources = ["fallback"]

        items.sort(key=lambda item: item.heat, reverse=True)
        fetched_at = _now()
        _cache["items"] = items
        _cache["fetched_at"] = fetched_at
        _cache["sources"] = sources

        return TrendsBoardResponse(
            items=items,
            fetched_at=fetched_at,
            sources=sources,
            cache_hit=False,
        )

    async def get_board_with_picks(self, *, force_refresh: bool = False) -> TrendsBoardResponse:
        board = self.get_board(force_refresh=force_refresh)
        if board.cache_hit and _cache.get("wechat_picks") and not force_refresh:
            board.wechat_picks = _cache["wechat_picks"]
            return board

        picks = await self.recommend_wechat(board.items)
        _cache["wechat_picks"] = picks
        board.wechat_picks = picks
        return board

    def _normalize_title_key(self, title: str) -> str:
        return re.sub(r"\s+", "", title.lower())

    def _score_wechat_fit(self, item: TrendItem) -> float:
        title = item.title.strip()
        if not title or len(title) < 4:
            return -100.0
        if _WECHAT_NEGATIVE_RE.search(title):
            return -50.0

        score = float(item.heat) * 0.45
        score += _WECHAT_SOURCE_BOOST.get(item.source, 0)

        if _QUESTION_RE.search(title):
            score += 18
        for word in _WECHAT_POSITIVE:
            if word in title:
                score += 3

        if item.source == "wechat_hot" and "mp.weixin.qq.com" in item.url:
            score += 8
        if item.source == "wechat_search":
            score += 6
        if len(title) > 48:
            score -= 4
        if item.rank and item.rank <= 5:
            score += 4

        return round(score, 1)

    def _suggest_article_title(self, title: str) -> str:
        title = title.strip()
        if _QUESTION_RE.search(title) and len(title) <= 64:
            return title
        core = title[:18].rstrip("：:，, ")
        candidates = [
            f"{core}：普通人最先该知道的 3 件事",
            f"关于{core}，为什么越焦虑越容易做错决定？",
            f"{core}，很多家庭都忽略了这一步",
        ]
        for candidate in candidates:
            if len(candidate) <= 64:
                return candidate
        return candidates[0][:64]

    def _suggest_angle(self, item: TrendItem) -> str:
        if item.source == "wechat_hot":
            return "公众号热文已验证阅读需求，可改写成搜索型标题，单篇只讲一个可执行问题。"
        if item.source == "wechat_search":
            return "用户正在主动搜索，适合直接用问题型标题写干货长文。"
        if item.source.startswith("weibo"):
            return "公共话题有讨论量，建议从具体生活场景切入，避免纯转述新闻。"
        if item.source.startswith("bilibili"):
            return "可提取视频中的核心疑问，改写成手机阅读友好的分步说明。"
        if item.source.startswith("douyin"):
            return "短视频热点可改写成「开头抛痛点 + 3 个判断点」的公众号结构。"
        return "把热点改写成你的读者会搜索的具体问题，避免震惊体。"

    def _rule_wechat_picks(self, items: list[TrendItem], *, limit: int = 10) -> list[WechatInspirationPick]:
        seen: set[str] = set()
        scored: list[tuple[float, TrendItem]] = []
        for item in items:
            fit = self._score_wechat_fit(item)
            if fit < 0:
                continue
            key = self._normalize_title_key(item.title)
            if key in seen:
                continue
            seen.add(key)
            scored.append((fit, item))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        picks: list[WechatInspirationPick] = []
        for fit, item in scored[:limit]:
            picks.append(
                WechatInspirationPick(
                    trend_id=item.id,
                    title=item.title,
                    source=item.source,
                    source_label=item.source_label,
                    heat=item.heat,
                    url=item.url,
                    article_title=self._suggest_article_title(item.title),
                    angle=self._suggest_angle(item),
                    score=fit,
                )
            )
        return picks

    async def recommend_wechat(
        self,
        items: list[TrendItem],
        *,
        limit: int = 10,
    ) -> list[WechatInspirationPick]:
        rule_picks = self._rule_wechat_picks(items, limit=limit)
        if not rule_picks or not self.llm.status().configured:
            return rule_picks

        candidates = self._rule_wechat_picks(items, limit=25)
        if len(candidates) <= limit:
            return rule_picks

        candidate_block = "\n".join(
            f"- id={pick.trend_id} | 来源={pick.source_label} | 标题={pick.title} | 热度={pick.heat}"
            for pick in candidates
        )
        system = (
            "你是公众号冷启动选题顾问。从候选热点中选出最适合个人公众号（生活观察/干货型）"
            "写作的条目。输出 JSON："
            '{"picks":[{"trend_id":"","article_title":"","angle":""}]}'
        )
        user = (
            f"请从以下 {len(candidates)} 条热点中选出最适合写公众号的 {limit} 条。\n\n"
            f"{candidate_block}\n\n"
            "筛选标准：\n"
            "1. 优先搜索意图强、能写成单问题长文的话题\n"
            "2. 标题改为搜索型（人群+痛点+结果 / 问题+解决方案），不超过 64 字\n"
            "3. 避开明星八卦、灾难事故、纯赛事比分、带货促销\n"
            "4. 兼顾热度与可写性，不要全选同一来源\n"
            "5. angle 用一句话说明新号怎么切入\n"
            "只返回 JSON，picks 数组长度必须为 10（不足时从候选补齐）。"
        )
        try:
            raw = await self.llm.complete(system, user, json_mode=True, temperature=0.4)
            data = parse_json_from_text(raw)
            llm_rows = data.get("picks") or []
        except Exception as exc:
            logger.warning("wechat recommend llm failed: %s", exc)
            return rule_picks

        by_id = {pick.trend_id: pick for pick in candidates}
        picks: list[WechatInspirationPick] = []
        used: set[str] = set()
        for row in llm_rows:
            trend_id = str(row.get("trend_id") or "").strip()
            base = by_id.get(trend_id)
            if not base or trend_id in used:
                continue
            used.add(trend_id)
            article_title = str(row.get("article_title") or base.article_title).strip()
            if len(article_title) > 64:
                article_title = article_title[:64]
            picks.append(
                WechatInspirationPick(
                    trend_id=base.trend_id,
                    title=base.title,
                    source=base.source,
                    source_label=base.source_label,
                    heat=base.heat,
                    url=base.url,
                    article_title=article_title or base.article_title,
                    angle=str(row.get("angle") or base.angle).strip() or base.angle,
                    score=base.score,
                )
            )
            if len(picks) >= limit:
                break

        for pick in rule_picks:
            if len(picks) >= limit:
                break
            if pick.trend_id in used:
                continue
            picks.append(pick)
        return picks[:limit]

    def _append_related_safe(
        self,
        items: list[TrendRelatedItem],
        fetcher: Any,
        *,
        limit: int,
        label: str,
    ) -> None:
        if limit <= 0:
            return
        try:
            items.extend(fetcher()[:limit])
        except Exception as exc:
            logger.warning("Related fetch %s failed: %s", label, exc)

    def fetch_related(self, keyword: str, *, platform: str = "", limit: int = 6) -> list[TrendRelatedItem]:
        keyword = keyword.strip()
        if not keyword:
            return []

        items: list[TrendRelatedItem] = []
        platform = platform or ""

        if platform.startswith("douyin"):
            self._append_related_safe(
                items,
                lambda: self._search_douyin_related(keyword, limit=min(3, limit)),
                limit=min(3, limit),
                label="douyin",
            )
        if platform.startswith("wechat"):
            self._append_related_safe(
                items,
                lambda: self._search_wechat_related(keyword, limit=min(3, limit)),
                limit=min(3, limit),
                label="wechat",
            )
        if platform.startswith("weibo") or platform.startswith("xiaohongshu"):
            self._append_related_safe(
                items,
                lambda: self._search_weibo_related(keyword, limit=min(3, limit)),
                limit=min(3, limit),
                label="weibo",
            )

        remaining = limit - len(items)
        if remaining > 0:
            self._append_related_safe(
                items,
                lambda: self._search_bilibili(keyword, limit=remaining),
                limit=remaining,
                label="bilibili",
            )

        deduped: list[TrendRelatedItem] = []
        seen: set[str] = set()
        for item in items:
            key = item.title.strip()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= limit:
                break
        return deduped

    async def analyze(self, payload: TrendAnalysisRequest) -> TrendAnalysis:
        title = payload.title.strip()
        if not title:
            raise ValueError("标题不能为空")

        cache_key = _analyze_cache_key(payload)
        cached = _analyze_cache.get(cache_key)
        if cached and _is_same_day_cache(cached[0]):
            return cached[1].model_copy(deep=True)

        related = self.fetch_related(title, platform=payload.platform, limit=4)
        related_block = "\n".join(
            f"- {item.title} ({item.metrics or item.source})" for item in related
        ) or "- 暂无关联内容"

        if not self.llm.status().configured:
            result = self._mock_analysis(title, payload.source, related, payload.platform)
            _analyze_cache[cache_key] = (_now(), result)
            return result

        platform_hint = payload.platform or payload.source or "未知"
        system = (
            "你是中文自媒体冷启动顾问，帮助个人创作者判断热点是否值得跟、怎么跟。"
            "输出 JSON："
            '{"why_hot":"","account_angle":"","topic_ideas":["","",""],'
            '"platform_tips":{"wechat":"","xiaohongshu":"","douyin":""},"caution":""}'
        )
        user = (
            f"热点标题: {title}\n"
            f"来源平台: {platform_hint}\n"
            f"来源说明: {payload.source or '无'}\n"
            f"摘要: {payload.summary or '无'}\n\n"
            f"关联内容:\n{related_block}\n\n"
            "请从「新号如何更快起量」角度分析：为什么有人讨论、适合什么观察/干货角度、"
            "给出 3 个可写选题（搜索型标题）、各平台怎么发。"
            "语气务实，不要震惊体，不要建议蹭无关灾难/明星八卦。"
        )
        try:
            raw = await self.llm.complete(system, user, json_mode=True, temperature=0.5)
            try:
                data = parse_json_from_text(raw)
            except ValueError as exc:
                logger.warning("Trend analyze JSON parse failed: %s", exc)
                result = self._mock_analysis(title, payload.source, related, payload.platform)
                result.caution = "AI 返回格式异常，已改用模板分析。可稍后重试。"
                _analyze_cache[cache_key] = (_now(), result)
                return result
        except Exception as exc:
            logger.warning("Trend analyze LLM failed: %s", exc)
            result = self._mock_analysis(title, payload.source, related, payload.platform)
            result.caution = f"AI 分析暂不可用，已返回模板建议。（{type(exc).__name__}）"
            _analyze_cache[cache_key] = (_now(), result)
            return result

        ideas = data.get("topic_ideas") or []
        tips = data.get("platform_tips") or {}
        result = TrendAnalysis(
            why_hot=str(data.get("why_hot") or ""),
            account_angle=str(data.get("account_angle") or ""),
            topic_ideas=[str(x) for x in ideas if x][:5],
            platform_tips={
                "wechat": str(tips.get("wechat") or ""),
                "xiaohongshu": str(tips.get("xiaohongshu") or ""),
                "douyin": str(tips.get("douyin") or ""),
            },
            caution=str(data.get("caution") or ""),
            related=related,
        )
        _analyze_cache[cache_key] = (_now(), result)
        return result

    def _http_client(self) -> httpx.Client:
        return httpx.Client(timeout=15.0, headers=BROWSER_HEADERS, follow_redirects=True)

    def _fetch_tophub_html(self) -> str:
        cached = _cache.get("tophub_html")
        if cached:
            return cached
        with self._http_client() as client:
            resp = client.get(TOPHUB_HOME)
            resp.raise_for_status()
            html = resp.text
        _cache["tophub_html"] = html
        return html

    def _parse_tophub_board(
        self,
        node_href: str,
        *,
        url_must_contain: str | None = None,
    ) -> list[dict[str, str]]:
        html = self._fetch_tophub_html()
        blocks = html.split('<div class="cc-cd"')
        target: str | None = None
        for block in blocks:
            if f'hashid="{node_href}"' in block:
                target = block
                break
        if not target:
            return []

        rows: list[dict[str, str]] = []
        for match in TOPHUB_ITEM_RE.finditer(target):
            url, rank, title, metric = match.groups()
            title = _strip_html(title)
            if not title:
                continue
            if url_must_contain and url_must_contain not in url:
                continue
            if "taobao.com" in url or "remai.today" in url or "apps.apple.com" in url:
                continue
            rows.append(
                {
                    "url": url,
                    "rank": rank,
                    "title": title,
                    "metric": _strip_html(metric),
                }
            )
        return rows

    def _fetch_bilibili_hotwords(self) -> list[TrendItem]:
        with self._http_client() as client:
            resp = client.get(
                "https://s.search.bilibili.com/main/hotword?limit=20",
                headers=BILI_REFERER,
            )
            resp.raise_for_status()
            payload = resp.json()
        if payload.get("code") != 0:
            raise RuntimeError(payload.get("message") or "bilibili hotword error")

        rows = payload.get("list") or []
        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = _strip_html(str(row.get("show_name") or row.get("keyword") or ""))
            if not title:
                continue
            heat = _heat_from_rank(index, len(rows))
            items.append(
                TrendItem(
                    id=_trend_id("bilibili_hot", title),
                    title=title,
                    source="bilibili_hot",
                    source_label="B站热搜",
                    rank=index,
                    heat=round(heat, 1),
                    heat_label="热搜词",
                    url=f"https://search.bilibili.com/all?keyword={quote(title)}",
                    summary="B站用户正在主动搜索的话题。",
                )
            )
        return items

    def _fetch_bilibili_popular(self) -> list[TrendItem]:
        with self._http_client() as client:
            resp = client.get(
                "https://api.bilibili.com/x/web-interface/popular",
                params={"ps": 20, "pn": 1},
                headers=BILI_REFERER,
            )
            resp.raise_for_status()
            payload = resp.json()
        if payload.get("code") != 0:
            raise RuntimeError(payload.get("message") or "bilibili popular error")

        rows = (payload.get("data") or {}).get("list") or []
        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = _strip_html(str(row.get("title") or ""))
            if not title:
                continue
            stat = row.get("stat") or {}
            play = int(stat.get("view") or row.get("play") or 0)
            bvid = row.get("bvid") or ""
            url = f"https://www.bilibili.com/video/{bvid}" if bvid else ""
            desc = _strip_html(str(row.get("desc") or ""))[:120]
            heat = _heat_from_rank(index, len(rows))
            if play >= 1_000_000:
                heat = min(100.0, heat + 10)
            play_label = f"{play // 10000}万播放" if play >= 10_000 else f"{play}播放"
            items.append(
                TrendItem(
                    id=_trend_id("bilibili_popular", title),
                    title=title,
                    source="bilibili_popular",
                    source_label="B站热门",
                    rank=index,
                    heat=round(heat, 1),
                    heat_label=play_label,
                    url=url,
                    summary=desc or "B站全站热门视频。",
                )
            )
        return items

    def _fetch_douyin_hot(self) -> list[TrendItem]:
        with self._http_client() as client:
            resp = client.get(
                "https://www.douyin.com/aweme/v1/web/hot/search/list/",
                params={
                    "device_platform": "webapp",
                    "aid": "6383",
                    "channel": "channel_pc_web",
                    "detail_list": "1",
                },
                headers=DOUYIN_REFERER,
            )
            resp.raise_for_status()
            payload = resp.json()
        rows = (payload.get("data") or {}).get("word_list") or payload.get("word_list") or []
        if not rows:
            with self._http_client() as client:
                resp = client.get(
                    "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/",
                    headers=DOUYIN_REFERER,
                )
                resp.raise_for_status()
                payload = resp.json()
            rows = payload.get("word_list") or []

        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = _strip_html(str(row.get("word") or row.get("word_type") or ""))
            if not title:
                continue
            hot_value = int(row.get("hot_value") or 0)
            video_count = int(row.get("video_count") or 0)
            heat = _heat_from_rank(index, len(rows))
            if hot_value >= 10_000_000:
                heat = min(100.0, heat + 10)
            heat_label = f"{hot_value // 10000}万热度" if hot_value >= 10_000 else "热搜词"
            items.append(
                TrendItem(
                    id=_trend_id("douyin_hot", title),
                    title=title,
                    source="douyin_hot",
                    source_label="抖音热搜",
                    rank=index,
                    heat=round(heat, 1),
                    heat_label=heat_label,
                    url=f"https://www.douyin.com/search/{quote(title)}",
                    summary=(
                        f"抖音站内热搜词，相关视频约 {video_count} 条。"
                        if video_count
                        else "抖音站内热搜词，适合短视频/口播选题。"
                    ),
                )
            )
        return items

    def _fetch_douyin_popular(self) -> list[TrendItem]:
        rows = self._parse_tophub_board("DpQvNABoNE", url_must_contain="douyin.com/video")
        items: list[TrendItem] = []
        for index, row in enumerate(rows[:15], start=1):
            title = row["title"]
            heat, heat_label = _parse_metric_heat(row["metric"], index, len(rows))
            items.append(
                TrendItem(
                    id=_trend_id("douyin_popular", title),
                    title=title,
                    source="douyin_popular",
                    source_label="抖音热门视频",
                    rank=index,
                    heat=heat,
                    heat_label=heat_label or "高播放",
                    url=row["url"],
                    summary="抖音全站高播放视频，代表当前流量内容形态。",
                )
            )
        return items

    def _fetch_wechat_hot(self) -> list[TrendItem]:
        rows = self._parse_tophub_board("WnBe01o371", url_must_contain="mp.weixin.qq.com")
        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = row["title"]
            heat, heat_label = _parse_metric_heat(row["metric"], index, len(rows))
            items.append(
                TrendItem(
                    id=_trend_id("wechat_hot", title),
                    title=title,
                    source="wechat_hot",
                    source_label="公众号热文",
                    rank=index,
                    heat=heat,
                    heat_label=heat_label or "热文",
                    url=row["url"],
                    summary="微信公众号 24 小时高阅读热文，可参考选题与标题结构。",
                )
            )
        return items

    def _fetch_wechat_search(self) -> list[TrendItem]:
        with self._http_client() as client:
            resp = client.get(
                "https://top.baidu.com/api/board?platform=wise&tab=realtime",
            )
            resp.raise_for_status()
            payload = resp.json()
        cards = (payload.get("data") or {}).get("cards") or []
        rows: list[dict[str, Any]] = []
        for card in cards:
            if card.get("component") != "tabTextList":
                continue
            for group in card.get("content") or []:
                for item in group.get("content") or []:
                    word = _strip_html(str(item.get("word") or ""))
                    if word:
                        rows.append(item)

        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = _strip_html(str(row.get("word") or ""))
            if not title:
                continue
            url = str(row.get("url") or f"https://www.baidu.com/s?wd={quote(title)}")
            heat = _heat_from_rank(index, len(rows))
            if row.get("isTop"):
                heat = min(100.0, heat + 5)
            items.append(
                TrendItem(
                    id=_trend_id("wechat_search", title),
                    title=title,
                    source="wechat_search",
                    source_label="搜一搜热词",
                    rank=index,
                    heat=round(heat, 1),
                    heat_label="百度热搜",
                    url=url,
                    summary="用户正在搜索的问题，适合公众号搜索型标题与冷启动内容。",
                )
            )
        return items

    def _fetch_weibo_rows(self) -> list[dict[str, Any]]:
        with self._http_client() as client:
            resp = client.get(
                "https://weibo.com/ajax/side/hotSearch",
                headers=WEIBO_REFERER,
            )
            resp.raise_for_status()
            payload = resp.json()
        return (payload.get("data") or {}).get("realtime") or []

    def _fetch_weibo_hot(self) -> list[TrendItem]:
        rows = self._fetch_weibo_rows()
        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = _strip_html(str(row.get("word") or row.get("note") or ""))
            if not title:
                continue
            num = int(row.get("num") or 0)
            heat = _heat_from_rank(index, len(rows))
            if num >= 1_000_000:
                heat = min(100.0, heat + 10)
            heat_label = f"{num // 10000}万讨论" if num >= 10_000 else "热议"
            items.append(
                TrendItem(
                    id=_trend_id("weibo_hot", title),
                    title=title,
                    source="weibo_hot",
                    source_label="微博热搜",
                    rank=index,
                    heat=round(heat, 1),
                    heat_label=heat_label,
                    url=f"https://s.weibo.com/weibo?q={quote(title)}",
                    summary="微博实时热搜，适合判断公共话题热度与舆论方向。",
                )
            )
        return items

    def _fetch_xiaohongshu_hot(self) -> list[TrendItem]:
        rows = self._fetch_weibo_rows()
        items: list[TrendItem] = []
        for index, row in enumerate(rows[:20], start=1):
            title = _strip_html(str(row.get("word") or row.get("note") or ""))
            if not title:
                continue
            num = int(row.get("num") or 0)
            heat = _heat_from_rank(index, len(rows))
            if num >= 1_000_000:
                heat = min(100.0, heat + 10)
            heat_label = f"{num // 10000}万讨论" if num >= 10_000 else "热议"
            items.append(
                TrendItem(
                    id=_trend_id("xiaohongshu_hot", title),
                    title=title,
                    source="xiaohongshu_hot",
                    source_label="小红书参考·微博热搜",
                    rank=index,
                    heat=round(heat, 1),
                    heat_label=heat_label,
                    url=f"https://s.weibo.com/weibo?q={quote(title)}",
                    summary=(
                        "小红书未开放公开热榜；此处为微博同期热搜，"
                        "两平台热点高度重叠，可作小红书选题参考。"
                    ),
                )
            )
        return items

    def _search_bilibili(self, keyword: str, *, limit: int) -> list[TrendRelatedItem]:
        with self._http_client() as client:
            resp = client.get(
                "https://api.bilibili.com/x/web-interface/search/type",
                params={"search_type": "video", "keyword": keyword, "page": 1},
                headers=BILI_REFERER,
            )
            resp.raise_for_status()
            try:
                payload = resp.json()
            except ValueError:
                return []
        if payload.get("code") != 0:
            return []

        results = (payload.get("data") or {}).get("result") or []
        items: list[TrendRelatedItem] = []
        for row in results[:limit]:
            if row.get("type") != "video":
                continue
            title = _strip_html(str(row.get("title") or ""))
            if not title:
                continue
            play = int(row.get("play") or 0)
            url = str(row.get("arcurl") or row.get("url") or "")
            desc = _strip_html(str(row.get("description") or ""))[:100]
            items.append(
                TrendRelatedItem(
                    title=title,
                    url=url,
                    source="B站",
                    summary=desc,
                    metrics=f"{play // 10000}万播放" if play >= 10_000 else f"{play}播放",
                )
            )
        return items

    def _search_douyin_related(self, keyword: str, *, limit: int) -> list[TrendRelatedItem]:
        rows = self._parse_tophub_board("DpQvNABoNE")
        matched: list[TrendRelatedItem] = []
        keyword_lower = keyword.lower()
        for row in rows:
            title = row["title"]
            if keyword_lower not in title.lower() and title.lower() not in keyword_lower:
                continue
            matched.append(
                TrendRelatedItem(
                    title=title,
                    url=row["url"],
                    source="抖音",
                    summary="",
                    metrics=row["metric"],
                )
            )
        if matched:
            return matched[:limit]
        return [
            TrendRelatedItem(
                title=f"在抖音搜索：{keyword}",
                url=f"https://www.douyin.com/search/{quote(keyword)}",
                source="抖音",
                summary="点击查看抖音站内相关视频。",
                metrics="",
            )
        ]

    def _search_wechat_related(self, keyword: str, *, limit: int) -> list[TrendRelatedItem]:
        rows = self._parse_tophub_board("WnBe01o371")
        matched: list[TrendRelatedItem] = []
        keyword_lower = keyword.lower()
        for row in rows:
            title = row["title"]
            if keyword_lower not in title.lower() and title.lower() not in keyword_lower:
                continue
            matched.append(
                TrendRelatedItem(
                    title=title,
                    url=row["url"],
                    source="公众号",
                    summary="",
                    metrics=row["metric"],
                )
            )
        if matched:
            return matched[:limit]
        return [
            TrendRelatedItem(
                title=f"在微信搜一搜：{keyword}",
                url=f"https://www.baidu.com/s?wd={quote(keyword)}",
                source="搜一搜",
                summary="公众号用户可能搜索的相关问题。",
                metrics="",
            )
        ]

    def _search_weibo_related(self, keyword: str, *, limit: int) -> list[TrendRelatedItem]:
        with self._http_client() as client:
            resp = client.get(
                "https://weibo.com/ajax/side/hotSearch",
                headers=WEIBO_REFERER,
            )
            resp.raise_for_status()
            payload = resp.json()
        rows = (payload.get("data") or {}).get("realtime") or []
        matched: list[TrendRelatedItem] = []
        keyword_lower = keyword.lower()
        for row in rows:
            title = _strip_html(str(row.get("word") or ""))
            if not title:
                continue
            if keyword_lower not in title.lower() and title.lower() not in keyword_lower:
                continue
            num = int(row.get("num") or 0)
            matched.append(
                TrendRelatedItem(
                    title=title,
                    url=f"https://s.weibo.com/weibo?q={quote(title)}",
                    source="微博",
                    summary="",
                    metrics=f"{num // 10000}万讨论" if num >= 10_000 else "",
                )
            )
        if matched:
            return matched[:limit]
        return [
            TrendRelatedItem(
                title=f"在小红书/微博搜索：{keyword}",
                url=f"https://s.weibo.com/weibo?q={quote(keyword)}",
                source="小红书参考",
                summary="查看社交平台相关讨论与笔记方向。",
                metrics="",
            )
        ]

    def _fallback_items(self) -> list[TrendItem]:
        samples = [
            ("农村老人总说没事，子女怎么判断该不该就医？", "wechat_search"),
            ("三无保健品包装像正规药？识别看这几个细节", "xiaohongshu_hot"),
            ("村里河水变味了，普通人能做什么？", "wechat_hot"),
            ("为什么年轻人开始反向消费？", "douyin_hot"),
            ("普通家庭最容易忽略的一个健康信号", "bilibili_popular"),
        ]
        labels = {
            "wechat_search": "搜一搜热词",
            "wechat_hot": "公众号热文",
            "weibo_hot": "微博热搜",
            "xiaohongshu_hot": "小红书参考·微博热搜",
            "douyin_hot": "抖音热搜",
            "bilibili_popular": "B站热门",
        }
        items: list[TrendItem] = []
        for index, (title, source) in enumerate(samples, start=1):
            src = source  # type: ignore[assignment]
            items.append(
                TrendItem(
                    id=_trend_id(source, title),
                    title=title,
                    source=src,  # type: ignore[arg-type]
                    source_label=labels.get(source, "示例"),
                    rank=index,
                    heat=_heat_from_rank(index, len(samples)),
                    heat_label="示例数据",
                    url="",
                    summary="实时热点暂不可用，以下为示例选题。可点击刷新重试。",
                )
            )
        return items

    def _mock_analysis(
        self,
        title: str,
        source: str,
        related: list[TrendRelatedItem],
        platform: str = "",
    ) -> TrendAnalysis:
        platform = platform or source
        tips = {
            "wechat": "写单问题长文，搜索型标题，结尾给可执行建议。",
            "xiaohongshu": "按内容拆成 1-6 张图，短内容可单图，每页一个判断点，口语化。",
            "douyin": "60-90 秒口播，开头 3 秒抛痛点问题。",
        }
        if platform.startswith("weibo"):
            tips["wechat"] = "微博热搜可改写成公众号观察文，注意增加具体场景与分寸感。"
        if platform.startswith("wechat"):
            tips["wechat"] = "优先用搜一搜热词改写为具体问题型标题，单篇只讲一个痛点。"
        if platform.startswith("douyin"):
            tips["douyin"] = "热搜词适合改成疑问句口播钩子，前 3 秒直接抛问题。"
        if platform.startswith("xiaohongshu"):
            tips["xiaohongshu"] = "把热搜改写成「人群+痛点+结果」笔记标题，封面一句话讲清价值。"

        return TrendAnalysis(
            why_hot=f"「{title}」在{source or platform or '平台'}上有讨论量，说明用户正在主动搜索或消费相关内容。",
            account_angle=(
                "新号不要硬蹭泛热点，建议从「具体场景 + 一个可执行问题」切入，"
                "把热点改写成你的垂直领域能回答的问题。"
            ),
            topic_ideas=[
                f"{title}：普通人最先该知道哪 3 件事？",
                f"关于{title[:12]}，很多家庭都忽略了这一步",
                f"{title}，为什么越焦虑越容易做错决定？",
            ],
            platform_tips=tips,
            caution="未配置 LLM 时返回模板分析；配置 API Key 后可获得更精准建议。",
            related=related,
        )
