#!/usr/bin/env python3
"""将本地 SQLite + data/images 迁移到 Supabase（PostgreSQL + Storage）。"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.db.database import (
    Base,
    InspirationRow,
    ProjectRow,
    SettingsRow,
    TopicRow,
    UserRow,
)
from app.db.engine_factory import build_engine
from app.services.media_storage import guess_content_type, upload_image_bytes

IMAGE_REF = re.compile(r"/api/images/([A-Za-z0-9._-]+)")


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"缺少环境变量 {name}")
    return value


def copy_rows(source: Session, target: Session, model: type) -> int:
    target.query(model).delete()
    target.commit()
    rows = source.query(model).all()
    for row in rows:
        target.merge(
            model(
                **{
                    col.name: getattr(row, col.name)
                    for col in row.__table__.columns
                }
            )
        )
    target.commit()
    return len(rows)


def rewrite_payload_urls(payload: str, url_map: dict[str, str]) -> str:
    if not url_map or "/api/images/" not in payload:
        return payload

    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        return url_map.get(name, match.group(0))

    return IMAGE_REF.sub(repl, payload)


def migrate_images(settings: Settings, images_dir: Path, dry_run: bool) -> dict[str, str]:
    url_map: dict[str, str] = {}
    if not images_dir.is_dir():
        return url_map
    for path in sorted(images_dir.iterdir()):
        if not path.is_file():
            continue
        name = path.name
        if dry_run:
            url_map[name] = f"https://example.invalid/storage/images/{name}"
            continue
        content = path.read_bytes()
        public_url = upload_image_bytes(
            settings,
            filename=name,
            content=content,
            content_type=guess_content_type(name),
        )
        url_map[name] = public_url
        print(f"  [upload] {name}")
    return url_map


def apply_url_map(target: Session, url_map: dict[str, str]) -> None:
    if not url_map:
        return
    for row in target.query(ProjectRow).all():
        row.payload = rewrite_payload_urls(row.payload, url_map)
    for row in target.query(InspirationRow).all():
        row.payload = rewrite_payload_urls(row.payload, url_map)
    for row in target.query(TopicRow).all():
        row.payload = rewrite_payload_urls(row.payload, url_map)
    for row in target.query(SettingsRow).all():
        row.payload = rewrite_payload_urls(row.payload, url_map)
    target.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate PostCraft SQLite data to Supabase Postgres")
    parser.add_argument(
        "--sqlite",
        default=str(ROOT / "data" / "postcraft.db"),
        help="Source SQLite file (default: repo data/postcraft.db)",
    )
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Only migrate database rows, not images",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count rows and list images without writing to Supabase",
    )
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite).resolve()
    if not sqlite_path.is_file():
        print(f"Error: SQLite not found: {sqlite_path}", file=sys.stderr)
        return 1

    if args.dry_run:
        with sessionmaker(bind=build_engine(f"sqlite:///{sqlite_path.as_posix()}"))() as src:
            print("Dry run — source counts:")
            for label, model in (
                ("users", UserRow),
                ("projects", ProjectRow),
                ("inspirations", InspirationRow),
                ("topics", TopicRow),
                ("settings", SettingsRow),
            ):
                print(f"  {label}: {src.query(model).count()}")
        images_dir = ROOT / "data" / "images"
        count = sum(1 for p in images_dir.iterdir() if p.is_file()) if images_dir.is_dir() else 0
        print(f"  image files: {count}")
        return 0

    target_url = _require_env("DATABASE_URL")
    if target_url.startswith("sqlite:"):
        print("Error: DATABASE_URL 必须是 Supabase PostgreSQL 连接串", file=sys.stderr)
        return 1

    settings = Settings(
        database_url=target_url,
        supabase_url=os.environ.get("SUPABASE_URL", "").strip(),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        supabase_storage_bucket=os.environ.get("SUPABASE_STORAGE_BUCKET", "postcraft-images").strip(),
        image_storage="supabase" if os.environ.get("SUPABASE_SERVICE_ROLE_KEY") else "local",
    )

    if not args.skip_images and not settings.use_supabase_storage:
        print(
            "Warning: 未配置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY，将跳过图片上传",
            file=sys.stderr,
        )

    src_engine = build_engine(f"sqlite:///{sqlite_path.as_posix()}")
    dst_engine = build_engine(target_url)
    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)

    print("==> Creating schema on Supabase Postgres")
    Base.metadata.create_all(bind=dst_engine)

    with SrcSession() as src, DstSession() as dst:
        print("==> Copying tables")
        for label, model in (
            ("users", UserRow),
            ("projects", ProjectRow),
            ("inspirations", InspirationRow),
            ("topics", TopicRow),
            ("settings", SettingsRow),
        ):
            count = copy_rows(src, dst, model)
            print(f"  {label}: {count}")

        if not args.skip_images and settings.use_supabase_storage:
            print("==> Uploading images to Supabase Storage")
            url_map = migrate_images(settings, ROOT / "data" / "images", dry_run=False)
            print(f"  uploaded: {len(url_map)}")
            print("==> Rewriting image URLs in payloads")
            apply_url_map(dst, url_map)

    print("\nDone. Set in .env for daily use:")
    print("  DATABASE_URL=<same postgres url>")
    print("  SUPABASE_URL=https://fajfbidwctcjwrhtvdvs.supabase.co")
    print("  SUPABASE_SERVICE_ROLE_KEY=<service role>")
    print("  IMAGE_STORAGE=supabase")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
