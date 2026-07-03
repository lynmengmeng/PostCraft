"""Test configuration — disable auth before app import."""

from __future__ import annotations

import os

os.environ["AUTH_REQUIRED"] = "false"

from app.config import reload_settings

reload_settings()
