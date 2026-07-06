import asyncio

from app.models.schemas import ContentProject, CoverAsset, XiaohongshuContent
from app.services.pipeline import ContentPipeline
from app.services.xiaohongshu_assets import (
    ensure_xiaohongshu_carousel_assets,
    generate_xiaohongshu_carousel,
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
    assert len(xhs_assets) >= 3


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
