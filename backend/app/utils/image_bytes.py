from __future__ import annotations

_IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def detect_image_content_type(content: bytes) -> str | None:
    if len(content) < 12:
        return None
    for prefix, content_type in _IMAGE_SIGNATURES:
        if content.startswith(prefix):
            return content_type
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None
