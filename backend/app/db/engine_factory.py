from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


def build_engine(database_url: str) -> Engine:
    url = database_url.strip()
    if url.startswith("sqlite:"):
        if url.startswith("sqlite:///"):
            db_path = url.removeprefix("sqlite:///")
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, pool_pre_ping=True)


def is_sqlite(database_url: str) -> bool:
    return database_url.strip().startswith("sqlite:")
