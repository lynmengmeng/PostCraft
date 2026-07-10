from __future__ import annotations

import hashlib
import logging
import random
import re
from datetime import datetime, timezone
from typing import Any

from app.config import Settings, get_settings
from app.models.schemas import (
    AccountPositioning,
    ContentRatioGuide,
    DouyinInspirationPick,
    DouyinOpsBoardResponse,
    DouyinPlatformScript,
    SeriesEpisodeDetail,
    SeriesGuide,
    SeriesPhaseGuide,
    SeriesStudioResponse,
    WeeklyScheduleItem,
    XiaohongshuAdaptation,
)
from app.services.llm_client import LLMClient
from app.services.repository import parse_json_from_text

logger = logging.getLogger(__name__)

ExpressionType = str  # 共鸣型 | 故事型 | 方法型

# 三栏目选题库：pillar -> [(seed_topic, expression_type)]
_PILLAR_SEEDS: dict[str, list[tuple[str, ExpressionType]]] = {
    "成年人情绪观察": [
        ("情绪稳定，是不是一种表演", "共鸣型"),
        ("领导一句话，我能难受一整天", "故事型"),
        ("躺平不可耻，但躺不平才难受", "共鸣型"),
        ("为什么越长大越容易内耗", "共鸣型"),
        ("成年人的崩溃，为什么要藏起来", "故事型"),
        ("我好像很久没有真正开心过了", "共鸣型"),
        ("深夜睡不着的时候，你在想什么", "共鸣型"),
        ("朋友圈都是岁月静好，只有我知道多乱", "故事型"),
    ],
    "低耗生活实验": [
        ("一个人吃饭、一个人看电影，也挺好的", "故事型"),
        ("周末不社交，我反而恢复了能量", "故事型"),
        ("我开始不向所有人解释自己", "方法型"),
        ("朋友越来越少之后，我轻松了很多", "共鸣型"),
        ("周末只想躺着，算不算浪费人生", "共鸣型"),
        ("给自己安排一个没有意义的下午", "故事型"),
        ("原来最奢侈的，是好好吃一顿早饭", "共鸣型"),
    ],
    "普通女生的清醒时刻": [
        ("为什么父母明明有钱，却总说没有钱", "故事型"),
        ("楼下小摊关了，好像少了一个老朋友", "故事型"),
        ("我以前害怕朋友离开，现在不害怕了", "方法型"),
        ("长大后才知道，很多关系都有期限", "共鸣型"),
        ("父母总说「为你好」，但我真的很累", "共鸣型"),
        ("催婚催育，到底在催什么", "共鸣型"),
        ("城市很大，知心人却很少", "共鸣型"),
    ],
}

_PILLAR_RATIO = {
    "成年人情绪观察": 5,
    "低耗生活实验": 3,
    "普通女生的清醒时刻": 2,
}

# 30 天系列：第 1-10 期为启动期（策略文档「前10期可直接使用」），第 11-30 期为延续期
_SERIES_EPISODES = [
    # 第 1-10 期 · 启动期
    "我开始一个人吃饭",
    "不再因为领导一句话否定自己",
    "周末允许自己什么都不做",
    "不强行维持已经淡掉的关系",
    "停止向父母证明自己",
    "情绪不稳定时不急着责怪自己",
    "不再解释自己的每个决定",
    "接受朋友阶段性离开",
    "放弃成为所有人眼里的好人",
    "给自己安排一个没有意义的下午",
    # 第 11-20 期 · 巩固期
    "学会对无效社交说「这次不去了」",
    "我不再把「忙」当成自己的价值",
    "开始记录三件让我舒服的小事",
    "接受自己不是每天都积极向上",
    "减少刷手机后的空虚感",
    "给自己设定一个「情绪截止时间」",
    "不再把朋友圈当成人生成绩单",
    "练习在人群中保持自己的节奏",
    "发现「慢一点」反而更清醒",
    "第一次觉得周末真正属于自己",
    # 第 21-30 期 · 收尾期
    "我不再害怕被人误解",
    "学会了说「我需要独处一下」",
    "停止和过去的自己比较",
    "接受有些关系就是会淡掉",
    "开始为自己的身体留一点时间",
    "不再逼自己参加每一场聚会",
    "发现「普通」也是一种自由",
    "给自己写了一封不太完美的信",
    "回头看这一个月，我没有变成另一个人",
    "内耗还在，但我不再和它打仗了",
]

_SERIES_EPISODE_META: list[tuple[str, str]] = [
    # 1-10 启动期
    ("低耗生活实验", "故事型"),
    ("成年人情绪观察", "故事型"),
    ("低耗生活实验", "共鸣型"),
    ("普通女生的清醒时刻", "共鸣型"),
    ("普通女生的清醒时刻", "故事型"),
    ("成年人情绪观察", "共鸣型"),
    ("低耗生活实验", "方法型"),
    ("普通女生的清醒时刻", "共鸣型"),
    ("成年人情绪观察", "共鸣型"),
    ("低耗生活实验", "故事型"),
    # 11-20 巩固期
    ("低耗生活实验", "方法型"),
    ("成年人情绪观察", "共鸣型"),
    ("低耗生活实验", "故事型"),
    ("成年人情绪观察", "共鸣型"),
    ("低耗生活实验", "共鸣型"),
    ("成年人情绪观察", "方法型"),
    ("成年人情绪观察", "故事型"),
    ("低耗生活实验", "共鸣型"),
    ("低耗生活实验", "共鸣型"),
    ("低耗生活实验", "故事型"),
    # 21-30 收尾期
    ("普通女生的清醒时刻", "共鸣型"),
    ("低耗生活实验", "方法型"),
    ("成年人情绪观察", "共鸣型"),
    ("普通女生的清醒时刻", "共鸣型"),
    ("低耗生活实验", "故事型"),
    ("低耗生活实验", "方法型"),
    ("普通女生的清醒时刻", "共鸣型"),
    ("成年人情绪观察", "故事型"),
    ("成年人情绪观察", "共鸣型"),
    ("普通女生的清醒时刻", "共鸣型"),
]

SERIES_PHASES: list[tuple[str, int, int, str]] = [
    ("启动期", 1, 10, "用已有生活观察快速开更，建立账号认知"),
    ("巩固期", 11, 20, "把低耗习惯落到日常动作里"),
    ("收尾期", 21, 30, "回顾变化，形成系列闭环"),
]

SERIES_PLANNED_TOTAL = 30

SERIES_ID = "stop-internal-friction"
SERIES_STUDIO_SETTINGS_KEY = "douyin_series_studio"

_WEEKLY_SCHEDULE = [
    WeeklyScheduleItem(
        weekday="周一",
        pillar="成年人情绪观察",
        topic="领导一句话，我能难受一整天",
        expression_type="故事型",
    ),
    WeeklyScheduleItem(
        weekday="周二",
        pillar="低耗生活实验",
        topic="一个人吃饭之后，我轻松了",
        expression_type="故事型",
    ),
    WeeklyScheduleItem(
        weekday="周三",
        pillar="成年人情绪观察",
        topic="停止反复回想的3个办法",
        expression_type="方法型",
    ),
    WeeklyScheduleItem(
        weekday="周五",
        pillar="普通女生的清醒时刻",
        topic="朋友越来越少，是坏事吗",
        expression_type="共鸣型",
    ),
    WeeklyScheduleItem(
        weekday="周日",
        pillar="普通女生的清醒时刻",
        topic="楼下小店关门以后",
        expression_type="故事型",
    ),
]

_XHS_PILLAR_TAGS: dict[str, list[str]] = {
    "成年人情绪观察": ["情绪管理", "职场内耗", "停止内耗", "成年人"],
    "低耗生活实验": ["低耗生活", "独处", "松弛感", "一人食"],
    "普通女生的清醒时刻": ["人际关系", "原生家庭", "生活感悟", "清醒时刻"],
}

_XHS_EXPR_TAGS: dict[str, list[str]] = {
    "共鸣型": ["共鸣", "女性成长"],
    "故事型": ["真实故事", "女性成长"],
    "方法型": ["干货分享", "自救指南", "女性成长"],
}

_XHS_TOPIC_TAGS: list[tuple[str, list[str]]] = [
    (r"领导|职场|上班|打工", ["打工人", "职场生存"]),
    (r"父母|家庭|催婚", ["原生家庭", "家庭关系"]),
    (r"朋友|关系|社交", ["人际边界", "社交"]),
    (r"吃饭|独处|周末|躺", ["独处日记", "低耗生活"]),
    (r"情绪|内耗|崩溃|稳定", ["情绪价值", "精神内耗"]),
]

_XHS_TITLE_MAP: dict[str, str] = {
    "一个人吃饭、一个人看电影，也挺好的": "30岁以后，我终于不害怕一个人吃饭了",
    "为什么父母明明有钱，却总说没有钱": "父母总说「家里没钱」，给我留下了什么影响",
    "领导一句话，我能难受一整天": "被领导说了一句后，我内耗了一整天",
    "躺平不可耻，但躺不平才难受": "真正让人疲惫的，不是躺平，而是休息时的愧疚",
    "楼下小摊关了，好像少了一个老朋友": "常去的小店突然关门，我第一次理解成年人",
    "情绪稳定，是不是一种表演": "那些看起来情绪稳定的人，可能只是习惯了忍耐",
}

_douyin_cache: dict[str, Any] = {
    "board": None,
    "fetched_at": None,
    "refresh_seed": 0,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_same_day_cache(fetched_at: datetime | None) -> bool:
    if fetched_at is None:
        return False
    from app.services.trends_service import _cache_day

    return _cache_day(fetched_at) == _cache_day(_now())


def _pick_id(seed: str, pillar: str) -> str:
    digest = hashlib.sha1(f"{pillar}:{seed}".encode()).hexdigest()[:12]
    return f"low_energy-{digest}"


def _select_seeds(*, refresh_seed: int = 0) -> list[tuple[str, str, ExpressionType, int | None]]:
    """按栏目比例选取种子，并尽量匹配系列集数。"""
    day_key = datetime.now().strftime("%Y%m%d")
    rng = random.Random(f"{day_key}-{refresh_seed}")
    selected: list[tuple[str, str, ExpressionType, int | None]] = []
    series_used: set[int] = set()

    for pillar, count in _PILLAR_RATIO.items():
        pool = list(_PILLAR_SEEDS.get(pillar, []))
        rng.shuffle(pool)
        taken = 0
        for seed, expr in pool:
            if taken >= count:
                break
            episode: int | None = None
            for idx, ep in enumerate(_SERIES_EPISODES, start=1):
                if idx in series_used:
                    continue
                if seed in ep or ep in seed or _topic_overlap(seed, ep):
                    episode = idx
                    series_used.add(idx)
                    break
            selected.append((pillar, seed, expr, episode))
            taken += 1

    rng.shuffle(selected)
    return selected


def _topic_overlap(a: str, b: str) -> bool:
    keys = ("吃饭", "领导", "周末", "朋友", "父母", "情绪", "解释", "好人", "下午", "关系")
    for key in keys:
        if key in a and key in b:
            return True
    return False


class DouyinOpsService:
    POSITIONING = AccountPositioning()
    CONTENT_RATIO = ContentRatioGuide()
    SERIES = SeriesGuide(
        name="普通女生停止内耗的30天",
        episodes=_SERIES_EPISODES,
        series_id=SERIES_ID,
    )
    WEEKLY = _WEEKLY_SCHEDULE

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.llm = LLMClient(self.settings)

    async def get_board(self, *, force_refresh: bool = False) -> DouyinOpsBoardResponse:
        fetched_at = _douyin_cache.get("fetched_at")
        cached_board = _douyin_cache.get("board")
        cache_hit = (
            not force_refresh
            and _is_same_day_cache(fetched_at)
            and cached_board is not None
        )

        if cache_hit:
            board = cached_board.model_copy(deep=True)
            board.cache_hit = True
            return board

        if force_refresh:
            _douyin_cache["refresh_seed"] = int(_douyin_cache.get("refresh_seed") or 0) + 1

        refresh_seed = int(_douyin_cache.get("refresh_seed") or 0)
        seeds = _select_seeds(refresh_seed=refresh_seed)
        picks = await self.generate_picks(seeds)

        board = DouyinOpsBoardResponse(
            picks=picks,
            positioning=self.POSITIONING,
            weekly_schedule=self.WEEKLY,
            content_ratio=self.CONTENT_RATIO,
            series=self.SERIES,
            fetched_at=_now(),
            sources=["账号定位策略", "三栏目选题库"],
            cache_hit=False,
        )

        _douyin_cache["board"] = board
        _douyin_cache["fetched_at"] = board.fetched_at
        return board

    def _build_douyin_script(self, seed: str, expr: ExpressionType) -> DouyinPlatformScript:
        if "一个人吃饭" in seed:
            return DouyinPlatformScript(
                opening="我以前最怕一个人吃饭，后来发现，一个人吃饭才是最轻松的。",
                scene="不用等别人选餐厅，不用担心突然冷场，也不用为了照顾别人的口味点自己不喜欢的菜。",
                reversal="独处不是没人陪，而是你终于不需要通过别人证明自己过得好。",
                question="你现在敢一个人去看电影吗？",
            )
        if "领导一句话" in seed:
            return DouyinPlatformScript(
                opening="早上开会，领导随口说了一句「最近效率有点低」。",
                scene="他可能下午就忘了，我却在脑子里反复播放了一整天。我假装低头记笔记，其实一直在想那句话。",
                reversal="后来我才明白，他的评价只是他那一刻的感受，不该定义我的全部。",
                question="你有没有因为别人的一句话，反复难受很久？",
            )
        if "情绪稳定" in seed:
            return DouyinPlatformScript(
                opening="那些看起来情绪稳定的人，可能只是习惯了忍耐。",
                scene="开会时笑着说没事，挂掉电话才觉得胸口发闷。不是没情绪，是学会了不给别人添麻烦。",
                reversal="情绪稳定不一定是强大，有时候只是没人让你可以放心崩溃。",
                question="你有过「明明很难受，却还在笑」的时刻吗？",
            )
        return DouyinPlatformScript(
            opening=f"关于「{seed[:18]}」，我以前总觉得只有我这样。",
            scene="上周在地铁上突然想到这件事，回家后忍不住翻了很久聊天记录。我知道没必要，但就是停不下来。",
            reversal="后来才发现，很多人也在经历同样的阶段，只是没人说出来。",
            question=f"你有没有过类似的感受？",
        )

    def _xhs_tags(self, seed: str, pillar: str, expr: ExpressionType) -> list[str]:
        tags: list[str] = []
        seen: set[str] = set()

        def add(items: list[str]) -> None:
            for item in items:
                key = item.strip()
                if key and key not in seen:
                    seen.add(key)
                    tags.append(key)

        add(_XHS_PILLAR_TAGS.get(pillar, []))
        add(_XHS_EXPR_TAGS.get(expr, ["女性成长"]))
        for pattern, topic_tags in _XHS_TOPIC_TAGS:
            if re.search(pattern, seed):
                add(topic_tags)
        return tags[:8]

    def _build_xhs(self, seed: str, pillar: str, expr: ExpressionType) -> XiaohongshuAdaptation:
        title = _XHS_TITLE_MAP.get(seed, f"关于{seed[:14]}，我终于想通了一件事")
        tags = self._xhs_tags(seed, pillar, expr)
        if "领导" in seed:
            return XiaohongshuAdaptation(
                title="被领导批评后，我不再反复内耗的3个方法",
                opening="早上开会，领导随口说了一句：「最近效率有点低。」他可能下午就忘了，我却在脑子里反复播放了一整天。",
                methods=[
                    "区分事实和自己的想象",
                    "只记录可以改进的具体问题",
                    "给情绪设置一个结束时间",
                    "不用领导的评价定义全部的自己",
                ],
                closing_question="你有没有因为别人的一句话，反复难受很久？",
                tags=tags or ["职场内耗", "情绪管理", "打工人", "停止内耗", "女性成长", "干货分享"],
            )
        methods = []
        if expr == "方法型":
            methods = [
                "先承认感受，不急着否定自己",
                "把反复回想的内容写下来，再判断哪些是事实",
                "给情绪设定一个「结束时间」",
            ]
        return XiaohongshuAdaptation(
            title=title,
            opening=f"有一段时间，我经常想到「{seed}」。",
            methods=methods,
            closing_question="你有没有类似的经历？评论区聊聊。",
            tags=tags,
        )

    def _assemble_copy(self, script: DouyinPlatformScript) -> str:
        parts = [
            script.opening,
            script.scene,
            script.reversal,
            script.question,
        ]
        return "\n\n".join(p for p in parts if p)

    def _rule_pick(
        self,
        pillar: str,
        seed: str,
        expr: ExpressionType,
        *,
        episode: int | None,
        index: int,
    ) -> DouyinInspirationPick:
        douyin = self._build_douyin_script(seed, expr)
        xhs = self._build_xhs(seed, pillar, expr)
        series_line = ""
        if episode:
            series_line = f"\n\n这是我《{self.SERIES.name}》的第 {episode} 天。"

        copy_text = self._assemble_copy(douyin) + series_line

        return DouyinInspirationPick(
            trend_id=_pick_id(seed, pillar),
            title=seed,
            source="fallback",
            source_label=pillar,
            pillar=pillar,
            expression_type=expr,
            series_name=self.SERIES.name if episode else "",
            series_episode=episode,
            hook=douyin.opening,
            copy_text=copy_text,
            script_outline=[
                f"前3秒：{douyin.opening}",
                f"中间场景：{douyin.scene}",
                f"观点反转：{douyin.reversal}",
                f"结尾互动：{douyin.question}",
            ],
            douyin=douyin,
            xiaohongshu=xhs,
            cover_prompt=(
                f"抖音竖版封面，女性低耗生活纪实摄影，温暖自然光，"
                f"独处/职场/日常场景，画面安静真实，呼应「{seed[:12]}」，无文字无水印"
            ),
            tags=[pillar[:4], expr.replace("型", ""), "女性成长"],
            score=75.0 + (index % 3),
        )

    def _rule_picks(
        self,
        seeds: list[tuple[str, str, ExpressionType, int | None]],
    ) -> list[DouyinInspirationPick]:
        return [
            self._rule_pick(pillar, seed, expr, episode=ep, index=i)
            for i, (pillar, seed, expr, ep) in enumerate(seeds)
        ]

    async def generate_picks(
        self,
        seeds: list[tuple[str, str, ExpressionType, int | None]],
    ) -> list[DouyinInspirationPick]:
        rule_picks = self._rule_picks(seeds)
        if not self.llm.status().configured:
            return rule_picks

        seed_block = "\n".join(
            f"- 栏目={pillar} | 选题={seed} | 表达={expr}"
            + (f" | 系列第{ep}期" if ep else "")
            for pillar, seed, expr, ep in seeds
        )

        system = (
            "你是「女性成长＋低耗生活＋情绪共鸣」账号的内容顾问。"
            "账号定位：记录普通女生如何降低内耗，重新建立自己的生活。"
            "目标用户：25-40岁，有工作压力、朋友减少、家庭催促、情绪内耗的女性。"
            "输出 JSON："
            '{"picks":[{"pillar":"","seed":"","expression_type":"","series_episode":null,'
            '"douyin":{"opening":"","scene":"","reversal":"","question":""},'
            '"xiaohongshu":{"title":"","opening":"","methods":[""],"closing_question":"","tags":[""]},'
            '"cover_prompt":"","tags":[""]}]}'
        )
        user = (
            f"请为以下 {len(seeds)} 个选题各生成一套抖音口播 + 小红书改编内容。\n\n"
            f"{seed_block}\n\n"
            "抖音要求（30-60秒口播，生活画面+配音）：\n"
            "1. opening 前3秒直接说冲突，不要「今天想聊聊」式开头\n"
            "2. scene 要有具体时间、具体动作、不完美真实感受\n"
            "3. reversal 给出观点反转，不说教\n"
            "4. question 结尾抛容易回答的问题\n\n"
            "小红书要求：\n"
            "1. title 用可收藏的问题型标题，如「被领导批评后，我不再反复内耗的3个方法」\n"
            "2. methods 方法型给3-4条清单，共鸣/故事型可留空数组\n"
            "3. tags 给5-8个小红书话题标签（不带#号），结合栏目、选题和表达类型，"
            "如：情绪管理、低耗生活、女性成长、职场内耗、独处日记\n"
            "4. 不要纯伤感，要有认知或方法价值\n\n"
            "通用：\n"
            "- 语气像真实女生说话，不要AI工整腔\n"
            "- expression_type 保持与种子一致\n"
            "- 有 series_episode 的 pick 在 douyin.reversal 后自然带上系列感\n"
            f"- picks 数组长度必须为 {len(seeds)}，顺序与种子一致\n"
            "只返回 JSON。"
        )
        try:
            raw = await self.llm.complete(system, user, json_mode=True, temperature=0.7)
            data = parse_json_from_text(raw)
            llm_rows = data.get("picks") or []
        except Exception as exc:
            logger.warning("douyin ops llm failed: %s", exc)
            return rule_picks

        picks: list[DouyinInspirationPick] = []
        for index, (pillar, seed, expr, episode) in enumerate(seeds):
            base = self._rule_pick(pillar, seed, expr, episode=episode, index=index)
            row = llm_rows[index] if index < len(llm_rows) else {}

            dy_raw = row.get("douyin") or {}
            douyin = DouyinPlatformScript(
                opening=str(dy_raw.get("opening") or base.douyin.opening).strip(),
                scene=str(dy_raw.get("scene") or base.douyin.scene).strip(),
                reversal=str(dy_raw.get("reversal") or base.douyin.reversal).strip(),
                question=str(dy_raw.get("question") or base.douyin.question).strip(),
                duration="30-60秒",
                visual_style="生活画面+配音",
            )

            xhs_raw = row.get("xiaohongshu") or {}
            methods_raw = xhs_raw.get("methods") or base.xiaohongshu.methods
            tags_raw = xhs_raw.get("tags") or base.xiaohongshu.tags
            xhs_tags = [str(t).strip().lstrip("#") for t in tags_raw if t][:8]
            xhs = XiaohongshuAdaptation(
                title=str(xhs_raw.get("title") or base.xiaohongshu.title).strip(),
                opening=str(xhs_raw.get("opening") or base.xiaohongshu.opening).strip(),
                methods=[str(m).strip() for m in methods_raw if m][:5],
                closing_question=str(
                    xhs_raw.get("closing_question") or base.xiaohongshu.closing_question
                ).strip(),
                tags=xhs_tags or base.xiaohongshu.tags,
            )

            cover_prompt = str(row.get("cover_prompt") or base.cover_prompt).strip()
            tags_raw = row.get("tags") or base.tags
            tags = [str(t).strip() for t in tags_raw if t][:4] or base.tags

            series_line = ""
            if episode:
                series_line = f"\n\n这是我《{self.SERIES.name}》的第 {episode} 天。"

            picks.append(
                DouyinInspirationPick(
                    trend_id=base.trend_id,
                    title=seed,
                    source="fallback",
                    source_label=pillar,
                    pillar=pillar,
                    expression_type=str(row.get("expression_type") or expr).strip() or expr,
                    series_name=self.SERIES.name if episode else "",
                    series_episode=episode,
                    hook=douyin.opening,
                    copy_text=self._assemble_copy(douyin) + series_line,
                    script_outline=[
                        f"前3秒：{douyin.opening}",
                        f"中间场景：{douyin.scene}",
                        f"观点反转：{douyin.reversal}",
                        f"结尾互动：{douyin.question}",
                    ],
                    douyin=douyin,
                    xiaohongshu=xhs,
                    cover_prompt=cover_prompt,
                    tags=tags,
                    score=base.score,
                )
            )

        return picks

    def update_pick_cover(self, pick_id: str, cover_url: str) -> None:
        board = _douyin_cache.get("board")
        if not board:
            return
        for pick in board.picks:
            if pick.trend_id == pick_id:
                pick.cover_url = cover_url
                break

    def _studio_settings_key(self, user_id: str | None, scoped: bool) -> str:
        if scoped and user_id:
            return f"{SERIES_STUDIO_SETTINGS_KEY}:{user_id}"
        return SERIES_STUDIO_SETTINGS_KEY

    def _load_studio_state(self, db: Any, *, user_id: str | None, scoped: bool) -> dict[str, Any]:
        from app.db.database import SettingsRow
        from app.services.repository import load_json

        key = self._studio_settings_key(user_id, scoped)
        row = db.get(SettingsRow, key)
        if not row:
            return {}
        data = load_json(row.payload)
        return data if isinstance(data, dict) else {}

    def _save_studio_state(
        self,
        db: Any,
        state: dict[str, Any],
        *,
        user_id: str | None,
        scoped: bool,
    ) -> None:
        from app.db.database import SettingsRow
        from app.services.repository import dump_json

        key = self._studio_settings_key(user_id, scoped)
        payload = dump_json(state)
        row = db.get(SettingsRow, key)
        if row:
            row.payload = payload
        else:
            db.add(SettingsRow(key=key, payload=payload))
        db.commit()

    def _default_series_intro(self) -> str:
        return (
            "这是一个普通女生和自己和解的 30 天记录。\n"
            "不教你成功，只陪你少一点内耗。\n"
            "从一个人吃饭，到不再因为别人的一句话否定自己——\n"
            "每天一条，记录我如何慢慢把生活还给自己。"
        )

    def _default_series_cover_prompt(self, *, episode: int | None = None, title: str = "") -> str:
        if episode and title:
            return (
                f"抖音小红书竖版系列分集封面，第{episode}期，主题「{title[:16]}」，"
                f"女性低耗生活纪实摄影，温暖自然光，安静真实，无文字无水印"
            )
        return (
            "抖音小红书系列合辑封面，主题「普通女生停止内耗的30天」，"
            "女性低耗生活、情绪治愈、独处日常，温暖纪实摄影风，"
            "竖版9:16，柔和色调，无文字无水印"
        )

    def _match_pick_for_episode(
        self,
        episode: int,
        title: str,
        picks: list[DouyinInspirationPick],
    ) -> DouyinInspirationPick | None:
        for pick in picks:
            if pick.series_episode == episode:
                return pick
        title_key = title[:6]
        for pick in picks:
            if title_key in pick.title or title_key in pick.hook:
                return pick
        return None

    async def get_series_studio(
        self,
        db: Any,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> SeriesStudioResponse:
        state = self._load_studio_state(db, user_id=user_id, scoped=scoped)
        board = _douyin_cache.get("board")
        picks: list[DouyinInspirationPick] = []
        if board:
            picks = board.picks
        elif not _douyin_cache.get("fetched_at"):
            board = await self.get_board()
            picks = board.picks

        ep_states: dict[str, Any] = state.get("episodes") or {}
        episodes: list[SeriesEpisodeDetail] = []

        custom_raw: list[dict[str, Any]] = state.get("custom_episodes") or []
        custom_titles = [
            str(row.get("title") or "").strip()
            for row in custom_raw
            if str(row.get("title") or "").strip()
        ]
        all_titles = list(_SERIES_EPISODES) + custom_titles

        for index, title in enumerate(all_titles, start=1):
            if index <= len(_SERIES_EPISODE_META):
                pillar, expr = _SERIES_EPISODE_META[index - 1]
            else:
                custom_row = custom_raw[index - len(_SERIES_EPISODES) - 1]
                pillar = str(custom_row.get("pillar") or "低耗生活实验").strip()
                expr = str(custom_row.get("expression_type") or "共鸣型").strip()
            saved = ep_states.get(str(index)) or {}
            linked = self._match_pick_for_episode(index, title, picks)
            hook = str(saved.get("hook") or (linked.hook if linked else "")).strip()
            cover_url = str(saved.get("cover_url") or (linked.cover_url if linked else "")).strip()
            status = str(saved.get("status") or "").strip()
            if not status:
                if cover_url and hook:
                    status = "covered"
                elif hook or linked:
                    status = "scripted"
                else:
                    status = "pending"

            episodes.append(
                SeriesEpisodeDetail(
                    episode=index,
                    title=title,
                    pillar=pillar,
                    expression_type=expr,
                    cover_url=cover_url,
                    cover_prompt=self._default_series_cover_prompt(episode=index, title=title),
                    status=status,
                    linked_pick_id=linked.trend_id if linked else "",
                    hook=hook,
                    notes=str(saved.get("notes") or "").strip(),
                )
            )

        phases = [
            SeriesPhaseGuide(name=name, start_episode=start, end_episode=end, note=note)
            for name, start, end, note in SERIES_PHASES
        ]
        if custom_titles:
            phases.append(
                SeriesPhaseGuide(
                    name="延展期",
                    start_episode=len(_SERIES_EPISODES) + 1,
                    end_episode=len(all_titles),
                    note="你自行扩展的后续期数",
                )
            )

        return SeriesStudioResponse(
            series_id=SERIES_ID,
            series_name=self.SERIES.name,
            tagline=self.POSITIONING.tagline,
            description=(
                f"「30天」= 30 期连续内容，每周发 5 条约 6 周更完。"
                f"第 1-10 期是启动期（最容易开更），第 11-30 期延续同一账号叙事。"
                f"发完 30 期后可继续「扩展系列」追加更多期。"
            ),
            total_episodes=len(all_titles),
            phases=phases,
            series_cover_url=str(state.get("series_cover_url") or "").strip(),
            series_cover_prompt=self._default_series_cover_prompt(),
            intro_copy=str(state.get("intro_copy") or self._default_series_intro()).strip(),
            xhs_tags=state.get("xhs_tags")
            or ["停止内耗", "女性成长", "低耗生活", "30天挑战", "情绪管理", "独处日记"],
            episodes=episodes,
        )

    async def update_series_studio_async(
        self,
        db: Any,
        *,
        intro_copy: str = "",
        episode: int | None = None,
        notes: str = "",
        user_id: str | None = None,
        scoped: bool = False,
    ) -> SeriesStudioResponse:
        state = self._load_studio_state(db, user_id=user_id, scoped=scoped)
        if intro_copy.strip():
            state["intro_copy"] = intro_copy.strip()
        if episode:
            ep_states = state.setdefault("episodes", {})
            ep_key = str(episode)
            ep_data = dict(ep_states.get(ep_key) or {})
            if notes is not None:
                ep_data["notes"] = notes.strip()
            ep_states[ep_key] = ep_data
            self._save_studio_state(db, state, user_id=user_id, scoped=scoped)
        return await self.get_series_studio(db, user_id=user_id, scoped=scoped)

    async def save_series_cover(
        self,
        db: Any,
        cover_url: str,
        *,
        episode: int | None = None,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> None:
        state = self._load_studio_state(db, user_id=user_id, scoped=scoped)
        if episode:
            ep_states = state.setdefault("episodes", {})
            ep_key = str(episode)
            ep_data = dict(ep_states.get(ep_key) or {})
            ep_data["cover_url"] = cover_url
            ep_data["status"] = "covered"
            ep_states[ep_key] = ep_data
        else:
            state["series_cover_url"] = cover_url
        self._save_studio_state(db, state, user_id=user_id, scoped=scoped)

    async def generate_episode_script(
        self,
        episode: int,
        *,
        user_id: str | None = None,
        scoped: bool = False,
        db: Any = None,
    ) -> SeriesEpisodeDetail:
        if episode < 1:
            raise ValueError("集数无效")
        state = self._load_studio_state(db, user_id=user_id, scoped=scoped) if db else {}
        custom_raw: list[dict[str, Any]] = (state.get("custom_episodes") or []) if state else []
        custom_titles = [str(r.get("title") or "").strip() for r in custom_raw if r.get("title")]
        all_titles = list(_SERIES_EPISODES) + custom_titles
        if episode > len(all_titles):
            raise ValueError("集数无效")
        title = all_titles[episode - 1]
        if episode <= len(_SERIES_EPISODE_META):
            pillar, expr = _SERIES_EPISODE_META[episode - 1]
        else:
            custom_row = custom_raw[episode - len(_SERIES_EPISODES) - 1]
            pillar = str(custom_row.get("pillar") or "低耗生活实验")
            expr = str(custom_row.get("expression_type") or "共鸣型")
        douyin = self._build_douyin_script(title, expr)
        hook = douyin.opening

        if db is not None:
            state = self._load_studio_state(db, user_id=user_id, scoped=scoped)
            ep_states = state.setdefault("episodes", {})
            ep_key = str(episode)
            ep_data = dict(ep_states.get(ep_key) or {})
            ep_data["hook"] = hook
            ep_data["status"] = "scripted"
            ep_states[ep_key] = ep_data
            self._save_studio_state(db, state, user_id=user_id, scoped=scoped)

        return SeriesEpisodeDetail(
            episode=episode,
            title=title,
            pillar=pillar,
            expression_type=expr,
            cover_prompt=self._default_series_cover_prompt(episode=episode, title=title),
            status="scripted",
            hook=hook,
        )

    async def extend_series(
        self,
        db: Any,
        *,
        count: int = 5,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> SeriesStudioResponse:
        count = max(1, min(count, 10))
        state = self._load_studio_state(db, user_id=user_id, scoped=scoped)
        custom: list[dict[str, Any]] = list(state.get("custom_episodes") or [])
        used = set(_SERIES_EPISODES) | {str(r.get("title") or "").strip() for r in custom}

        candidates: list[tuple[str, str, ExpressionType]] = []
        for pillar, seeds in _PILLAR_SEEDS.items():
            for title, expr in seeds:
                if title not in used:
                    candidates.append((pillar, title, expr))

        if self.llm.status().configured and len(candidates) < count:
            try:
                system = (
                    "你是系列栏目策划。为「普通女生停止内耗的30天」续写后续期标题。"
                    '输出 JSON：{"episodes":[{"title":"","pillar":"","expression_type":""}]}'
                )
                last_titles = list(_SERIES_EPISODES[-3:]) + [r.get("title", "") for r in custom[-2:]]
                user = (
                    f"已有 {len(_SERIES_EPISODES) + len(custom)} 期，请再生成 {count} 个不重复的续集标题。\n"
                    f"最近几期：{'; '.join(t for t in last_titles if t)}\n"
                    "pillar 从三栏目选：成年人情绪观察 / 低耗生活实验 / 普通女生的清醒时刻\n"
                    "expression_type：共鸣型 / 故事型 / 方法型\n"
                    "标题口语化，像日记章节名，不要震惊体。"
                )
                raw = await self.llm.complete(system, user, json_mode=True, temperature=0.75)
                data = parse_json_from_text(raw)
                for row in data.get("episodes") or []:
                    title = str(row.get("title") or "").strip()
                    if title and title not in used:
                        candidates.append((
                            str(row.get("pillar") or "低耗生活实验").strip(),
                            title,
                            str(row.get("expression_type") or "共鸣型").strip(),
                        ))
                        used.add(title)
            except Exception as exc:
                logger.warning("extend series llm failed: %s", exc)

        added = 0
        for pillar, title, expr in candidates:
            if added >= count:
                break
            if title in used:
                continue
            custom.append({
                "title": title,
                "pillar": pillar,
                "expression_type": expr,
            })
            used.add(title)
            added += 1

        state["custom_episodes"] = custom
        self._save_studio_state(db, state, user_id=user_id, scoped=scoped)
        return await self.get_series_studio(db, user_id=user_id, scoped=scoped)
