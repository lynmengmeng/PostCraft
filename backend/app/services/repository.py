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
    ContentCategoryUpdate,
    CategoryPlatformHints,
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

    def list_active(self, db: Session, *, user_id: str | None = None, scoped: bool = False) -> list[Inspiration]:
        return [item for item in self.list_all(db, user_id=user_id, scoped=scoped) if not item.topic_id]

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
        structure_hint="路线/交通 → 真实体验 → 花费参考 → 感受收尾，800–1200 字",
        platform_hints=CategoryPlatformHints(
            wechat="故事叙事排版，段落有画面感，像给朋友分享一次出走",
            xiaohongshu="短段落 + 地点/路线标签，每段 1–2 行，适度 emoji",
            douyin="60 秒场景 vlog 口播，开头直接说去哪、为什么去",
        ),
        title_style="场景 + 低成本，如「花 XX 元骑电动车去 XX，周末半天就够了」",
        cover_mood="户外自然光，骑行/江边/露营场景，清新放松",
        default_layout="story",
        default_tone="轻松分享",
        example_topics=["骑电动车去东西湖大堤", "武汉周边半日露营路线"],
        builtin=True,
    ),
    ContentCategory(
        id="budget-finds",
        name="便宜但有用",
        description="拼多多/淘宝好物推荐，真实体验与避坑",
        prompt_hint="写一篇低成本生活好物推荐，要有真实使用体验，避免广告感，可以写避坑清单或提升幸福感的小物件。",
        structure_hint="清单体：每件写价格/使用场景/真实体验/是否回购，带避坑提醒",
        platform_hints=CategoryPlatformHints(
            wechat="干货清单排版，条目清晰，价格与体验并列",
            xiaohongshu="清单 emoji + 短句，每点一行，适合收藏",
            douyin="90 秒避坑钩子口播，开头说「别买错 XX」或「这个便宜但真有用」",
        ),
        title_style="搜索问题型，如「XX 元买的 XX 真的有用吗？」",
        cover_mood="居家产品实拍，简洁背景，真实不广告感",
        default_layout="checklist",
        default_tone="实用分享",
        example_topics=["拼多多 9.9 买了 XX", "租房必备但不占地的小物"],
        builtin=True,
    ),
    ContentCategory(
        id="short-story",
        name="一个小故事",
        description="短故事 + 情绪观点，800–1500 字",
        prompt_hint="写一篇有情绪共鸣的短故事，带一点生活观察或观点，标题要有情绪钩子，800–1500 字。",
        structure_hint="场景开头 → 小冲突/转折 → 感悟收尾，800–1500 字",
        platform_hints=CategoryPlatformHints(
            wechat="故事叙事排版，情绪递进，结尾有余韵",
            xiaohongshu="情绪共鸣短段，每段 1–2 行，少用说教",
            douyin="共鸣式 hook，开头一句戳中情绪，60–90 秒",
        ),
        title_style="情绪钩子型，如「她说，她只是想安静地过一个周末」",
        cover_mood="情绪化纪实摄影，暖色或低饱和，人物/细节特写",
        default_layout="story",
        default_tone="温和共情",
        example_topics=["她说，她只是想安静地过一个周末", "下班后在便利店停了很久"],
        builtin=True,
    ),
    ContentCategory(
        id="road-music",
        name="路上听什么",
        description="场景化歌单：骑车、散步、露营、发呆",
        prompt_hint="写一篇音乐分享，不要写成单纯推荐歌曲，要结合场景和情绪，比如骑车去江边、下班路上、下雨天、失眠夜。",
        structure_hint="场景描述 → 每首歌：为什么在这场景听 → 情绪共鸣",
        platform_hints=CategoryPlatformHints(
            wechat="活泼排版，场景与歌曲交替，像给朋友安利",
            xiaohongshu="歌单 + 场景标签，短句分段，适合收藏",
            douyin="60 秒场景分享，开头说「XX 场景听这几首」",
        ),
        title_style="场景 + 音乐，如「骑车去江边听这几首」",
        cover_mood="傍晚/骑行/耳机/车窗，氛围感但不炫光",
        default_layout="lively",
        default_tone="轻松感性",
        example_topics=["下雨天下班路上听什么", "骑车去江边时的歌单"],
        builtin=True,
    ),
    ContentCategory(
        id="ordinary-observer",
        name="普通人观察",
        description="生活感想、热点延伸、消费观察",
        prompt_hint="写一篇关于普通人生活的观察，可以是生活感想、消费观察，或从热点延伸到普通人的情绪困境。",
        structure_hint="现象观察 → 可能原因 → 温和结论，避免绝对化批判",
        platform_hints=CategoryPlatformHints(
            wechat="经典排版，观点有分寸，段落完整",
            xiaohongshu="观察笔记体，短段 + 标签，像随手记录",
            douyin="问题式 hook，开头抛现象，90 秒以内",
        ),
        title_style="观察共情型，如「为什么越来越多人只想逃离半天」",
        cover_mood="日常街拍纪实，普通人生活场景，克制不煽情",
        default_layout="classic",
        default_tone="温和观察",
        example_topics=["为什么越来越多人只想逃离半天", "普通人消费里的一个小陷阱"],
        builtin=True,
    ),
]


def _merge_category_override(base: ContentCategory, override: dict[str, Any]) -> ContentCategory:
    data = base.model_dump(mode="python")
    for key, value in override.items():
        if value is None:
            continue
        if key == "platform_hints" and isinstance(value, dict):
            merged_hints = {**data.get("platform_hints", {}), **value}
            data["platform_hints"] = merged_hints
        elif key in data:
            data[key] = value
    return ContentCategory.model_validate(data)


def resolve_category(
    pillar: str,
    categories: list[ContentCategory] | None = None,
) -> ContentCategory | None:
    if not pillar.strip():
        return None
    name = pillar.strip()
    for cat in categories or []:
        if cat.name == name:
            return cat
    for cat in BUILTIN_CONTENT_CATEGORIES:
        if cat.name == name:
            return cat
    return None


def resolve_prompt_hint(
    pillar: str,
    categories: list[ContentCategory] | None = None,
) -> str:
    """Resolve writing hint for a content pillar name."""
    cat = resolve_category(pillar, categories)
    return cat.prompt_hint.strip() if cat else ""


def category_context_block(
    cat: ContentCategory,
    platforms: list[str] | None = None,
) -> str:
    lines = [f"\n\n【内容栏目 — {cat.name}】"]
    if cat.description:
        lines.append(f"栏目说明: {cat.description}")
    if cat.structure_hint:
        lines.append(f"结构要求: {cat.structure_hint}")
    hints = cat.platform_hints
    platform_keys = platforms or ["wechat", "xiaohongshu", "douyin"]
    for key in platform_keys:
        hint = getattr(hints, key, "") if hints else ""
        if hint:
            label = {"wechat": "公众号", "xiaohongshu": "小红书", "douyin": "抖音"}.get(key, key)
            lines.append(f"{label}转换: {hint}")
    if cat.title_style:
        lines.append(f"标题风格: {cat.title_style}")
    if cat.cover_mood:
        lines.append(f"配图气质: {cat.cover_mood}")
    return "\n".join(lines) + "\n"


def sync_content_pillar(project: ContentProject, pillar: str) -> None:
    """Keep project.content_pillar and topic_meta.content_pillar in sync."""
    project.content_pillar = pillar
    project.topic_meta.content_pillar = pillar


class CategoryRepository:
    SETTINGS_KEY = "content_categories"
    OVERRIDES_KEY = "category_overrides"

    def _key(self, user_id: str | None, scoped: bool) -> str:
        if scoped and user_id:
            return f"{self.SETTINGS_KEY}:{user_id}"
        return self.SETTINGS_KEY

    def _overrides_key(self, user_id: str | None, scoped: bool) -> str:
        if scoped and user_id:
            return f"{self.OVERRIDES_KEY}:{user_id}"
        return self.OVERRIDES_KEY

    def _load_overrides(
        self,
        db: Session,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> dict[str, dict[str, Any]]:
        key = self._overrides_key(user_id, scoped)
        row = db.get(SettingsRow, key)
        if not row and scoped and user_id:
            row = db.get(SettingsRow, self.OVERRIDES_KEY)
        if not row:
            return {}
        raw = load_json(row.payload)
        return raw if isinstance(raw, dict) else {}

    def _save_overrides(
        self,
        db: Session,
        overrides: dict[str, dict[str, Any]],
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> None:
        key = self._overrides_key(user_id, scoped)
        payload = dump_json(overrides)
        row = db.get(SettingsRow, key)
        if row:
            row.payload = payload
        else:
            db.add(SettingsRow(key=key, payload=payload))
        db.commit()

    def _apply_builtin_overrides(
        self,
        overrides: dict[str, dict[str, Any]],
    ) -> list[ContentCategory]:
        merged: list[ContentCategory] = []
        for cat in BUILTIN_CONTENT_CATEGORIES:
            override = overrides.get(cat.id)
            merged.append(_merge_category_override(cat, override) if override else cat)
        return merged

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
        overrides = self._load_overrides(db, user_id=user_id, scoped=scoped)
        builtin_names = {c.name for c in BUILTIN_CONTENT_CATEGORIES}
        merged = self._apply_builtin_overrides(overrides)
        for cat in custom:
            if cat.name not in builtin_names:
                merged.append(cat)
        return merged

    def _category_from_create(self, payload: ContentCategoryCreate, *, category_id: str | None = None) -> ContentCategory:
        return ContentCategory(
            id=category_id or new_id(),
            name=payload.name.strip(),
            description=payload.description.strip(),
            prompt_hint=payload.prompt_hint.strip(),
            structure_hint=payload.structure_hint.strip(),
            platform_hints=payload.platform_hints or CategoryPlatformHints(),
            title_style=payload.title_style.strip(),
            cover_mood=payload.cover_mood.strip(),
            default_layout=payload.default_layout,
            default_tone=payload.default_tone.strip() or "温和共情",
            example_topics=[t.strip() for t in payload.example_topics if t.strip()],
            builtin=False,
        )

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
        category = self._category_from_create(payload)
        custom = [c for c in self._load_custom(db, user_id=user_id, scoped=scoped) if not c.builtin]
        custom.append(category)
        self._save_custom(db, custom, user_id=user_id, scoped=scoped)
        return category

    def update_category(
        self,
        db: Session,
        category_id: str,
        payload: ContentCategoryUpdate,
        *,
        user_id: str | None = None,
        scoped: bool = False,
    ) -> ContentCategory:
        builtin = next((c for c in BUILTIN_CONTENT_CATEGORIES if c.id == category_id), None)
        if builtin:
            overrides = self._load_overrides(db, user_id=user_id, scoped=scoped)
            current = _merge_category_override(builtin, overrides.get(category_id, {}))
            patch = payload.model_dump(mode="python", exclude_unset=True)
            if "platform_hints" in patch and patch["platform_hints"] is not None:
                hints = current.platform_hints.model_dump(mode="python")
                incoming = patch["platform_hints"]
                if hasattr(incoming, "model_dump"):
                    incoming = incoming.model_dump(mode="python", exclude_unset=True)
                hints.update({k: v for k, v in incoming.items() if v})
                patch["platform_hints"] = hints
            merged_override = {**overrides.get(category_id, {}), **patch}
            overrides[category_id] = merged_override
            self._save_overrides(db, overrides, user_id=user_id, scoped=scoped)
            return _merge_category_override(builtin, merged_override)

        custom = self._load_custom(db, user_id=user_id, scoped=scoped)
        index = next((i for i, c in enumerate(custom) if c.id == category_id), None)
        if index is None:
            raise ValueError("分类不存在")
        current = custom[index]
        patch = payload.model_dump(mode="python", exclude_unset=True)
        if payload.name is not None and payload.name.strip() != current.name:
            name = payload.name.strip()
            if not name:
                raise ValueError("分类名称不能为空")
            existing = self.list_all(db, user_id=user_id, scoped=scoped)
            if any(c.name == name and c.id != category_id for c in existing):
                raise ValueError("分类名称已存在")
        data = current.model_dump(mode="python")
        for key, value in patch.items():
            if value is None:
                continue
            if key == "platform_hints" and isinstance(value, dict):
                hints = data.get("platform_hints", {})
                if hasattr(value, "model_dump"):
                    value = value.model_dump(mode="python", exclude_unset=True)
                hints.update(value)
                data["platform_hints"] = hints
            else:
                data[key] = value
        updated = ContentCategory.model_validate(data)
        custom[index] = updated
        self._save_custom(db, custom, user_id=user_id, scoped=scoped)
        return updated

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

_PATCH_ROOT_KEYS = frozenset({"draft", "humanized", "titles", "cover_assets"})
_PATCH_PLATFORMS = frozenset({"wechat", "xiaohongshu", "douyin"})


def is_allowed_patch_path(path: str) -> bool:
    if path in _PATCH_ROOT_KEYS:
        return True
    if not path.startswith("platforms."):
        return False
    rest = path[len("platforms.") :]
    platform_key = rest.split(".", 1)[0]
    return platform_key in _PATCH_PLATFORMS


def validate_patch_paths(patch: dict[str, Any]) -> None:
    for path, value in patch.items():
        if not is_allowed_patch_path(path):
            raise ValueError(f"不允许的 patch 路径：{path}")
        if path in {"platforms.douyin.script"} and value is not None and not isinstance(value, list):
            raise ValueError("platforms.douyin.script 必须是分镜数组")
        if path in {"platforms.xiaohongshu.tags"} and value is not None:
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                raise ValueError("platforms.xiaohongshu.tags 必须是字符串数组")


def apply_patch(project: ContentProject, patch: ContentPatch) -> ContentProject:
    validate_patch_paths(patch.patch)
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
