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


def build_mock_generate_all(project: ContentProject) -> ContentPatch:
    inspiration = project.inspiration or project.title
    wechat_title = f"回村之后，我才看懂：{inspiration[:18]}"
    xhs_title = f"关于{inspiration[:12]}，我想认真说几句"
    hook = f"你有没有发现，{inspiration[:20]}？"

    humanized = (
        f"## 观察\n\n{inspiration}\n\n"
        "这不是危言耸听，而是我在回农村时反复看到的生活细节。"
        "很多风险不是突然降临，而是在日常里被一点点忽略。"
    )

    wechat = WechatContent(
        title=wechat_title,
        summary="从一次回村的经历说起，聊聊被忽视的生活风险。",
        body=(
            f"## 从一个细节说起\n\n{inspiration}\n\n"
            "去年春节回村，我才真正注意到：很多老人并不是突然病倒，"
            "而是长期处在不安全的生活环境里。\n\n"
            "## 三个容易被忽略的原因\n\n"
            "1. 劣质日用品长期接触\n"
            "2. 医疗意识不足，小问题拖成大问题\n"
            "3. 环境污染与生活安全被默认接受\n\n"
            "## 写在最后\n\n"
            "这不是要制造焦虑，而是希望我们都能更认真地看待普通人的生活。"
        ),
    )
    xhs = XiaohongshuContent(
        title=xhs_title,
        body=(
            f"关于「{inspiration[:16]}」，我想分享一点真实观察。\n\n"
            "回农村之前，我以为这些问题离我很远。\n"
            "回去之后才发现，它们就在日常里。\n\n"
            "劣质商品、医疗意识、环境问题，"
            "往往不是某一个原因，而是叠在一起。\n\n"
            "如果你也有类似感受，欢迎评论区聊聊。"
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
        TitleCandidate(text=f"普通家庭最容易忽略的一个风险", style="警醒型"),
    ]

    return ContentPatch(
        intent="generate_all",
        target_platforms=["wechat", "xiaohongshu", "douyin"],
        summary="已生成公众号、小红书、抖音三平台初稿，请在预览区查看。",
        patch={
            "humanized": humanized,
            "draft": humanized,
            "platforms.wechat": wechat.model_dump(mode="json"),
            "platforms.xiaohongshu": xhs.model_dump(mode="json"),
            "platforms.douyin": douyin.model_dump(mode="json"),
            "titles": [item.model_dump(mode="json") for item in titles],
            "cover_assets": [
                CoverAsset(
                    platform="all",
                    headline=wechat_title[:20],
                    subheadline="真实观察 · 温和提醒",
                    prompt="纪实风格，暖色乡村傍晚，真实生活场景，不要明显 AI 感",
                ).model_dump(mode="json")
            ],
        },
        preview_hints=["已更新公众号、小红书、抖音预览"],
    )


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
