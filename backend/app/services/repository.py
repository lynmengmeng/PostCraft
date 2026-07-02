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
from sqlalchemy.orm import Session


class ProjectRepository:
    def list_projects(self, db: Session) -> list[ContentProject]:
        rows = db.query(ProjectRow).order_by(ProjectRow.updated_at.desc()).all()
        return [ContentProject.model_validate(load_json(row.payload)) for row in rows]

    def get_project(self, db: Session, project_id: str) -> ContentProject | None:
        row = db.get(ProjectRow, project_id)
        if not row:
            return None
        return ContentProject.model_validate(load_json(row.payload))

    def save_project(self, db: Session, project: ContentProject) -> ContentProject:
        project.updated_at = project.updated_at or project.created_at
        payload = dump_json(project.model_dump(mode="json"))
        row = db.get(ProjectRow, project.id)
        if row:
            row.payload = payload
            row.updated_at = project.updated_at
        else:
            db.add(
                ProjectRow(
                    id=project.id,
                    payload=payload,
                    created_at=project.created_at,
                    updated_at=project.updated_at,
                )
            )
        db.commit()
        return project

    def delete_project(self, db: Session, project_id: str) -> bool:
        row = db.get(ProjectRow, project_id)
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True


class InspirationRepository:
    def list_all(self, db: Session) -> list[Inspiration]:
        rows = db.query(InspirationRow).order_by(InspirationRow.created_at.desc()).all()
        return [Inspiration.model_validate(load_json(row.payload)) for row in rows]

    def get(self, db: Session, inspiration_id: str) -> Inspiration | None:
        row = db.get(InspirationRow, inspiration_id)
        if not row:
            return None
        return Inspiration.model_validate(load_json(row.payload))

    def create(self, db: Session, inspiration: Inspiration) -> Inspiration:
        db.add(
            InspirationRow(
                id=inspiration.id,
                payload=dump_json(inspiration.model_dump(mode="json")),
                created_at=inspiration.created_at,
            )
        )
        db.commit()
        return inspiration

    def update(self, db: Session, inspiration: Inspiration) -> Inspiration:
        row = db.get(InspirationRow, inspiration.id)
        if not row:
            raise ValueError("Inspiration not found")
        row.payload = dump_json(inspiration.model_dump(mode="json"))
        db.commit()
        return inspiration

    def delete(self, db: Session, inspiration_id: str) -> bool:
        row = db.get(InspirationRow, inspiration_id)
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True

    def bulk_create(self, db: Session, inspirations: list[Inspiration]) -> list[Inspiration]:
        for inspiration in inspirations:
            db.add(
                InspirationRow(
                    id=inspiration.id,
                    payload=dump_json(inspiration.model_dump(mode="json")),
                    created_at=inspiration.created_at,
                )
            )
        db.commit()
        return inspirations


class TopicRepository:
    def list_all(self, db: Session) -> list[Topic]:
        rows = db.query(TopicRow).order_by(TopicRow.updated_at.desc()).all()
        return [Topic.model_validate(load_json(row.payload)) for row in rows]

    def get(self, db: Session, topic_id: str) -> Topic | None:
        row = db.get(TopicRow, topic_id)
        if not row:
            return None
        return Topic.model_validate(load_json(row.payload))

    def create(self, db: Session, topic: Topic) -> Topic:
        db.add(
            TopicRow(
                id=topic.id,
                payload=dump_json(topic.model_dump(mode="json")),
                created_at=topic.created_at,
                updated_at=topic.updated_at,
            )
        )
        db.commit()
        return topic

    def update(self, db: Session, topic: Topic) -> Topic:
        row = db.get(TopicRow, topic.id)
        if not row:
            raise ValueError("Topic not found")
        topic.updated_at = datetime.utcnow()
        row.payload = dump_json(topic.model_dump(mode="json"))
        row.updated_at = topic.updated_at
        db.commit()
        return topic

    def delete(self, db: Session, topic_id: str) -> bool:
        row = db.get(TopicRow, topic_id)
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True


class StyleRepository:
    STYLE_KEY = "author_style_profile"

    def get(self, db: Session) -> AuthorStyleProfile:
        row = db.get(SettingsRow, self.STYLE_KEY)
        if not row:
            return AuthorStyleProfile()
        return AuthorStyleProfile.model_validate(load_json(row.payload))

    def save(self, db: Session, profile: AuthorStyleProfile) -> AuthorStyleProfile:
        payload = dump_json(profile.model_dump(mode="json"))
        row = db.get(SettingsRow, self.STYLE_KEY)
        if row:
            row.payload = payload
        else:
            db.add(SettingsRow(key=self.STYLE_KEY, payload=payload))
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


def parse_json_from_text(text: str) -> dict[str, Any]:
    fenced = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")
    return json.loads(candidate[start : end + 1])
