from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from openai import APIStatusError, AsyncOpenAI

from app.config import Settings
from app.models.schemas import LLMStatus
from app.services.openai_transport import build_async_openai_client

logger = logging.getLogger(__name__)


def _provider_configs(settings: Settings) -> list[tuple[str, str, str, str]]:
    """Return configured providers in priority order (LLM_PROVIDER first)."""
    primary = settings.llm_provider.lower()
    order = [primary, *[p for p in ("deepseek", "openai") if p != primary]]
    configs: list[tuple[str, str, str, str]] = []
    for provider in order:
        if provider == "deepseek" and settings.deepseek_api_key:
            configs.append(
                (
                    "deepseek",
                    settings.deepseek_api_key,
                    settings.deepseek_base_url,
                    settings.deepseek_model,
                )
            )
        elif provider == "openai" and settings.openai_api_key:
            configs.append(
                (
                    "openai",
                    settings.openai_api_key,
                    settings.openai_base_url,
                    settings.openai_model,
                )
            )
    return configs


class LLMClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._configs = _provider_configs(settings)
        if self._configs:
            self.provider, self.api_key, self.base_url, self.model = self._configs[0]
            self.client = self._build_client(self.provider, self.api_key, self.base_url)
        else:
            self.provider, self.api_key, self.base_url, self.model = ("mock", "", "", "")
            self.client = None

    def _build_client(self, provider: str, api_key: str, base_url: str) -> AsyncOpenAI:
        if provider == "openai":
            return build_async_openai_client(self.settings, api_key=api_key, base_url=base_url)
        return AsyncOpenAI(api_key=api_key, base_url=base_url)

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
        json_mode: bool = False,
    ) -> str:
        if not self._configs:
            return json.dumps(
                {
                    "summary": "当前未配置 LLM API Key，已使用本地模板生成。",
                    "patch": {},
                },
                ensure_ascii=False,
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        last_exc: Exception | None = None
        for provider, api_key, base_url, model in self._configs:
            client = self._build_client(provider, api_key, base_url)
            for use_json_mode in ([True, False] if json_mode else [False]):
                try:
                    kwargs: dict[str, Any] = {
                        "model": model,
                        "temperature": temperature,
                        "messages": messages,
                    }
                    if use_json_mode:
                        kwargs["response_format"] = {"type": "json_object"}
                    response = await client.chat.completions.create(**kwargs)
                    return response.choices[0].message.content or ""
                except APIStatusError as exc:
                    last_exc = exc
                    if use_json_mode:
                        logger.warning(
                            "LLM provider %r json_mode failed (%s), retrying plain",
                            provider,
                            exc,
                        )
                        continue
                    logger.warning("LLM provider %r failed (%s), trying fallback", provider, exc)
                    break
                except Exception as exc:
                    last_exc = exc
                    if use_json_mode:
                        logger.warning(
                            "LLM provider %r json_mode failed (%s), retrying plain",
                            provider,
                            exc,
                        )
                        continue
                    logger.warning("LLM provider %r failed (%s), trying fallback", provider, exc)
                    break

        if last_exc:
            raise last_exc
        raise RuntimeError("All LLM providers failed")

    async def stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        if not self._configs:
            yield "当前未配置 LLM API Key，已使用本地模板生成。"
            return

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        last_exc: Exception | None = None
        for provider, api_key, base_url, model in self._configs:
            client = self._build_client(provider, api_key, base_url)
            try:
                stream = await client.chat.completions.create(
                    model=model,
                    temperature=temperature,
                    stream=True,
                    messages=messages,
                )
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        yield delta
                return
            except APIStatusError as exc:
                last_exc = exc
                logger.warning("LLM stream provider %r failed (%s), trying fallback", provider, exc)
            except Exception as exc:
                last_exc = exc
                logger.warning("LLM stream provider %r failed (%s), trying fallback", provider, exc)

        if last_exc:
            raise last_exc
        raise RuntimeError("All LLM providers failed")
