from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.database import UserRow
from app.models.schemas import new_id

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, username: str, settings: Settings | None = None) -> str:
    cfg = settings or get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=cfg.jwt_expire_minutes)
    payload = {"sub": user_id, "username": username, "exp": expire}
    return jwt.encode(payload, cfg.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any] | None:
    cfg = settings or get_settings()
    try:
        return jwt.decode(token, cfg.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None


def get_user_by_username(db: Session, username: str) -> UserRow | None:
    normalized = username.strip().lower()
    return db.query(UserRow).filter(UserRow.username == normalized).first()


def get_user_by_id(db: Session, user_id: str) -> UserRow | None:
    return db.get(UserRow, user_id)


def create_user(db: Session, username: str, password: str) -> UserRow:
    normalized = username.strip().lower()
    if len(normalized) < 3:
        raise ValueError("用户名至少 3 个字符")
    if len(password) < 6:
        raise ValueError("密码至少 6 个字符")
    if get_user_by_username(db, normalized):
        raise ValueError("用户名已存在")

    now = datetime.utcnow()
    user = UserRow(
        id=new_id(),
        username=normalized,
        password_hash=hash_password(password),
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> UserRow | None:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def user_count(db: Session) -> int:
    return db.query(UserRow).count()
