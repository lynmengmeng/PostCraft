from __future__ import annotations

from app.models.schemas import (
    ContentPatch,
    ContentProject,
    CoverAsset,
    DouyinContent,
    DouyinScene,
    TitleCandidate,
    TopicMeta,
    WechatContent,
    XiaohongshuContent,
)


def _mock_humanized(project: ContentProject) -> str:
    inspiration = project.inspiration or project.title
    pillar = (project.content_pillar or project.topic_meta.content_pillar or "").strip()
    templates: dict[str, str] = {
        "周末出走计划": (
            f"## 这个周末，我想出去透口气\n\n{inspiration}\n\n"
            "骑电动车去江边的那条路，风不大，但足够把脑子里的噪音吹散一点。"
            "不用请假，不用花很多钱，半天就够。"
        ),
        "便宜但有用": (
            f"## 便宜，但真的有用\n\n{inspiration}\n\n"
            "这些东西都不贵，但我用了之后确实觉得生活舒服了一点。"
            "不是广告清单，是我真实留下来的。"
        ),
        "一个小故事": (
            f"## 她说，她只是想安静地过一个周末\n\n{inspiration}\n\n"
            "故事不长，但那个瞬间我记了很久。"
            "成年人最想要的，有时候只是半天自由。"
        ),
        "路上听什么": (
            f"## 适合骑车去江边听的歌\n\n{inspiration}\n\n"
            "不是今日推荐歌曲列表，是某条路、某个傍晚、某次出走时反复听的几首歌。"
        ),
        "普通人观察": (
            f"## 普通人的喘息时刻\n\n{inspiration}\n\n"
            "不是宏大叙事，是身边越来越常见的情绪："
            "不想旅行，只是想离开现在的生活半天。"
        ),
    }
    if pillar in templates:
        return templates[pillar]
    return (
        f"## 观察\n\n{inspiration}\n\n"
        "这不是危言耸听，而是我在生活里反复看到的细节。"
        "很多变化不是突然降临，而是在日常里被一点点忽略。"
    )


def _mock_platform_payload(project: ContentProject, humanized: str) -> dict:
    inspiration = project.inspiration or project.title
    wechat_title = f"回村之后，我才看懂：{inspiration[:18]}"
    xhs_title = f"关于{inspiration[:12]}，我想认真说几句"
    hook = f"你有没有发现，{inspiration[:20]}？"

    wechat = WechatContent(
        title=wechat_title,
        summary="从一次回村的经历说起，聊聊被忽视的生活风险。",
        body=(
            f"## 从一个细节说起\n\n"
            f"{inspiration}\n\n"
            "![回村观察](__IMAGE_0__)\n\n"
            "去年春节回村，我才真正注意到：很多老人并不是突然病倒，"
            "而是长期处在不安全的生活环境里。\n\n"
            "## 三个容易被忽略的原因\n\n"
            "1. **劣质日用品长期接触**——三无产品在农村仍很常见\n"
            "2. **医疗意识不足**——小问题拖成大问题\n"
            "3. **环境问题被默认接受**——安全与健康被当作「没办法」\n\n"
            "![日常细节](__IMAGE_1__)\n\n"
            "> 这不是要制造焦虑，而是希望我们都能更认真地看待普通人的生活。\n\n"
            "## 写在最后\n\n"
            "如果你也有类似观察，欢迎在评论区聊聊。"
        ),
        style_theme={
            "accent": "#455548",
            "mood": "warm",
            "heading_style": "border_left",
            "quote_bg": "#faf8f5",
            "quote_border": "#d4a574",
        },
        image_placements=[
            {"after_paragraph": 1, "asset_index": 0, "caption": "回村观察", "prompt": "纪实风格，农村傍晚，真实生活场景"},
            {"after_paragraph": 4, "asset_index": 1, "caption": "日常细节", "prompt": "纪实风格，农村老人日常，暖色调"},
        ],
    )
    xhs = XiaohongshuContent(
        title=xhs_title,
        body=(
            f"关于「{inspiration[:16]}」，我想分享一点真实观察 🌾\n\n"
            "回农村之前，我以为这些问题离我很远。\n"
            "回去之后才发现，它们就在日常里。\n\n"
            "【要点一】劣质商品还在流通\n"
            "· 三无产品在农村仍常见\n"
            "· 包装像正规药，识别看细节\n\n"
            "—————\n\n"
            "【要点二】小问题容易被忽视\n"
            "· 拖久了才去看\n"
            "· 家人总觉得「没事」\n\n"
            "如果你也有类似感受，评论区聊聊 👇"
        ),
        tags=["生活观察", "农村生活", "健康提醒"],
        cover_style="warm_documentary_photography_of_a_rural_sunset_over",
        image_pages=[
            {
                "page": 1,
                "role": "cover",
                "headline": xhs_title[:14],
                "subheadline": "真实观察分享",
                "body_text": "",
                "prompt": "暖色纪实摄影，农村傍晚，3:4竖版",
            },
            {
                "page": 2,
                "role": "content",
                "headline": "劣质商品还在流通",
                "body_text": "三无产品包装像正规药",
                "prompt": "简洁文字排版，要点一页",
            },
            {
                "page": 3,
                "role": "summary",
                "headline": "收藏备用",
                "subheadline": "评论区聊聊",
                "body_text": "三个被忽略的原因",
                "prompt": "总结页，互动引导",
            },
        ],
    )
    douyin = DouyinContent(
        hook=hook,
        duration="90s",
        script=[
            DouyinScene(
                index=1,
                duration="3s",
                narration=hook,
                visual="近景，农村院落",
                subtitle=hook,
            ),
            DouyinScene(
                index=2,
                duration="12s",
                narration="很多人以为风险离自己很远，其实它就在日常里。",
                visual="老人日常起居画面",
                subtitle="风险就在日常里",
            ),
            DouyinScene(
                index=3,
                duration="15s",
                narration="劣质商品、医疗意识不足、环境问题，往往是一起出现的。",
                visual="分点字幕",
                subtitle="三个被忽略的原因",
            ),
            DouyinScene(
                index=4,
                duration="10s",
                narration="我们不是要制造焦虑，而是希望更多人看见这些真实细节。",
                visual="暖色结尾镜头",
                subtitle="看见，比忽视更重要",
            ),
        ],
    )
    titles = [
        TitleCandidate(text=wechat_title, style="深度型"),
        TitleCandidate(text=xhs_title, style="情绪共鸣型"),
        TitleCandidate(text=f"为什么{inspiration[:10]}值得被看见？", style="问题型"),
        TitleCandidate(text=f"回村后才懂：{inspiration[:12]}", style="故事型"),
        TitleCandidate(text="普通家庭最容易忽略的一个风险", style="警醒型"),
        TitleCandidate(text=f"关于{inspiration[:8]}，我想认真说几句", style="情绪共鸣型"),
        TitleCandidate(text=f"回农村后，我注意到的一个细节", style="故事型"),
        TitleCandidate(text=f"{inspiration[:10]}背后，藏着什么？", style="问题型"),
        TitleCandidate(text="不是危言耸听，是真实观察", style="深度型"),
        TitleCandidate(text="为什么这件事值得被看见？", style="问题型"),
        TitleCandidate(text=f"从{inspiration[:6]}说起", style="故事型"),
        TitleCandidate(text="温和提醒：别忽视这些日常风险", style="警醒型"),
    ]

    return {
        "humanized": humanized,
        "draft": humanized,
        "platforms": {
            "wechat": wechat,
            "xiaohongshu": xhs,
            "douyin": douyin,
        },
        "titles": titles,
        "wechat_title": wechat_title,
    }


def build_mock_draft(project: ContentProject) -> ContentPatch:
    humanized = _mock_humanized(project)
    return ContentPatch(
        intent="generate_draft",
        target_platforms=[],
        summary="已根据灵感生成观察型初稿。可在「初稿」区查看，继续对话打磨后再生成各平台内容。",
        patch={"humanized": humanized, "draft": humanized},
    )


def build_mock_platforms(
    project: ContentProject,
    targets: list[str],
    with_titles: bool = False,
) -> ContentPatch:
    humanized = project.humanized or project.draft or _mock_humanized(project)
    payload = _mock_platform_payload(project, humanized)
    patch: dict = {}
    for platform in targets:
        patch[f"platforms.{platform}"] = payload["platforms"][platform].model_dump(mode="json")  # type: ignore[index]
    if with_titles or len(targets) >= 3 or not project.titles:
        patch["titles"] = [item.model_dump(mode="json") for item in payload["titles"]]  # type: ignore[index]
    cover_assets: list[dict] = []
    if "wechat" in targets:
        cover_assets.extend(
            [
                CoverAsset(
                    platform="wechat",
                    headline=str(payload["wechat_title"])[:20],
                    subheadline="回村观察",
                    prompt="纪实风格，农村傍晚，真实生活场景",
                    after_paragraph=1,
                    caption="回村观察",
                    asset_index=0,
                ).model_dump(mode="json"),
                CoverAsset(
                    platform="wechat",
                    headline=str(payload["wechat_title"])[:20],
                    subheadline="日常细节",
                    prompt="纪实风格，农村老人日常，暖色调",
                    after_paragraph=4,
                    caption="日常细节",
                    asset_index=1,
                ).model_dump(mode="json"),
            ]
        )
    if "xiaohongshu" in targets:
        xhs = payload["platforms"]["xiaohongshu"]  # type: ignore[index]
        for index, page in enumerate(xhs.get("image_pages") or []):
            cover_assets.append(
                CoverAsset(
                    platform="xiaohongshu",
                    headline=str(page.get("headline") or "")[:20],
                    subheadline=str(page.get("subheadline") or ""),
                    prompt=str(page.get("prompt") or "小红书轮播配图"),
                    after_paragraph=index,
                    caption=str(page.get("headline") or f"轮播第{index + 1}张"),
                    asset_index=100 + index,
                ).model_dump(mode="json")
            )
    if cover_assets:
        patch["cover_assets"] = cover_assets
    label = "、".join(targets)
    return ContentPatch(
        intent="generate_platform" if len(targets) == 1 else "generate_all",
        target_platforms=targets,  # type: ignore[arg-type]
        summary=f"已根据初稿生成 {label} 内容（模板模式）。",
        patch=patch,
    )


def build_mock_refine_draft(project: ContentProject, message: str) -> ContentPatch:
    base = project.humanized or project.draft or _mock_humanized(project)
    suffix = f"\n\n（已按「{message[:24]}」方向微调语气。）" if message.strip() else ""
    humanized = base + suffix
    return ContentPatch(
        intent="refine_draft",
        target_platforms=[],
        summary="已更新初稿。满意后可生成各平台内容。",
        patch={"humanized": humanized, "draft": humanized},
    )


def build_mock_generate_all(project: ContentProject) -> ContentPatch:
    draft = build_mock_draft(project)
    merged = project.model_copy(
        update={"humanized": draft.patch["humanized"], "draft": draft.patch["draft"]}
    )
    return build_mock_platforms(merged, ["wechat", "xiaohongshu", "douyin"], with_titles=True)


def build_mock_titles(project: ContentProject, count: int = 10) -> ContentPatch:
    seed = project.inspiration or project.title
    styles = ["情绪共鸣型", "问题型", "警醒型", "深度型", "故事型"]
    titles = [
        TitleCandidate(text=f"{seed[:12]}，为什么值得被看见？", style=styles[i % len(styles)])
        for i in range(count)
    ]
    return ContentPatch(
        intent="generate_titles",
        target_platforms=["all"],
        summary=f"已生成 {count} 个标题备选。",
        patch={"titles": [item.model_dump(mode="json") for item in titles]},
    )


def build_mock_cover_assets(project: ContentProject) -> ContentPatch:
    title = project.platforms["wechat"].title or project.title
    asset = CoverAsset(
        platform="wechat",
        headline=title[:20] or "生活观察",
        subheadline="真实 · 温和 · 有温度",
        prompt="纪实摄影，暖色乡村生活，真实人物与环境，避免营销海报感",
    )
    return ContentPatch(
        intent="cover_assets",
        target_platforms=["all"],
        summary="已生成封面文案与配图提示词。",
        patch={"cover_assets": [asset.model_dump(mode="json")]},
    )
