from __future__ import annotations

import base64
import logging
from uuid import uuid4

from openai import APIStatusError, AsyncOpenAI, AuthenticationError

from app.config import Settings
from app.services.openai_transport import build_async_openai_image_client

logger = logging.getLogger(__name__)

# gpt-image-2 @ 1K, 3:4 — 与 studyx backend_openai GPT_IMAGE_2_SIZES["1K"]["3:4"] 一致
GPT_IMAGE_2_XHS_COVER_SIZE = "768x1024"
# 公众号头条封面 2.35:1（1280÷544≈2.35，均为 16 的倍数）
GPT_IMAGE_2_WECHAT_COVER_SIZE = "1280x544"

CoverAspect = str  # "wechat" | "xhs"


class ImageGenerator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.output_dir = settings.images_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.image_model = settings.openai_image_model or "gpt-image-2"
        self.api_key = settings.openai_api_key.strip()
        self.base_url = settings.openai_base_url.strip()
        self.client = (
            build_async_openai_image_client(
                settings,
                api_key=self.api_key,
                base_url=self.base_url,
            )
            if self.api_key
            else None
        )

    @property
    def configured(self) -> bool:
        return self.client is not None

    async def generate(self, prompt: str, *, aspect: CoverAspect = "wechat") -> str:
        if not self.client:
            return self._local_placeholder(aspect)

        try:
            return await self._generate_with_client(self.client, prompt, aspect)
        except AuthenticationError as exc:
            message = str(exc)
            if "ip_not_authorized" in message:
                logger.warning(
                    "Cover image generation failed: 当前 IP 未在 OpenAI API Key 白名单中 (%s)。"
                    "请到 platform.openai.com → API keys → 编辑 Key → 添加本机 IP 或关闭 IP 限制。",
                    exc,
                )
            else:
                logger.warning(
                    "Cover image generation failed: OpenAI API Key 无效 (%s)。"
                    "请核对 config/api_keys.local.json 或 .env 中的 OPENAI_API_KEY。",
                    exc,
                )
        except APIStatusError as exc:
            logger.warning("Cover image generation failed (%s), using placeholder", exc)
        except Exception as exc:
            logger.warning("Cover image generation failed (%s), using placeholder", exc)

        return self._local_placeholder(aspect)

    async def _generate_with_client(
        self,
        client: AsyncOpenAI,
        prompt: str,
        aspect: CoverAspect,
    ) -> str:
        size = GPT_IMAGE_2_WECHAT_COVER_SIZE if aspect == "wechat" else GPT_IMAGE_2_XHS_COVER_SIZE
        response = await client.images.generate(
            model=self.image_model,
            prompt=prompt[:900],
            size=size,
            quality="medium",
            n=1,
        )
        image_b64 = response.data[0].b64_json
        if not image_b64 and response.data[0].url:
            return response.data[0].url
        if not image_b64:
            raise RuntimeError("OpenAI image response missing b64_json and url")
        filename = f"{uuid4().hex}.png"
        path = self.output_dir / filename
        path.write_bytes(base64.b64decode(image_b64))
        return f"/api/images/{filename}"

    def _local_placeholder(self, aspect: CoverAspect = "wechat") -> str:
        filename = f"placeholder-{uuid4().hex}.svg"
        path = self.output_dir / filename
        if aspect == "wechat":
            width, height = 1280, 544
        else:
            width, height = 600, 800
        svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <rect width="{width}" height="{height}" fill="#f5f5f4"/>
  <rect x="40" y="40" width="{width - 80}" height="{height - 80}" rx="16" fill="#e7e5e4" stroke="#d6d3d1"/>
  <text x="{width // 2}" y="{height // 2 - 20}" fill="#78716c" font-size="28" text-anchor="middle" font-family="sans-serif">封面占位</text>
  <text x="{width // 2}" y="{height // 2 + 30}" fill="#a8a29e" font-size="16" text-anchor="middle" font-family="sans-serif">OpenAI 配图 API 暂不可用</text>
  <text x="{width // 2}" y="{height // 2 + 60}" fill="#a8a29e" font-size="14" text-anchor="middle" font-family="sans-serif">请检查 OPENAI_API_KEY 与网络</text>
</svg>"""
        path.write_text(svg, encoding="utf-8")
        return f"/api/images/{filename}"

    def save_upload(self, content: bytes, content_type: str) -> str:
        allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
        if content_type not in allowed:
            raise ValueError("仅支持 JPEG、PNG、WebP、GIF 图片")
        if len(content) > 5 * 1024 * 1024:
            raise ValueError("图片大小不能超过 5MB")

        ext_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        filename = f"{uuid4().hex}{ext_map[content_type]}"
        path = self.output_dir / filename
        path.write_bytes(content)
        return f"/api/images/{filename}"
