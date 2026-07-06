from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException


def resolve_image_path(images_dir: Path, filename: str) -> Path:
    """Resolve a safe image path under images_dir; reject traversal."""
    if not filename or filename != Path(filename).name:
        raise HTTPException(status_code=404, detail="Image not found")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=404, detail="Image not found")

    base = images_dir.resolve()
    path = (base / filename).resolve()
    if not path.is_relative_to(base):
        raise HTTPException(status_code=404, detail="Image not found")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return path
