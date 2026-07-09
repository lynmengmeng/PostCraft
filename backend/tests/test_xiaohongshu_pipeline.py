from app.services.pipeline import ContentPipeline
from app.services.xiaohongshu_styles import get_style


class _FakeLLM:
    pass


class _FakeSkills:
    def load(self, _name: str) -> str:
        return ""


def test_normalize_xiaohongshu_payload_single_image():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    payload = pipeline._normalize_xiaohongshu_payload(
        {
            "title": "今天的小确幸",
            "body": "回村路上看到晚霞，突然觉得很治愈 🌅",
            "tags": ["生活"],
        }
    )
    assert len(payload["image_pages"]) == 1
    assert payload["image_pages"][0]["role"] == "cover"


def test_normalize_xiaohongshu_payload_builds_image_pages():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    style = get_style("warm_documentary_photography_of_a_rural_sunset_over")
    payload = pipeline._normalize_xiaohongshu_payload(
        {
            "title": "生活观察",
            "body": "第一段共鸣\n\n【要点一】细节说明\n\n【要点二】第二个点",
            "tags": ["#生活观察", "农村"],
        }
    )
    assert payload["cover_style"]
    assert len(payload["image_pages"]) >= 2
    assert len(payload["image_pages"]) <= 6
    assert payload["image_pages"][0]["role"] == "cover"
    assert all(page.get("prompt") for page in payload["image_pages"])
    assert payload["tags"] == ["生活观察", "农村"]


def test_reshape_xiaohongshu_image_pages_to_single():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    body = "开头\n\n【要点一】a\n\n【要点二】b\n\n【要点三】c\n\n评论区聊聊"
    xhs = {
        "title": "干货",
        "body": body,
        "cover_style": "journaling_style",
        "image_pages": [{"page": i, "role": "content"} for i in range(1, 7)],
    }
    reshaped = pipeline.reshape_xiaohongshu_image_pages(xhs, 1)
    assert len(reshaped["image_pages"]) == 1
    assert reshaped["image_pages"][0]["role"] == "cover"


def test_generate_xiaohongshu_carousel_assets():
    pipeline = ContentPipeline(_FakeLLM(), _FakeSkills())  # type: ignore[arg-type]
    from app.models.schemas import ContentProject

    project = ContentProject(inspiration="测试")
    xhs = {
        "title": "测试标题",
        "body": "正文内容",
        "image_pages": [
            {
                "page": 1,
                "role": "cover",
                "headline": "封面",
                "prompt": "封面 prompt",
            },
            {
                "page": 2,
                "role": "content",
                "headline": "要点",
                "prompt": "内容 prompt",
            },
        ],
    }
    assets = pipeline._generate_xiaohongshu_carousel_assets(xhs, project)
    assert len(assets) == 2
    assert all(a["platform"] == "xiaohongshu" for a in assets)
    assert assets[0]["asset_index"] >= 100
