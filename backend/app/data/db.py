import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.settings import get_settings


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
SQLITE_PREFIX = "sqlite:///"

SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        publisher TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        reliability INTEGER NOT NULL,
        published_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        issue_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        strength INTEGER NOT NULL,
        velocity INTEGER NOT NULL,
        evidence_text TEXT NOT NULL,
        FOREIGN KEY(issue_id) REFERENCES issues(id),
        FOREIGN KEY(source_id) REFERENCES sources(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        conclusion TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        certainty TEXT NOT NULL,
        importance INTEGER NOT NULL,
        velocity INTEGER NOT NULL,
        practical_value INTEGER NOT NULL,
        korea_relevance INTEGER NOT NULL,
        risk INTEGER NOT NULL,
        direction TEXT NOT NULL,
        audiences_json TEXT NOT NULL,
        source_ids_json TEXT NOT NULL,
        signal_ids_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        timeline_json TEXT NOT NULL,
        validation_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS watchlists (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        kind TEXT NOT NULL,
        query_text TEXT NOT NULL,
        issue_ids_json TEXT NOT NULL,
        change_text TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        generated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        source_count INTEGER NOT NULL,
        signal_count INTEGER NOT NULL,
        issue_count INTEGER NOT NULL,
        watchlist_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        snapshot_id TEXT,
        details_json TEXT NOT NULL,
        FOREIGN KEY(snapshot_id) REFERENCES snapshots(id)
    )
    """,
)

INDEX_STATEMENTS = (
    "CREATE INDEX IF NOT EXISTS idx_snapshots_generated_at ON snapshots(generated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_started_at ON jobs(started_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_signals_issue_id ON signals(issue_id)",
)


def database_path() -> Path:
    database_url = get_settings().database_url.strip()
    if not database_url.startswith(SQLITE_PREFIX):
        raise ValueError("Round 3 currently supports only sqlite:/// DATABASE_URL values.")
    raw_path = database_url[len(SQLITE_PREFIX) :]
    path = Path(raw_path)
    if not path.is_absolute():
        path = (PROJECT_ROOT / path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def open_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(connection: sqlite3.Connection) -> None:
    for statement in SCHEMA_STATEMENTS:
        connection.execute(statement)
    for statement in INDEX_STATEMENTS:
        connection.execute(statement)
    connection.commit()


@contextmanager
def db_session() -> Iterator[sqlite3.Connection]:
    connection = open_connection()
    try:
        initialize_database(connection)
        yield connection
    finally:
        connection.close()
