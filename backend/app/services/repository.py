from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from app.config import Settings
from app.models.schemas import (
    AuthorStyleProfile,
    ContentProject,
    ContentPatch,
    Inspiration,
    Topic,
)
from app.db.database import (
    InspirationRow,
    ProjectRow,
    SettingsRow,
    TopicRow,
    dump_json,
    load_json,
)
from sqlalchemy import or_
from sqlalchemy.orm import Query, Session


def _scoped_query(
    query: Query,
    row_class: type,
    user_id: str | None,
    scoped: bool,
) -> Query:
    if not scoped:
        return query
    if not user_id:
        return query.filter(False)
    # 兼容登录前创建的历史数据（user_id 为空）
    return query.filter(or_(row_class.user_id == user_id, row_class.user_id.is_(None)))


def _owns_row(row: ProjectRow | InspirationRow | TopicRow, user_id: str | None, scoped: bool) -> bool:
    if not scoped:
        return True
    if not user_id:
        return False
    return row.user_id == user_id or row.user_id is None


def _adopt_orphan_row(
    row: ProjectRow | InspirationRow | TopicRow,
    user_id: str | None,
    scoped: bool,
) -> None:
    if scoped and user_id and not row.user_id:
        row.user_id = user_id


class ProjectRepository:
    def list_projects(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> list[ContentProject]:
        query = db.query(ProjectRow).order_by(ProjectRow.updated_at.desc())
        rows = _scoped_query(query, ProjectRow, user_id, scoped).all()
        return [ContentProject.model_validate(load_json(row.payload)) for row in rows]

    def get_project(
        self,
        db: Session,
        project_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> ContentProject | None:
        row = db.get(ProjectRow, project_id)
        if not row or not _owns_row(row, user_id, scoped):
            return None
        return ContentProject.model_validate(load_json(row.payload))

    def save_project(
        self,
        db: Session,
        project: ContentProject,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> ContentProject:
        project.updated_at = project.updated_at or project.created_at
        payload = dump_json(project.model_dump(mode="json"))
        row = db.get(ProjectRow, project.id)
        if row:
            if scoped and user_id and row.user_id and row.user_id != user_id:
                raise ValueError("Project not found")
            row.payload = payload
            row.updated_at = project.updated_at
            _adopt_orphan_row(row, user_id, scoped)
        else:
            db.add(
                ProjectRow(
                    id=project.id,
                    user_id=user_id if scoped else None,
                    payload=payload,
                    created_at=project.created_at,
                    updated_at=project.updated_at,
                )
            )
        db.commit()
        return project

    def delete_project(
        self,
        db: Session,
        project_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> bool:
        row = db.get(ProjectRow, project_id)
        if not row or not _owns_row(row, user_id, scoped):
            return False
        db.delete(row)
        db.commit()
        return True


class InspirationRepository:
    def list_all(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> list[Inspiration]:
        query = db.query(InspirationRow).order_by(InspirationRow.created_at.desc())
        rows = _scoped_query(query, InspirationRow, user_id, scoped).all()
        return [Inspiration.model_validate(load_json(row.payload)) for row in rows]

    def get(
        self,
        db: Session,
        inspiration_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> Inspiration | None:
        row = db.get(InspirationRow, inspiration_id)
        if not row or not _owns_row(row, user_id, scoped):
            return None
        return Inspiration.model_validate(load_json(row.payload))

    def create(
        self,
        db: Session,
        inspiration: Inspiration,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> Inspiration:
        db.add(
            InspirationRow(
                id=inspiration.id,
                user_id=user_id if scoped else None,
                payload=dump_json(inspiration.model_dump(mode="json")),
                created_at=inspiration.created_at,
            )
        )
        db.commit()
        return inspiration

    def update(
        self,
        db: Session,
        inspiration: Inspiration,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> Inspiration:
        row = db.get(InspirationRow, inspiration.id)
        if not row or not _owns_row(row, user_id, scoped):
            raise ValueError("Inspiration not found")
        _adopt_orphan_row(row, user_id, scoped)
        row.payload = dump_json(inspiration.model_dump(mode="json"))
        db.commit()
        return inspiration

    def delete(
        self,
        db: Session,
        inspiration_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> bool:
        row = db.get(InspirationRow, inspiration_id)
        if not row or not _owns_row(row, user_id, scoped):
            return False
        db.delete(row)
        db.commit()
        return True

    def bulk_create(
        self,
        db: Session,
        inspirations: list[Inspiration],
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> list[Inspiration]:
        for inspiration in inspirations:
            db.add(
                InspirationRow(
                    id=inspiration.id,
                    user_id=user_id if scoped else None,
                    payload=dump_json(inspiration.model_dump(mode="json")),
                    created_at=inspiration.created_at,
                )
            )
        db.commit()
        return inspirations


class TopicRepository:
    def list_all(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> list[Topic]:
        query = db.query(TopicRow).order_by(TopicRow.updated_at.desc())
        rows = _scoped_query(query, TopicRow, user_id, scoped).all()
        return [Topic.model_validate(load_json(row.payload)) for row in rows]

    def get(
        self,
        db: Session,
        topic_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> Topic | None:
        row = db.get(TopicRow, topic_id)
        if not row or not _owns_row(row, user_id, scoped):
            return None
        return Topic.model_validate(load_json(row.payload))

    def create(
        self,
        db: Session,
        topic: Topic,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> Topic:
        db.add(
            TopicRow(
                id=topic.id,
                user_id=user_id if scoped else None,
                payload=dump_json(topic.model_dump(mode="json")),
                created_at=topic.created_at,
                updated_at=topic.updated_at,
            )
        )
        db.commit()
        return topic

    def update(
        self,
        db: Session,
        topic: Topic,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> Topic:
        row = db.get(TopicRow, topic.id)
        if not row or not _owns_row(row, user_id, scoped):
            raise ValueError("Topic not found")
        _adopt_orphan_row(row, user_id, scoped)
        topic.updated_at = datetime.utcnow()
        row.payload = dump_json(topic.model_dump(mode="json"))
        row.updated_at = topic.updated_at
        db.commit()
        return topic

    def delete(
        self,
        db: Session,
        topic_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> bool:
        row = db.get(TopicRow, topic_id)
        if not row or not _owns_row(row, user_id, scoped):
            return False
        db.delete(row)
        db.commit()
        return True


class StyleRepository:
    STYLE_KEY = "author_style_profile"

    def _key(self, user_id: str | None, scoped: bool) -> str:
        if scoped and user_id:
            return f"{self.STYLE_KEY}:{user_id}"
        return self.STYLE_KEY

    def get(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> AuthorStyleProfile:
        key = self._key(user_id, scoped)
        row = db.get(SettingsRow, key)
        if not row and scoped and user_id:
            row = db.get(SettingsRow, self.STYLE_KEY)
        if not row:
            return AuthorStyleProfile()
        return AuthorStyleProfile.model_validate(load_json(row.payload))

    def save(
        self,
        db: Session,
        profile: AuthorStyleProfile,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> AuthorStyleProfile:
        key = self._key(user_id, scoped)
        payload = dump_json(profile.model_dump(mode="json"))
        row = db.get(SettingsRow, key)
        if row:
            row.payload = payload
        else:
            db.add(SettingsRow(key=key, payload=payload))
        db.commit()
        return profile


project_repo = ProjectRepository()
inspiration_repo = InspirationRepository()
topic_repo = TopicRepository()
style_repo = StyleRepository()


def apply_patch(project: ContentProject, patch: ContentPatch) -> ContentProject:
    data = project.model_dump(mode="python")
    for path, value in patch.patch.items():
        _set_path(data, path, value)
    updated = ContentProject.model_validate(data)
    updated.updated_at = datetime.utcnow()
    return updated


def _set_path(data: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    cursor: Any = data
    for part in parts[:-1]:
        if part not in cursor or not isinstance(cursor[part], dict):
            cursor[part] = {}
        cursor = cursor[part]
    cursor[parts[-1]] = value


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    for pattern in (
        r"```json\s*(.*?)\s*```",
        r"```JSON\s*(.*?)\s*```",
        r"```\s*(.*?)\s*```",
    ):
        match = re.search(pattern, stripped, re.DOTALL)
        if match:
            return match.group(1).strip()
    return stripped


def _extract_balanced_json_object(text: str) -> str | None:
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return None


def _try_load_json_dict(blob: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(blob)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def parse_json_from_text(text: str, *, fallback_key: str | None = None) -> dict[str, Any]:
    """Extract a JSON object from LLM output; optional fallback wraps plain text."""
    if not text or not text.strip():
        if fallback_key:
            return {fallback_key: ""}
        raise ValueError("No JSON object found in model output")

    candidates: list[str] = []
    for variant in (text, _strip_code_fences(text)):
        if variant not in candidates:
            candidates.append(variant)

    for candidate in candidates:
        blob = _extract_balanced_json_object(candidate)
        if not blob:
            continue
        loaded = _try_load_json_dict(blob)
        if loaded is not None:
            return loaded

    if fallback_key and "{" not in text:
        cleaned = _strip_code_fences(text).strip()
        if cleaned:
            return {fallback_key: cleaned}

    if fallback_key:
        cleaned = _strip_code_fences(text).strip()
        if cleaned:
            return {fallback_key: cleaned}

    raise ValueError("No JSON object found in model output")
