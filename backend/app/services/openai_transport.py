from __future__ import annotations

import os

import httpx
from openai import AsyncOpenAI

from app.config import Settings

# 与 studyx-agent-backend/app/openai_transport.py 对齐
_DEFAULT_CONNECT = 180.0
_DEFAULT_READ = 900.0
_DEFAULT_WRITE = 180.0


def proxy_from_environment() -> str:
    return (
        os.environ.get("DEV_HTTP_PROXY", "").strip()
        or os.environ.get("HTTPS_PROXY", "").strip()
        or os.environ.get("HTTP_PROXY", "").strip()
        or os.environ.get("https_proxy", "").strip()
        or os.environ.get("http_proxy", "").strip()
    )


def openai_skip_proxy_enabled(settings: Settings) -> bool:
    return str(settings.openai_skip_proxy).strip().lower() in ("1", "true", "yes", "on")


def _openai_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=_DEFAULT_CONNECT,
        read=_DEFAULT_READ,
        write=_DEFAULT_WRITE,
        pool=30.0,
    )


def build_async_openai_client(
    settings: Settings,
    *,
    api_key: str,
    base_url: str,
) -> AsyncOpenAI:
    """LLM Chat API：可 bypass 本地代理（openai_skip_proxy）。"""
    timeout = _openai_timeout()
    if openai_skip_proxy_enabled(settings):
        http_client = httpx.AsyncClient(
            proxy=None,
            trust_env=False,
            timeout=timeout,
            follow_redirects=True,
        )
        return AsyncOpenAI(api_key=api_key, base_url=base_url, http_client=http_client)

    proxy = proxy_from_environment() or None
    http_client = httpx.AsyncClient(
        proxy=proxy,
        timeout=timeout,
        follow_redirects=True,
    )
    return AsyncOpenAI(api_key=api_key, base_url=base_url, http_client=http_client)


def build_async_openai_image_client(
    settings: Settings,
    *,
    api_key: str,
    base_url: str,
) -> AsyncOpenAI:
    """
    配图 API：对齐 studyx ppt-master backend_openai。
    不使用 LLM 的 skip_proxy httpx；skip_proxy 时走 SDK 默认直连。
    """
    timeout = _openai_timeout()
    if openai_skip_proxy_enabled(settings):
        return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    proxy = proxy_from_environment() or None
    http_client = httpx.AsyncClient(
        proxy=proxy,
        timeout=timeout,
        follow_redirects=True,
    )
    return AsyncOpenAI(api_key=api_key, base_url=base_url, http_client=http_client)
