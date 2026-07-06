from __future__ import annotations

from fastapi import HTTPException
from openai import APIStatusError, AuthenticationError


def llm_http_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, AuthenticationError):
        return HTTPException(
            status_code=502,
            detail=(
                "LLM API Key 无效或已过期，请检查 .env 中的 DEEPSEEK_API_KEY / OPENAI_API_KEY "
                "是否与 LLM_PROVIDER 匹配，修改后重启后端。"
            ),
        )
    if isinstance(exc, APIStatusError):
        return HTTPException(
            status_code=502,
            detail=f"LLM 请求失败（{exc.status_code}）",
        )
    return HTTPException(status_code=502, detail=f"LLM 服务异常：{exc}")


def repo_http_exception(exc: ValueError) -> HTTPException:
    message = str(exc)
    if "not found" in message.lower():
        return HTTPException(status_code=404, detail=message)
    return HTTPException(status_code=400, detail=message)
