from __future__ import annotations

from pathlib import Path

from app.config import Settings


class SkillLoader:
    def __init__(self, settings: Settings):
        self.settings = settings

    def load(self, skill_name: str) -> str:
        candidates = [
            self.settings.skills_dir / skill_name / "SKILL.md",
            self.settings.vendor_skills_dir / skill_name / "SKILL.md",
            self.settings.docs_skills_dir / f"{skill_name}.md",
        ]
        for path in candidates:
            if path.exists():
                return path.read_text(encoding="utf-8")
        return self._fallback(skill_name)

    def _fallback(self, skill_name: str) -> str:
        return (
            f"You are executing the `{skill_name}` skill for PostCraft. "
            "Write in a warm, observational Chinese tone. Avoid marketing cliches."
        )
