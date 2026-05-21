from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.data.db import SQLITE_PREFIX, database_path
from app.settings import get_settings


BACKUPS_DIR = Path(__file__).resolve().parents[1] / "backups"


def main() -> int:
    settings = get_settings()
    if not settings.database_url.startswith(SQLITE_PREFIX):
        raise SystemExit("backup_sqlite.py currently supports only sqlite:/// DATABASE_URL values.")

    source_path = database_path()
    if not source_path.exists():
        raise SystemExit(f"SQLite database not found: {source_path}")

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target_path = BACKUPS_DIR / f"{timestamp}-{source_path.name}"
    shutil.copy2(source_path, target_path)
    print(target_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
