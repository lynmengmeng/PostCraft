from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.database import get_db
from app.deps.auth import AuthContext, get_auth_context
from app.models.schemas import AuthConfig, LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.services.auth import authenticate_user, create_access_token, create_user, user_count

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/config", response_model=AuthConfig)
def auth_config(settings: Settings = Depends(get_settings)) -> AuthConfig:
    return AuthConfig(
        auth_required=settings.auth_required,
        allow_register=settings.allow_register,
    )


@router.post("/register", response_model=TokenResponse)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    if not settings.allow_register:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前环境不允许自助注册")
    try:
        user = create_user(db, payload.username, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = create_access_token(user.id, user.username, settings)
    return TokenResponse(
        access_token=token,
        user=UserPublic(id=user.id, username=user.username, created_at=user.created_at),
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    token = create_access_token(user.id, user.username, settings)
    return TokenResponse(
        access_token=token,
        user=UserPublic(id=user.id, username=user.username, created_at=user.created_at),
    )


@router.get("/me", response_model=UserPublic)
def me(ctx: AuthContext = Depends(get_auth_context)) -> UserPublic:
    if not ctx.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    return UserPublic(
        id=ctx.user.id,
        username=ctx.user.username,
        created_at=ctx.user.created_at,
    )
