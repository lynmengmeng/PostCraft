from __future__ import annotations

import base64
from uuid import uuid4

from openai import AsyncOpenAI

from app.config import Settings


class ImageGenerator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.output_dir = settings.images_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.client = (
            AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
            if settings.openai_api_key
            else None
        )

    @property
    def configured(self) -> bool:
        return self.client is not None

    async def generate(self, prompt: str) -> str:
        if not self.client:
            return self._placeholder(prompt)

        response = await self.client.images.generate(
            model="dall-e-3",
            prompt=prompt[:900],
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json",
        )
        image_b64 = response.data[0].b64_json
        filename = f"{uuid4().hex}.png"
        path = self.output_dir / filename
        path.write_bytes(base64.b64decode(image_b64))
        return f"/api/images/{filename}"

    def _placeholder(self, prompt: str) -> str:
        from urllib.parse import quote

        text = quote(prompt[:16] or "cover")
        return f"https://placehold.co/600x800/f5f5f4/78716c?text={text}"
