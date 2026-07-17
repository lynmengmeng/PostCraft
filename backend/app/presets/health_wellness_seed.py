"""心理 + 身体健康方向：内容栏目与选题种子数据。"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.schemas import (
    AuthorStyleProfile,
    CategoryPlatformHints,
    ContentCategoryCreate,
    Topic,
    TopicCreate,
)
from app.services.repository import category_repo, style_repo, topic_repo

HEALTH_WELLNESS_ACCOUNT_POSITIONING = (
    "帮普通人看懂身体和情绪的小信号，用低耗、平静的方式做日常健康管理。"
    "观察生活，感受平静——不贩卖焦虑，不替代医疗建议。"
)

HEALTH_WELLNESS_STYLE = AuthorStyleProfile(
    tone_preference="温和观察",
    account_positioning=HEALTH_WELLNESS_ACCOUNT_POSITIONING,
    banned_phrases=[
        "震惊",
        "必看",
        "赶紧转发",
        "不看后悔",
        "100%治愈",
        "包治",
        "一定有效",
    ],
    personal_snippets=[],
    platform_defaults={
        "wechat": "公众号优先：搜索友好标题 + 痛点开头 + 单问题结构 + 健康免责声明",
    },
)

HEALTH_WELLNESS_CATEGORIES: list[ContentCategoryCreate] = [
    ContentCategoryCreate(
        name="身体信号",
        description="体检指标、季节养生、慢性问题、疲劳睡眠等——帮读者看懂身体在说什么",
        prompt_hint=(
            "写一篇关于普通人身体健康的观察文章。从具体场景或体检/症状切入，"
            "全文只回答一个核心问题，给出 3–5 个可执行的判断点或自查步骤。"
            "语气是温和观察，不是医疗诊断；涉及健康表述时提醒「个人观察，非医疗建议」。"
            "遵循公众号冷启动规则：搜索型标题、痛点开头、单问题结构。"
        ),
        structure_hint=(
            "痛点场景（80–120 字）→ 反常识判断 → 本文承诺 → "
            "3–5 个小节（每节一个信号/步骤）→ 1 个明确行动建议 → 健康免责声明"
        ),
        platform_hints=CategoryPlatformHints(
            wechat="经典或清单排版，段落短（2–4 行），每 300–500 字一个具体例子",
            xiaohongshu="自查清单体，短段 + 标签，适合收藏，如 #身体信号 #低耗生活",
            douyin="60–90 秒口播，开头直接说「出现 XX 信号先别慌，先自查这 3 点」",
        ),
        title_style="人群 + 痛点 + 数字结果 + 问句，如「体检 XX 偏高？先搞懂这 3 个信号」",
        cover_mood="日常纪实，人物细节或生活场景，柔和自然光，不血腥不吓人",
        default_layout="checklist",
        default_tone="温和观察",
        example_topics=[
            "体检甲状腺抗体偏高该注意什么",
            "三伏天养生最容易踩的坑",
            "爱运动也可能缺维生素D",
        ],
    ),
    ContentCategoryCreate(
        name="情绪与低耗",
        description="内耗、行动焦虑、低欲望生活、情绪耗竭——帮读者区分休息与逃避",
        prompt_hint=(
            "写一篇关于情绪与低耗生活的观察文章。从读者熟悉的内心场景切入，"
            "全文只回答一个心理/情绪问题，给出 3 个可实践的做法或判断框架。"
            "避免诊断式表述（不说「你就是焦虑症」），用「我观察到 / 很多人会有」。"
            "标题要有共鸣，但必须带利益点或悬念，便于搜索和转发。"
        ),
        structure_hint=(
            "具体情绪场景 → 打破默认假设（「问题可能不是懒，而是…」）→ "
            "3 个做法或分辨方法 → 1 个今天就能试的小行动 → 可选系列预告"
        ),
        platform_hints=CategoryPlatformHints(
            wechat="故事叙事 + 观点，情绪递进但不说教，结尾有余韵和行动建议",
            xiaohongshu="共鸣短段，每段 1–2 行，像写给疲惫的普通人的笔记",
            douyin="共鸣 hook 开头，60 秒讲清 1 个情绪误区 + 1 个最小行动",
        ),
        title_style="共鸣 + 利益点，如「低耗生活不是摆烂：普通人减少内耗的 3 个做法」",
        cover_mood="低饱和纪实，安静室内或自然场景，平静不压抑",
        default_layout="story",
        default_tone="温和共情",
        example_topics=[
            "低耗生活不是摆烂",
            "身体累还是心累怎么分",
            "总想准备完美再行动的行动焦虑",
        ],
    ),
    ContentCategoryCreate(
        name="健康消费避坑",
        description="配料表、养生产品、食品选择——帮普通家庭少花冤枉钱、少踩坑",
        prompt_hint=(
            "写一篇健康消费观察文章。从一次购物、一张配料表或一个养生误区切入，"
            "全文只讲清楚一个选择问题，给出 3 个看得懂的判断标准。"
            "要有真实观察感，避免广告口吻；可以写价格与价值的理性对比。"
        ),
        structure_hint=(
            "购物/消费场景 → 常见误区 → 3 个判断标准（怎么看配料/怎么选/怎么避坑）→ "
            "1 个今天就能用的选择建议"
        ),
        platform_hints=CategoryPlatformHints(
            wechat="干货清单排版，标准与例子并列，适合搜一搜长尾词",
            xiaohongshu="避坑清单 + 短句，每点一行，强调「普通人也能看懂」",
            douyin="90 秒内口播「别买错 / 先看这 3 处」，开头抛具体产品或场景",
        ),
        title_style="搜索问题型，如「买酸奶别只看价格，配料表这 3 处最容易看错」",
        cover_mood="超市/产品实拍感，简洁背景，真实不广告",
        default_layout="checklist",
        default_tone="实用分享",
        example_topics=[
            "酸奶配料表怎么看",
            "养生产品怎么选才不交智商税",
            "三伏天相关产品避坑",
        ],
    ),
]

HEALTH_WELLNESS_TOPICS: list[TopicCreate] = [
    TopicCreate(
        title="体检甲状腺抗体偏高？先搞懂这 3 个信号，别自己吓自己",
        content_pillar="身体信号",
        direction="健康观察",
        tone="温和观察",
        platforms=["wechat", "xiaohongshu"],
        audience="30–45 岁关注体检与家人健康的普通人",
        material_status="ready",
        priority="soon",
        series="桥本与甲状腺",
        inspiration=(
            "核心问题：体检报告出现甲状腺抗体偏高，普通人该怎么理解、下一步该做什么？\n"
            "角度：不是吓人，而是帮读者区分「需要重视」和「不必过度焦虑」。\n"
            "3 个信号/步骤建议：① 看懂报告里常见的 2–3 个指标含义；"
            "② 哪些症状值得复查、哪些可以先观察；③ 日常管理上最容易踩的 1 个误区。\n"
            "可参考已发文章「桥本甲状腺炎」做系列第 2 篇，语气更搜索友好。"
        ),
    ),
    TopicCreate(
        title="低耗生活不是摆烂：普通人减少内耗的 3 个做法",
        content_pillar="情绪与低耗",
        direction="生活观察",
        tone="温和共情",
        platforms=["wechat", "xiaohongshu", "douyin"],
        audience="感觉累、想慢下来、不想卷的普通成年人",
        material_status="ready",
        priority="soon",
        series="低耗生活",
        inspiration=(
            "核心问题：低欲望、低消费的生活，和「摆烂逃避」到底怎么区分？\n"
            "开头场景：读书、消费、社交上的「低耗选择」被误解为不上进。\n"
            "3 个做法：① 区分「主动休息」和「逃避」的一个判断标准；"
            "② 减少内耗的一个最小行动（如减少比较的信息输入）；"
            "③ 低耗生活里如何保留必要的自我负责。\n"
            "可重写已发「那书不是白读了」角度，标题更搜索友好、结构更清晰。"
        ),
    ),
    TopicCreate(
        title="总犯困、情绪差？爱户外运动也可能缺维D，先自查这 3 点",
        content_pillar="身体信号",
        direction="健康观察",
        tone="温和观察",
        platforms=["wechat", "xiaohongshu"],
        audience="上班族、户外爱好者、总感觉疲惫的普通人",
        material_status="idea",
        priority="soon",
        series="身体信号",
        inspiration=(
            "核心问题：为什么「爱晒太阳、爱户外」的人仍可能维D不足？\n"
            "反常识：户外多 ≠ 一定不缺，防晒、作息、吸收因素都要考虑。\n"
            "3 个自查点：常见表现、哪些习惯在抵消日晒、什么时候值得去查血。\n"
            "可参考已发维D文章，补强搜索关键词和清单结构。"
        ),
    ),
    TopicCreate(
        title="三伏天吹空调、喝冷饮，这 5 个坑很多家庭在踩",
        content_pillar="身体信号",
        direction="季节养生",
        tone="温和观察",
        platforms=["wechat", "xiaohongshu"],
        audience="关注家人夏季健康的普通家庭",
        material_status="ready",
        priority="soon",
        series="季节养生",
        inspiration=(
            "核心问题：三伏天养生，空调、冷饮、出汗、贪凉，普通人最容易踩哪 5 个坑？\n"
            "不要写成中医恐吓体，用生活观察 + 可执行建议。\n"
            "每个坑：现象 → 为什么容易错 → 一个简单改法。\n"
            "可优化已发「三伏天养生」标题与结构，保留 5 个坑的框架。"
        ),
    ),
    TopicCreate(
        title="身体累还是心累？3 个信号帮你分清",
        content_pillar="情绪与低耗",
        direction="心理观察",
        tone="温和共情",
        platforms=["wechat", "xiaohongshu", "douyin"],
        audience="长期疲惫、分不清该休息还是该调整的成年人",
        material_status="idea",
        priority="soon",
        series="低耗生活",
        inspiration=(
            "核心问题：同样说「累」，有时是身体问题，有时是情绪耗竭，怎么初步分辨？\n"
            "3 个信号：睡眠与恢复、情绪触发点、身体是否有明确可查指标。\n"
            "结尾给 1 个行动：先睡够 / 先减一项消耗 / 必要时就医检查。\n"
            "避免诊断，强调「观察与分流」而非定论。"
        ),
    ),
    TopicCreate(
        title="买酸奶别只看价格，配料表这 3 处最容易踩坑",
        content_pillar="健康消费避坑",
        direction="消费观察",
        tone="实用分享",
        platforms=["wechat", "xiaohongshu"],
        audience="想吃得健康又怕踩坑的普通家庭",
        material_status="ready",
        priority="later",
        series="配料表怎么看",
        inspiration=(
            "核心问题：配料表只有生牛乳和菌的酸奶为什么贵？普通人买酸奶该先看哪 3 处？\n"
            "3 处：配料顺序、糖与添加剂、蛋白质/菌株标注怎么看。\n"
            "可结合已发酸奶文章，从「凭什么贵」改为「怎么选」的搜索友好角度。\n"
            "结尾：1 个今天去超市就能用的选择标准。"
        ),
    ),
]


def apply_health_wellness_seed(
    db: Session,
    *,
    user_id: str | None = None,
    scoped: bool = False,
    force_style: bool = False,
) -> dict[str, int]:
    """Idempotently add categories, topics, and optional style profile."""
    scope = {"user_id": user_id, "scoped": scoped}
    stats = {
        "categories_created": 0,
        "categories_skipped": 0,
        "topics_created": 0,
        "topics_skipped": 0,
        "style_updated": 0,
    }

    existing = category_repo.list_all(db, **scope)
    existing_names = {cat.name for cat in existing}
    for payload in HEALTH_WELLNESS_CATEGORIES:
        if payload.name in existing_names:
            stats["categories_skipped"] += 1
            continue
        category_repo.add_custom(db, payload, **scope)
        stats["categories_created"] += 1

    existing_topics = topic_repo.list_all(db, **scope)
    existing_titles = {topic.title for topic in existing_topics}
    for payload in HEALTH_WELLNESS_TOPICS:
        if payload.title in existing_titles:
            stats["topics_skipped"] += 1
            continue
        topic = Topic.model_validate(payload.model_dump())
        topic_repo.create(db, topic, **scope)
        stats["topics_created"] += 1

    current_style = style_repo.get(db, **scope)
    if force_style or not current_style.account_positioning.strip():
        style_repo.save(db, HEALTH_WELLNESS_STYLE, **scope)
        stats["style_updated"] = 1

    return stats
