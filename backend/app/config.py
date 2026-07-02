from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


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


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    """Clear cached settings after .env changes (e.g. dev hot-reload)."""
    get_settings.cache_clear()
    return get_settings()
