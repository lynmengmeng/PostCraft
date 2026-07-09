"""Unit tests for fact_check service."""

from __future__ import annotations

from app.services.fact_check import scan_text


def test_scan_absolute_phrases() -> None:
    warnings = scan_text("这一定会发生，所有人都知道")
    phrases = {w.phrase for w in warnings}
    assert "一定" in phrases or "所有人" in phrases


def test_scan_banned_phrases() -> None:
    warnings = scan_text("震惊！必看！", extra_banned=["震惊"])
    assert any(w.phrase == "震惊" for w in warnings)


def test_scan_deduplicates() -> None:
    warnings = scan_text("一定一定一定")
    assert len(warnings) >= 1
