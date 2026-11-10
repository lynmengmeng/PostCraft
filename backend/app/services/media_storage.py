from __future__ import annotations

import logging
import mimetypes
from functools import lru_cache

from app.config import Settings

logger = logging.getLogger(__name__)


@lru_cache
def _supabase_client(url: str, key: str):
    from supabase import create_client

    return create_client(url, key)


def upload_image_bytes(
    settings: Settings,
    *,
    filename: str,
    content: bytes,
    content_type: str,
) -> str:
    """Upload to Supabase Storage; return public URL."""
    if not settings.use_supabase_storage:
        raise RuntimeError("Supabase Storage 未配置")

    bucket = settings.supabase_storage_bucket.strip() or "postcraft-images"
    client = _supabase_client(
        settings.supabase_url.strip(),
        settings.supabase_service_role_key.strip(),
    )
    storage_path = f"images/{filename}"
    file_options = {"content-type": content_type or "application/octet-stream", "upsert": "true"}
    client.storage.from_(bucket).upload(storage_path, content, file_options=file_options)
    public = client.storage.from_(bucket).get_public_url(storage_path)
    return public.rstrip("?")


def persist_local_image(
    settings: Settings,
    *,
    filename: str,
    content: bytes,
    content_type: str,
) -> str:
    """Write to local disk; optionally mirror to Supabase and return public URL."""
    settings.images_dir.mkdir(parents=True, exist_ok=True)
    path = settings.images_dir / filename
    path.write_bytes(content)

    if settings.use_supabase_storage:
        try:
            return upload_image_bytes(
                settings,
                filename=filename,
                content=content,
                content_type=content_type,
            )
        except Exception as exc:
            logger.warning("Supabase upload failed (%s), using local /api/images URL", exc)

    return f"/api/images/{filename}"


def guess_content_type(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"
