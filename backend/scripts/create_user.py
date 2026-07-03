#!/usr/bin/env python3
"""Create a PostCraft user (for test/production when ALLOW_REGISTER=false)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.services.auth import create_user  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a PostCraft user account")
    parser.add_argument("username", help="Username (min 3 chars)")
    parser.add_argument("password", help="Password (min 6 chars)")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        user = create_user(db, args.username, args.password)
        print(f"Created user: {user.username} (id={user.id})")
        return 0
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
