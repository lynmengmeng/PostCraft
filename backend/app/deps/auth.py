from __future__ import annotations

import contextvars
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.database import UserRow, get_db
from app.services.auth import decode_access_token, get_user_by_id

_bearer = HTTPBearer(auto_error=False)
_auth_ctx: contextvars.ContextVar["AuthContext | None"] = contextvars.ContextVar("_auth_ctx", default=None)


@dataclass
class AuthContext:
    user: UserRow | None
    settings: Settings

    @property
    def user_id(self) -> str | None:
        return self.user.id if self.user else None

    @property
    def is_scoped(self) -> bool:
        """When True, data queries must filter by user_id."""
        return self.settings.auth_required or self.user is not None

    def scope_kwargs(self) -> dict[str, str | bool | None]:
        return {"user_id": self.user_id, "scoped": self.is_scoped}


def get_request_auth() -> AuthContext | None:
    return _auth_ctx.get()


def get_scope_kwargs() -> dict[str, str | bool | None]:
    ctx = _auth_ctx.get()
    if not ctx:
        return {"user_id": None, "scoped": False}
    return ctx.scope_kwargs()


def _resolve_user(
    db: Session,
    credentials: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> UserRow | None:
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    payload = decode_access_token(credentials.credentials, settings)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return get_user_by_id(db, str(user_id))


async def get_auth_context(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    user = _resolve_user(db, credentials, settings)
    return AuthContext(user=user, settings=settings)


async def require_auth(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if ctx.settings.auth_required and not ctx.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = _auth_ctx.set(ctx)
    try:
        yield ctx
    finally:
        _auth_ctx.reset(token)
