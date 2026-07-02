from __future__ import annotations

import base64
import logging
from uuid import uuid4

from openai import APIStatusError

from app.config import Settings
from app.services.openai_transport import build_async_openai_client

logger = logging.getLogger(__name__)

# gpt-image-2 @ 1K, 3:4 — suitable for Xiaohongshu-style covers
GPT_IMAGE_2_COVER_SIZE = "768x1024"


class ImageGenerator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.output_dir = settings.images_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.image_model = settings.openai_image_model or "gpt-image-2"
        self.client = (
            build_async_openai_client(
                settings,
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
            )
            if settings.openai_api_key
            else None
        )

    @property
    def configured(self) -> bool:
        return self.client is not None

    async def generate(self, prompt: str) -> str:
        if not self.client:
            return self._placeholder(prompt)

        try:
            response = await self.client.images.generate(
                model=self.image_model,
                prompt=prompt[:900],
                size=GPT_IMAGE_2_COVER_SIZE,
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
        except APIStatusError as exc:
            logger.warning("Cover image generation failed (%s), using placeholder", exc)
            return self._placeholder(prompt)
        except Exception as exc:
            logger.warning("Cover image generation failed (%s), using placeholder", exc)
            return self._placeholder(prompt)

    def _placeholder(self, prompt: str) -> str:
        from urllib.parse import quote

        text = quote(prompt[:16] or "cover")
        return f"https://placehold.co/600x800/f5f5f4/78716c?text={text}"

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
