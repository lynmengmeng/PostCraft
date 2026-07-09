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


def _pillar_name(project: ContentProject) -> str:
    return (project.content_pillar or project.topic_meta.content_pillar or "").strip()


def _mock_humanized(project: ContentProject) -> str:
    inspiration = project.inspiration or project.title
    pillar = _pillar_name(project)
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
    pillar = _pillar_name(project)
    seed = inspiration[:18]

    profiles: dict[str, dict] = {
        "周末出走计划": {
            "wechat_title": f"花不到 50 元，{seed}的周末出走",
            "wechat_summary": "一次低成本周末出走，路线、花费和真实感受。",
            "wechat_layout": "story",
            "wechat_body_intro": "这个周末没走远，但足够把脑子里的噪音吹散一点。",
            "xhs_title": f"周末出走｜{seed[:12]}",
            "xhs_tags": ["周末出走", "低成本旅行", "武汉周边"],
            "hook": f"这个周末，我只花了不到 50 元，{seed[:16]}",
            "douyin_duration": "60s",
            "cover_prompt": "户外自然光，骑行/江边场景，清新放松",
            "title_style": "场景型",
        },
        "便宜但有用": {
            "wechat_title": f"便宜但有用：{seed}",
            "wechat_summary": "真实使用体验与避坑清单，不是广告。",
            "wechat_layout": "checklist",
            "wechat_body_intro": "这些东西都不贵，但我用了之后确实觉得生活舒服了一点。",
            "xhs_title": f"便宜但有用｜{seed[:12]}",
            "xhs_tags": ["好物分享", "避坑清单", "真实体验"],
            "hook": f"别买错！关于{seed[:14]}，我踩过的坑",
            "douyin_duration": "90s",
            "cover_prompt": "居家产品实拍，简洁背景，真实不广告感",
            "title_style": "搜索问题型",
        },
        "一个小故事": {
            "wechat_title": f"{seed}，那个瞬间我记了很久",
            "wechat_summary": "一个短故事，一点生活观察。",
            "wechat_layout": "story",
            "wechat_body_intro": "故事不长，但那个瞬间我记了很久。",
            "xhs_title": f"一个小故事｜{seed[:10]}",
            "xhs_tags": ["生活故事", "情绪共鸣", "普通人"],
            "hook": f"说实话，看到{seed[:14]}的时候，我心里挺不是滋味",
            "douyin_duration": "90s",
            "cover_prompt": "情绪化纪实摄影，暖色或低饱和，人物细节",
            "title_style": "情绪共鸣型",
        },
        "路上听什么": {
            "wechat_title": f"骑车去江边，我反复听这几首",
            "wechat_summary": "场景化歌单，不是单纯推歌。",
            "wechat_layout": "lively",
            "wechat_body_intro": "不是今日推荐歌曲列表，是某条路、某个傍晚反复听的几首歌。",
            "xhs_title": f"路上听什么｜{seed[:12]}",
            "xhs_tags": ["歌单分享", "场景音乐", "骑车日常"],
            "hook": f"{seed[:12]}的时候，我总会听这几首",
            "douyin_duration": "60s",
            "cover_prompt": "傍晚骑行/耳机/车窗，氛围感但不炫光",
            "title_style": "场景型",
        },
        "普通人观察": {
            "wechat_title": f"关于{seed}，普通人的一点观察",
            "wechat_summary": "现象观察，有分寸，不煽动。",
            "wechat_layout": "classic",
            "wechat_body_intro": "不是宏大叙事，是身边越来越常见的情绪。",
            "xhs_title": f"普通人观察｜{seed[:12]}",
            "xhs_tags": ["生活观察", "普通人", "消费观察"],
            "hook": f"你有没有发现，{seed[:18]}？",
            "douyin_duration": "90s",
            "cover_prompt": "日常街拍纪实，普通人生活场景，克制不煽情",
            "title_style": "观察型",
        },
    }
    profile = profiles.get(pillar, {
        "wechat_title": f"关于{seed}，我想认真说几句",
        "wechat_summary": "一点真实观察。",
        "wechat_layout": "classic",
        "wechat_body_intro": "这不是危言耸听，而是我在生活里反复看到的细节。",
        "xhs_title": f"关于{seed[:12]}，我想认真说几句",
        "xhs_tags": ["生活观察", "真实分享"],
        "hook": f"你有没有发现，{seed[:20]}？",
        "douyin_duration": "90s",
        "cover_prompt": "纪实风格，暖色生活场景",
        "title_style": "观察型",
    })

    wechat_title = profile["wechat_title"]
    xhs_title = profile["xhs_title"]
    hook = profile["hook"]
    layout = profile["wechat_layout"]
    cover_prompt = profile["cover_prompt"]

    wechat = WechatContent(
        title=wechat_title,
        summary=profile["wechat_summary"],
        body=(
            f"## 从一个细节说起\n\n"
            f"{inspiration}\n\n"
            f"![配图](__IMAGE_0__)\n\n"
            f"{profile['wechat_body_intro']}\n\n"
            "## 三个值得留下的点\n\n"
            "1. **真实体验**——不是攻略，是我自己的感受\n"
            "2. **低成本**——不用花很多钱也能好好放松\n"
            "3. **可复刻**——你也能照着做\n\n"
            f"![细节](__IMAGE_1__)\n\n"
            "> 这不是广告，是我真实留下来的分享。\n\n"
            "## 写在最后\n\n"
            "如果你也有类似经历，欢迎在评论区聊聊。"
        ),
        style_theme={
            "layout_preset": layout,
            "accent": "#455548",
            "mood": "warm",
            "heading_style": "border_left",
            "quote_bg": "#faf8f5",
            "quote_border": "#d4a574",
        },
        image_placements=[
            {"after_paragraph": 1, "asset_index": 0, "caption": "配图", "prompt": cover_prompt},
            {"after_paragraph": 4, "asset_index": 1, "caption": "细节", "prompt": cover_prompt},
        ],
    )
    xhs = XiaohongshuContent(
        title=xhs_title,
        body=(
            f"关于「{seed}」，分享一点真实感受 ✨\n\n"
            f"{profile['wechat_body_intro']}\n\n"
            "【要点一】真实体验\n"
            "· 不是广告清单\n"
            "· 是我真实留下来的\n\n"
            "—————\n\n"
            "【要点二】可以照着做\n"
            "· 低成本\n"
            "· 半天就够\n\n"
            "如果你也有类似感受，评论区聊聊 👇"
        ),
        tags=profile["xhs_tags"],
        cover_style="warm_documentary_photography_scene",
        image_pages=[
            {
                "page": 1,
                "role": "cover",
                "headline": xhs_title[:14],
                "subheadline": pillar or "生活分享",
                "body_text": "",
                "prompt": f"{cover_prompt}，3:4竖版",
            },
            {
                "page": 2,
                "role": "content",
                "headline": "真实体验",
                "body_text": profile["wechat_body_intro"][:40],
                "prompt": "简洁文字排版，要点一页",
            },
        ],
    )
    douyin = DouyinContent(
        hook=hook,
        duration=profile["douyin_duration"],
        script=[
            DouyinScene(
                index=1,
                duration="3s",
                narration=hook,
                visual="近景，生活场景",
                subtitle=hook[:20],
            ),
            DouyinScene(
                index=2,
                duration="12s",
                narration=profile["wechat_body_intro"],
                visual="日常画面",
                subtitle="真实分享",
            ),
            DouyinScene(
                index=3,
                duration="10s",
                narration="不是广告，是我真实留下来的。",
                visual="暖色结尾镜头",
                subtitle="评论区聊聊",
            ),
        ],
    )
    title_style = profile["title_style"]
    titles = [
        TitleCandidate(text=wechat_title, style=title_style),
        TitleCandidate(text=xhs_title, style="情绪共鸣型"),
        TitleCandidate(text=f"为什么{seed[:10]}值得被看见？", style="问题型"),
        TitleCandidate(text=f"关于{seed[:8]}，我想认真说几句", style=title_style),
        TitleCandidate(text=f"{seed[:12]}的真实体验", style="故事型"),
        TitleCandidate(text=f"{seed[:10]}，我踩过的坑", style="搜索问题型"),
        TitleCandidate(text=f"便宜但有用：{seed[:10]}", style="搜索问题型"),
        TitleCandidate(text=f"这个周末，{seed[:10]}", style="场景型"),
        TitleCandidate(text=f"路上听什么｜{seed[:8]}", style="场景型"),
        TitleCandidate(text="不是广告，是真实分享", style=title_style),
        TitleCandidate(text=f"从{seed[:6]}说起", style="故事型"),
        TitleCandidate(text="温和提醒：别忽视这些日常细节", style="观察型"),
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
        "cover_prompt": cover_prompt,
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
    cover_prompt = payload.get("cover_prompt", "纪实风格，暖色生活场景")
    cover_assets: list[dict] = []
    if "wechat" in targets:
        cover_assets.extend(
            [
                CoverAsset(
                    platform="wechat",
                    headline=str(payload["wechat_title"])[:20],
                    subheadline="配图",
                    prompt=cover_prompt,
                    after_paragraph=1,
                    caption="配图",
                    asset_index=0,
                ).model_dump(mode="json"),
                CoverAsset(
                    platform="wechat",
                    headline=str(payload["wechat_title"])[:20],
                    subheadline="细节",
                    prompt=cover_prompt,
                    after_paragraph=4,
                    caption="细节",
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
                    prompt=str(page.get("prompt") or cover_prompt),
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
    payload = _mock_platform_payload(project, project.humanized or project.draft or _mock_humanized(project))
    titles = payload["titles"][:count]  # type: ignore[index]
    return ContentPatch(
        intent="generate_titles",
        target_platforms=["all"],
        summary=f"已生成 {len(titles)} 个标题备选。",
        patch={"titles": [item.model_dump(mode="json") for item in titles]},
    )


def build_mock_cover_assets(project: ContentProject) -> ContentPatch:
    payload = _mock_platform_payload(project, project.humanized or project.draft or "")
    title = project.platforms["wechat"].title or project.title
    cover_prompt = payload.get("cover_prompt", "纪实摄影，暖色生活场景")
    asset = CoverAsset(
        platform="wechat",
        headline=title[:20] or "生活分享",
        subheadline="真实 · 温和 · 有温度",
        prompt=cover_prompt,
    )
    return ContentPatch(
        intent="cover_assets",
        target_platforms=["all"],
        summary="已生成封面文案与配图提示词。",
        patch={"cover_assets": [asset.model_dump(mode="json")]},
    )
