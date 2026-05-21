import os
from dataclasses import dataclass
from functools import lru_cache


DEFAULT_CORS_ORIGINS = (
    "http://127.0.0.1:8765",
    "http://localhost:8765",
)


def parse_csv(value: str | None, fallback: tuple[str, ...]) -> list[str]:
    if not value:
        return list(fallback)
    parsed = [item.strip().rstrip("/") for item in value.split(",") if item.strip()]
    return parsed or list(fallback)


@dataclass(frozen=True)
class Settings:
    app_name: str
    debug: bool
    cors_origins: list[str]
    admin_token: str
    database_url: str
    github_token: str
    hf_token: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", os.getenv("LOCALAI_APP_NAME", "LocalAI Radar Backend")),
        debug=os.getenv("DEBUG", os.getenv("LOCALAI_DEBUG", "")).lower() in {"1", "true", "yes", "on"},
        cors_origins=parse_csv(os.getenv("CORS_ORIGINS", os.getenv("LOCALAI_CORS_ORIGINS")), DEFAULT_CORS_ORIGINS),
        admin_token=os.getenv("ADMIN_TOKEN", ""),
        database_url=os.getenv("DATABASE_URL", ""),
        github_token=os.getenv("GITHUB_TOKEN", ""),
        hf_token=os.getenv("HF_TOKEN", ""),
    )
