from __future__ import annotations

import json
from typing import AsyncIterator

from openai import AsyncOpenAI

from app.config import Settings
from app.models.schemas import LLMStatus


class LLMClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.provider, self.api_key, self.base_url, self.model = settings.resolve_provider()
        self.client = (
            AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
            if self.provider != "mock"
            else None
        )

    def status(self) -> LLMStatus:
        return LLMStatus(
            provider=self.provider,
            model=self.model if self.provider != "mock" else "mock",
            configured=self.provider != "mock",
        )

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
    ) -> str:
        if not self.client:
            return json.dumps(
                {
                    "summary": "当前未配置 LLM API Key，已使用本地模板生成。",
                    "patch": {},
                },
                ensure_ascii=False,
            )

        response = await self.client.chat.completions.create(
            model=self.model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content or ""

    async def stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        if not self.client:
            yield "当前未配置 LLM API Key，已使用本地模板生成。"
            return

        stream = await self.client.chat.completions.create(
            model=self.model,
            temperature=temperature,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
