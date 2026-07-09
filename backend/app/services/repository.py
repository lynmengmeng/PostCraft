from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from app.config import Settings
from app.models.schemas import (
    AuthorStyleProfile,
    ContentCategory,
    ContentCategoryCreate,
    ContentProject,
    ContentPatch,
    Inspiration,
    Topic,
    new_id,
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


BUILTIN_CONTENT_CATEGORIES: list[ContentCategory] = [
    ContentCategory(
        id="weekend-out",
        name="周末出走计划",
        description="武汉周边骑行、江边、露营、公园、短途路线",
        prompt_hint="写一篇关于低成本周末出走的文章，可以是骑行、江边散步、露营或短途路线，重点写真实体验和放松感。",
        builtin=True,
    ),
    ContentCategory(
        id="budget-finds",
        name="便宜但有用",
        description="拼多多/淘宝好物推荐，真实体验与避坑",
        prompt_hint="写一篇低成本生活好物推荐，要有真实使用体验，避免广告感，可以写避坑清单或提升幸福感的小物件。",
        builtin=True,
    ),
    ContentCategory(
        id="short-story",
        name="一个小故事",
        description="短故事 + 情绪观点，800–1500 字",
        prompt_hint="写一篇有情绪共鸣的短故事，带一点生活观察或观点，标题要有情绪钩子，800–1500 字。",
        builtin=True,
    ),
    ContentCategory(
        id="road-music",
        name="路上听什么",
        description="场景化歌单：骑车、散步、露营、发呆",
        prompt_hint="写一篇音乐分享，不要写成单纯推荐歌曲，要结合场景和情绪，比如骑车去江边、下班路上、下雨天、失眠夜。",
        builtin=True,
    ),
    ContentCategory(
        id="ordinary-observer",
        name="普通人观察",
        description="生活感想、热点延伸、消费观察",
        prompt_hint="写一篇关于普通人生活的观察，可以是生活感想、消费观察，或从热点延伸到普通人的情绪困境。",
        builtin=True,
    ),
]


def resolve_prompt_hint(
    pillar: str,
    categories: list[ContentCategory] | None = None,
) -> str:
    """Resolve writing hint for a content pillar name."""
    if not pillar.strip():
        return ""
    merged = list(BUILTIN_CONTENT_CATEGORIES)
    if categories:
        builtin_names = {c.name for c in BUILTIN_CONTENT_CATEGORIES}
        for cat in categories:
            if cat.name not in builtin_names:
                merged.append(cat)
    for cat in merged:
        if cat.name == pillar.strip():
            return cat.prompt_hint.strip()
    return ""


def sync_content_pillar(project: ContentProject, pillar: str) -> None:
    """Keep project.content_pillar and topic_meta.content_pillar in sync."""
    project.content_pillar = pillar
    project.topic_meta.content_pillar = pillar


class CategoryRepository:
    SETTINGS_KEY = "content_categories"

    def _key(self, user_id: str | None, scoped: bool) -> str:
        if scoped and user_id:
            return f"{self.SETTINGS_KEY}:{user_id}"
        return self.SETTINGS_KEY

    def _load_custom(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> list[ContentCategory]:
        key = self._key(user_id, scoped)
        row = db.get(SettingsRow, key)
        if not row and scoped and user_id:
            row = db.get(SettingsRow, self.SETTINGS_KEY)
        if not row:
            return []
        raw = load_json(row.payload)
        if not isinstance(raw, list):
            return []
        return [ContentCategory.model_validate(item) for item in raw]

    def _save_custom(
        self,
        db: Session,
        categories: list[ContentCategory],
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> None:
        key = self._key(user_id, scoped)
        payload = dump_json([c.model_dump(mode="json") for c in categories])
        row = db.get(SettingsRow, key)
        if row:
            row.payload = payload
        else:
            db.add(SettingsRow(key=key, payload=payload))
        db.commit()

    def list_all(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> list[ContentCategory]:
        custom = self._load_custom(db, user_id=user_id, scoped=scoped)
        builtin_names = {c.name for c in BUILTIN_CONTENT_CATEGORIES}
        merged = list(BUILTIN_CONTENT_CATEGORIES)
        for cat in custom:
            if cat.name not in builtin_names:
                merged.append(cat)
        return merged

    def add_custom(
        self,
        db: Session,
        payload: ContentCategoryCreate,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> ContentCategory:
        name = payload.name.strip()
        if not name:
            raise ValueError("分类名称不能为空")
        existing = self.list_all(db, user_id=user_id, scoped=scoped)
        if any(c.name == name for c in existing):
            raise ValueError("分类名称已存在")
        category = ContentCategory(
            id=new_id(),
            name=name,
            description=payload.description.strip(),
            prompt_hint=payload.prompt_hint.strip(),
            builtin=False,
        )
        custom = [c for c in self._load_custom(db, user_id=user_id, scoped=scoped) if not c.builtin]
        custom.append(category)
        self._save_custom(db, custom, user_id=user_id, scoped=scoped)
        return category

    def delete_custom(
        self,
        db: Session,
        category_id: str,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> bool:
        custom = self._load_custom(db, user_id=user_id, scoped=scoped)
        filtered = [c for c in custom if c.id != category_id]
        if len(filtered) == len(custom):
            return False
        if any(c.id == category_id and c.builtin for c in BUILTIN_CONTENT_CATEGORIES):
            raise ValueError("内置分类不可删除")
        self._save_custom(db, filtered, user_id=user_id, scoped=scoped)
        return True


project_repo = ProjectRepository()
inspiration_repo = InspirationRepository()
topic_repo = TopicRepository()
style_repo = StyleRepository()
category_repo = CategoryRepository()


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
