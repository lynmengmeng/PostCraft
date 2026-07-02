from __future__ import annotations

import httpx
from openai import AsyncOpenAI

from app.config import Settings


def openai_skip_proxy_enabled(settings: Settings) -> bool:
    return str(settings.openai_skip_proxy).strip().lower() in ("1", "true", "yes", "on")


def build_async_openai_client(
    settings: Settings,
    *,
    api_key: str,
    base_url: str,
) -> AsyncOpenAI:
    if openai_skip_proxy_enabled(settings):
        http_client = httpx.AsyncClient(
            proxy=None,
            trust_env=False,
            timeout=httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=5.0),
            follow_redirects=True,
        )
        return AsyncOpenAI(api_key=api_key, base_url=base_url, http_client=http_client)
    return AsyncOpenAI(api_key=api_key, base_url=base_url)
