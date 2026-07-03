#!/usr/bin/env python3
"""将登录前创建的历史数据（user_id 为空）归属到指定用户。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.db.database import (  # noqa: E402
    InspirationRow,
    ProjectRow,
    SessionLocal,
    SettingsRow,
    TopicRow,
    init_db,
)
from app.services.auth import get_user_by_username  # noqa: E402

STYLE_KEY = "author_style_profile"


def migrate(username: str) -> int:
    init_db()
    db = SessionLocal()
    try:
        user = get_user_by_username(db, username)
        if not user:
            print(f"Error: user '{username}' not found", file=sys.stderr)
            return 1

        counts: dict[str, int] = {}
        for label, model in (
            ("projects", ProjectRow),
            ("inspirations", InspirationRow),
            ("topics", TopicRow),
        ):
            updated = (
                db.query(model)
                .filter(model.user_id.is_(None))
                .update({model.user_id: user.id}, synchronize_session=False)
            )
            counts[label] = updated

        legacy_style = db.get(SettingsRow, STYLE_KEY)
        user_style_key = f"{STYLE_KEY}:{user.id}"
        if legacy_style and not db.get(SettingsRow, user_style_key):
            legacy_style.key = user_style_key

        db.commit()
        print(f"Migrated data to user '{user.username}' (id={user.id}):")
        for label, count in counts.items():
            print(f"  {label}: {count}")
        if legacy_style:
            print(f"  author_style_profile: migrated")
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy orphan data to a user account")
    parser.add_argument("username", help="Target username, e.g. lyn")
    args = parser.parse_args()
    return migrate(args.username)


if __name__ == "__main__":
    raise SystemExit(main())
