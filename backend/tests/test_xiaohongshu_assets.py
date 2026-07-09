import asyncio

from app.models.schemas import ContentProject, CoverAsset, XiaohongshuContent
from app.services.pipeline import ContentPipeline
from app.services.xiaohongshu_assets import (
    ensure_xiaohongshu_carousel_assets,
    generate_xiaohongshu_carousel,
    sync_xhs_carousel_plan,
    sync_xiaohongshu_from_assets,
)


class _FakeLLM:
    pass


class _FakeSkills:
    def load(self, _name: str) -> str:
        return ""


class _FakeGenerator:
    def __init__(self):
        self.calls = 0

    async def generate(self, prompt: str, *, aspect: str = "wechat") -> str:
        self.calls += 1
        return f"/api/images/generated-{self.calls}.png"


def test_generate_xiaohongshu_carousel_batch():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    project = ContentProject(
        inspiration="测试",
        platforms={
            "xiaohongshu": XiaohongshuContent(
                title="生活观察",
                body="第一段\n\n【要点一】细节\n\n【要点二】第二个点",
                tags=["生活"],
            )
        },
        cover_assets=[
            CoverAsset(
                platform="xiaohongshu",
                headline="封面",
                prompt="封面 prompt",
                asset_index=100,
                source="placeholder",
            ),
            CoverAsset(
                platform="xiaohongshu",
                headline="要点",
                prompt="内容 prompt",
                asset_index=101,
                after_paragraph=1,
                source="placeholder",
            ),
        ],
    )
    generator = _FakeGenerator()

    updated, generated = asyncio.run(
        generate_xiaohongshu_carousel(project, generator, pipeline)
    )

    assert generated == 2
    assert generator.calls == 2
    assert updated.platforms["xiaohongshu"].carousel_images == [
        "/api/images/generated-1.png",
        "/api/images/generated-2.png",
    ]
    assert updated.platforms["xiaohongshu"].cover_image == "/api/images/generated-1.png"
    assert all(a.source == "generated" for a in updated.cover_assets if a.platform == "xiaohongshu")


def test_ensure_xiaohongshu_carousel_assets_creates_from_body():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    project = ContentProject(
        inspiration="测试",
        platforms={
            "xiaohongshu": XiaohongshuContent(
                title="标题",
                body="正文第一段\n\n【要点一】说明",
            )
        },
    )
    assets = ensure_xiaohongshu_carousel_assets(project, pipeline)
    xhs_assets = [a for a in assets if a.platform == "xiaohongshu"]
    assert 1 <= len(xhs_assets) <= 6


def test_ensure_xiaohongshu_carousel_single_image_body():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    project = ContentProject(
        inspiration="测试",
        platforms={
            "xiaohongshu": XiaohongshuContent(
                title="小确幸",
                body="今天晚霞很美，心情一下子好了起来 🌅",
            )
        },
    )
    assets = ensure_xiaohongshu_carousel_assets(project, pipeline)
    xhs_assets = [a for a in assets if a.platform == "xiaohongshu"]
    assert len(xhs_assets) == 1


def test_sync_xhs_carousel_plan_refines_single_image_copy():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    title = "夏夜太短，5个让夜晚变长的幸福提案"
    body = "白天属于责任，夜晚才真正属于自己。与其刷短视频消耗时间，不如试试这些让夏夜变得舒展的方法。"
    project = ContentProject(
        inspiration="测试",
        platforms={
            "xiaohongshu": XiaohongshuContent(
                title=title,
                body=body,
                image_pages=[],
            )
        },
        cover_assets=[
            CoverAsset(
                platform="xiaohongshu",
                headline=title,
                subheadline=body,
                prompt="old prompt",
                asset_index=100,
                source="placeholder",
            )
        ],
    )
    synced = sync_xhs_carousel_plan(project, pipeline)
    xhs_assets = [a for a in synced.cover_assets if a.platform == "xiaohongshu"]
    assert len(xhs_assets) == 1
    assert len(xhs_assets[0].headline) <= 14
    assert xhs_assets[0].headline.endswith("提案")
    assert len(xhs_assets[0].subheadline) <= 20
    assert title not in xhs_assets[0].prompt
    assert "变长的幸" not in xhs_assets[0].prompt
    assert synced.platforms["xiaohongshu"].image_pages[0].body_text == ""


def test_sync_xiaohongshu_from_assets():
    project = ContentProject(
        cover_assets=[
            CoverAsset(platform="xiaohongshu", image_url="/a.png", asset_index=100),
            CoverAsset(platform="xiaohongshu", image_url="/b.png", asset_index=101, after_paragraph=1),
        ]
    )
    sync_xiaohongshu_from_assets(project)
    assert project.platforms["xiaohongshu"].carousel_images == ["/a.png", "/b.png"]
    assert project.platforms["xiaohongshu"].cover_image == "/a.png"
