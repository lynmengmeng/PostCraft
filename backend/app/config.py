from functools import lru_cache
from pathlib import Path
import json
import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_API_KEYS_PATH = ROOT_DIR / "config" / "api_keys.local.json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", ROOT_DIR / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "PostCraft API"
    debug: bool = True
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:3002,http://127.0.0.1:3002"

    database_url: str = ""

    def model_post_init(self, __context: object) -> None:
        if not self.database_url:
            db_path = (ROOT_DIR / "data" / "postcraft.db").resolve().as_posix()
            object.__setattr__(self, "database_url", f"sqlite:///{db_path}")

    llm_provider: str = "deepseek"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    openai_image_model: str = "gpt-image-2"
    openai_skip_proxy: bool = True
    # 可选：指向 studyx-agent-backend/config/api_keys.local.json 等同路径
    api_keys_file: str = ""

    @field_validator("api_keys_file", mode="before")
    @classmethod
    def strip_api_keys_file(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator(
        "deepseek_api_key",
        "openai_api_key",
        "deepseek_base_url",
        "openai_base_url",
        "deepseek_model",
        "openai_model",
        "openai_image_model",
        mode="before",
    )
    @classmethod
    def strip_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    skills_dir: Path = ROOT_DIR / "skills"
    vendor_skills_dir: Path = ROOT_DIR / "vendor" / "oh-my-writing-skill" / "skills"
    docs_skills_dir: Path = ROOT_DIR / "docs" / "oh-my-writing-skill"
    root_dir: Path = ROOT_DIR
    images_dir: Path = ROOT_DIR / "data" / "images"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def resolve_provider(self) -> tuple[str, str, str, str]:
        provider = self.llm_provider.lower()
        if provider == "deepseek" and self.deepseek_api_key:
            return (
                "deepseek",
                self.deepseek_api_key,
                self.deepseek_base_url,
                self.deepseek_model,
            )
        if provider == "openai" and self.openai_api_key:
            return (
                "openai",
                self.openai_api_key,
                self.openai_base_url,
                self.openai_model,
            )
        if self.deepseek_api_key:
            return (
                "deepseek",
                self.deepseek_api_key,
                self.deepseek_base_url,
                self.deepseek_model,
            )
        if self.openai_api_key:
            return (
                "openai",
                self.openai_api_key,
                self.openai_base_url,
                self.openai_model,
            )
        return ("mock", "", "", "")


def resolve_api_keys_path(settings: Settings | None = None) -> Path:
    """Resolve api_keys.local.json path: API_KEYS_FILE env > settings.api_keys_file > default."""
    env_raw = os.environ.get("API_KEYS_FILE", "").strip()
    if env_raw:
        return Path(env_raw).expanduser().resolve()
    if settings is not None and settings.api_keys_file.strip():
        return Path(settings.api_keys_file.strip()).expanduser().resolve()
    return DEFAULT_API_KEYS_PATH.resolve()


def load_api_keys_file(*, settings: Settings | None = None) -> dict:
    path = resolve_api_keys_path(settings)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _merge_api_keys(settings: Settings) -> Settings:
    """与 studyx-agent-backend 一致：.env 优先，api_keys.local.json 补齐空项。"""
    keys = load_api_keys_file(settings=settings)
    if not keys:
        return settings

    updates: dict[str, object] = {}
    string_fields = {
        "openai_api_key": "openai_api_key",
        "openai_base_url": "openai_base_url",
        "openai_model": "openai_model",
        "openai_image_model": "openai_image_model",
        "deepseek_api_key": "deepseek_api_key",
        "deepseek_base_url": "deepseek_base_url",
        "deepseek_model": "deepseek_model",
        "llm_provider": "default_llm_provider",
    }
    for field, json_key in string_fields.items():
        incoming = str(keys.get(json_key) or "").strip()
        if not incoming:
            continue
        current = getattr(settings, field)
        if isinstance(current, str) and not current.strip():
            updates[field] = incoming

    skip_raw = keys.get("openai_skip_proxy")
    if skip_raw is not None and str(skip_raw).strip() != "":
        updates["openai_skip_proxy"] = str(skip_raw).strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )

    if not updates:
        return settings
    return settings.model_copy(update=updates)


@lru_cache
def get_settings() -> Settings:
    return _merge_api_keys(Settings())


def reload_settings() -> Settings:
    """Clear cached settings after .env changes (e.g. dev hot-reload)."""
    get_settings.cache_clear()
    return get_settings()
