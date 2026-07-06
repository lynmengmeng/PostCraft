from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import APIStatusError, AuthenticationError

from app.config import get_settings
from app.db.database import init_db
from app.routers.api import router
from app.routers.auth import router as auth_router
from app.routers.tools import router as tools_router

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(router, prefix=settings.api_prefix)
app.include_router(tools_router, prefix=settings.api_prefix)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(AuthenticationError)
async def openai_auth_handler(_request: Request, exc: AuthenticationError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={
            "detail": (
                "LLM API Key 无效或已过期，请检查 .env 中的 DEEPSEEK_API_KEY / OPENAI_API_KEY。"
            )
        },
    )


@app.exception_handler(APIStatusError)
async def openai_status_handler(_request: Request, exc: APIStatusError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"LLM 请求失败（{exc.status_code}）"})


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"name": settings.app_name, "docs": "/docs"}
