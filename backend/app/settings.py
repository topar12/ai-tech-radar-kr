import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


DEFAULT_CORS_ORIGINS = (
    "http://127.0.0.1:8765",
    "http://localhost:8765",
)
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_URL = f"sqlite:///{BACKEND_ROOT / 'data' / 'localai-radar.sqlite3'}"


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
    collector_timeout_seconds: float
    collector_max_items_per_feed: int
    ssl_cert_file: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", os.getenv("LOCALAI_APP_NAME", "LocalAI Radar Backend")),
        debug=os.getenv("DEBUG", os.getenv("LOCALAI_DEBUG", "")).lower() in {"1", "true", "yes", "on"},
        cors_origins=parse_csv(os.getenv("CORS_ORIGINS", os.getenv("LOCALAI_CORS_ORIGINS")), DEFAULT_CORS_ORIGINS),
        admin_token=os.getenv("ADMIN_TOKEN", ""),
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        github_token=os.getenv("GITHUB_TOKEN", ""),
        hf_token=os.getenv("HF_TOKEN", ""),
        collector_timeout_seconds=float(os.getenv("COLLECTOR_TIMEOUT_SECONDS", "15")),
        collector_max_items_per_feed=int(os.getenv("COLLECTOR_MAX_ITEMS_PER_FEED", "4")),
        ssl_cert_file=os.getenv("SSL_CERT_FILE", "/etc/ssl/cert.pem"),
    )
