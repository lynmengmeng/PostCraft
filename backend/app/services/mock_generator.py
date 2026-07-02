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
    return (
        f"## 观察\n\n{inspiration}\n\n"
        "这不是危言耸听，而是我在回农村时反复看到的生活细节。"
        "很多风险不是突然降临，而是在日常里被一点点忽略。"
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
            "去年春节回村，我才真正注意到：很多老人并不是突然病倒，"
            "而是长期处在不安全的生活环境里。\n\n"
            "## 三个容易被忽略的原因\n\n"
            "1. **劣质日用品长期接触**——三无产品在农村仍很常见\n"
            "2. **医疗意识不足**——小问题拖成大问题\n"
            "3. **环境问题被默认接受**——安全与健康被当作「没办法」\n\n"
            "> 这不是要制造焦虑，而是希望我们都能更认真地看待普通人的生活。\n\n"
            "## 写在最后\n\n"
            "如果你也有类似观察，欢迎在评论区聊聊。"
        ),
    )
    xhs = XiaohongshuContent(
        title=xhs_title,
        body=(
            f"关于「{inspiration[:16]}」，我想分享一点真实观察 🌾\n\n"
            "回农村之前，我以为这些问题离我很远。\n"
            "回去之后才发现，它们就在日常里。\n\n"
            "劣质商品、医疗意识、环境问题——\n"
            "往往不是某一个原因，而是叠在一起。\n\n"
            "· 劣质日用品还在流通\n"
            "· 小问题容易被忽视\n"
            "· 环境安全被默认接受\n\n"
            "如果你也有类似感受，评论区聊聊 👇"
        ),
        tags=["生活观察", "农村生活", "健康提醒"],
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
    if with_titles or len(targets) >= 3:
        patch["titles"] = [item.model_dump(mode="json") for item in payload["titles"]]  # type: ignore[index]
        patch["cover_assets"] = [
            CoverAsset(
                platform="all",
                headline=str(payload["wechat_title"])[:20],
                subheadline="真实观察 · 温和提醒",
                prompt="纪实风格，暖色乡村傍晚，真实生活场景，不要明显 AI 感",
            ).model_dump(mode="json")
        ]
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
        platform="all",
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
