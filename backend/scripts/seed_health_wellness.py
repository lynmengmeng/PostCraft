#!/usr/bin/env python3
"""导入心理 + 身体健康方向的栏目、选题与作者风格预设。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.presets.health_wellness_seed import apply_health_wellness_seed  # noqa: E402
from app.db.database import SessionLocal, init_db  # noqa: E402
from app.services.auth import get_user_by_username  # noqa: E402


def seed_health_wellness(
    *,
    username: str | None = None,
    force_style: bool = False,
) -> int:
    init_db()
    db = SessionLocal()
    user_id: str | None = None
    scoped = False

    try:
        if username:
            user = get_user_by_username(db, username)
            if not user:
                print(f"Error: user '{username}' not found", file=sys.stderr)
                return 1
            user_id = user.id
            scoped = True
            print(f"Seeding for user '{user.username}' (id={user.id})")
        else:
            print("Seeding global (unscoped) data")

        stats = apply_health_wellness_seed(
            db,
            user_id=user_id,
            scoped=scoped,
            force_style=force_style,
        )
        print(
            f"  categories: +{stats['categories_created']} "
            f"(skip {stats['categories_skipped']})"
        )
        print(f"  topics: +{stats['topics_created']} (skip {stats['topics_skipped']})")
        if stats["style_updated"]:
            print("  author style profile: updated")
        else:
            print("  author style profile: skipped (use --force-style to overwrite)")

        print("\nDone.")
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed health & wellness content pillars and topic templates",
    )
    parser.add_argument(
        "--username",
        "-u",
        help="Target user (recommended when auth is enabled)",
    )
    parser.add_argument(
        "--force-style",
        action="store_true",
        help="Overwrite author style profile even if already configured",
    )
    args = parser.parse_args()
    return seed_health_wellness(username=args.username, force_style=args.force_style)


if __name__ == "__main__":
    raise SystemExit(main())
