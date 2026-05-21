import json
from typing import Any
from uuid import uuid4

from app.collectors.rss import collect_official_feed_dataset
from app.data.db import db_session
from app.data.seed import LABELS, SEED_ISSUES, SEED_SIGNALS, SEED_SOURCES, SEED_WATCHLISTS


def dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads_json(value: str) -> Any:
    return json.loads(value)


def seed_dataset() -> dict[str, list[dict[str, object]]]:
    return {
        "sources": list(SEED_SOURCES),
        "signals": list(SEED_SIGNALS),
        "issues": list(SEED_ISSUES),
        "watchlists": list(SEED_WATCHLISTS),
    }


def clear_bootstrap_tables(connection) -> None:
    connection.execute("DELETE FROM signals")
    connection.execute("DELETE FROM watchlists")
    connection.execute("DELETE FROM issues")
    connection.execute("DELETE FROM sources")


def replace_dataset(connection, dataset: dict[str, list[dict[str, Any]]]) -> None:
    clear_bootstrap_tables(connection)
    connection.executemany(
        """
        INSERT INTO sources (
            id,
            type,
            publisher,
            title,
            url,
            reliability,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                source["id"],
                source["type"],
                source["publisher"],
                source["title"],
                source["url"],
                source["reliability"],
                source["publishedAt"],
            )
            for source in dataset["sources"]
        ],
    )
    connection.executemany(
        """
        INSERT INTO issues (
            id,
            title,
            conclusion,
            categories_json,
            tags_json,
            certainty,
            importance,
            velocity,
            practical_value,
            korea_relevance,
            risk,
            direction,
            audiences_json,
            source_ids_json,
            signal_ids_json,
            updated_at,
            summary_json,
            timeline_json,
            validation_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                issue["id"],
                issue["title"],
                issue["conclusion"],
                dumps_json(issue["categories"]),
                dumps_json(issue["tags"]),
                issue["certainty"],
                issue["importance"],
                issue["velocity"],
                issue["practicalValue"],
                issue["koreaRelevance"],
                issue["risk"],
                issue["direction"],
                dumps_json(issue["audiences"]),
                dumps_json(issue["sourceIds"]),
                dumps_json(issue["signalIds"]),
                issue["updatedAt"],
                dumps_json(issue["summary"]),
                dumps_json(issue["timeline"]),
                dumps_json(issue["validation"]),
            )
            for issue in dataset["issues"]
        ],
    )
    connection.executemany(
        """
        INSERT INTO signals (
            id,
            issue_id,
            source_id,
            type,
            title,
            strength,
            velocity,
            evidence_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                signal["id"],
                signal["issueId"],
                signal["sourceId"],
                signal["type"],
                signal["title"],
                signal["strength"],
                signal["velocity"],
                signal["evidenceText"],
            )
            for signal in dataset["signals"]
        ],
    )
    connection.executemany(
        """
        INSERT INTO watchlists (
            id,
            label,
            kind,
            query_text,
            issue_ids_json,
            change_text
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                watchlist["id"],
                watchlist["label"],
                watchlist["kind"],
                watchlist["query"],
                dumps_json(watchlist["issueIds"]),
                watchlist["change"],
            )
            for watchlist in dataset["watchlists"]
        ],
    )


def seed_reference_data(connection) -> None:
    replace_dataset(connection, seed_dataset())


def count_table_rows(connection) -> dict[str, int]:
    return {
        "sourceCount": connection.execute("SELECT COUNT(*) FROM sources").fetchone()[0],
        "signalCount": connection.execute("SELECT COUNT(*) FROM signals").fetchone()[0],
        "issueCount": connection.execute("SELECT COUNT(*) FROM issues").fetchone()[0],
        "watchlistCount": connection.execute("SELECT COUNT(*) FROM watchlists").fetchone()[0],
    }


def has_bootstrap_data(connection) -> bool:
    counts = count_table_rows(connection)
    return all(counts.values())


def fetch_sources(connection) -> list[dict[str, object]]:
    rows = connection.execute(
        """
        SELECT id, type, publisher, title, url, reliability, published_at
        FROM sources
        ORDER BY published_at DESC, id
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "type": row["type"],
            "publisher": row["publisher"],
            "title": row["title"],
            "url": row["url"],
            "reliability": row["reliability"],
            "publishedAt": row["published_at"],
        }
        for row in rows
    ]


def fetch_signals(connection) -> list[dict[str, object]]:
    rows = connection.execute(
        """
        SELECT id, issue_id, source_id, type, title, strength, velocity, evidence_text
        FROM signals
        ORDER BY strength DESC, velocity DESC, id
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "issueId": row["issue_id"],
            "sourceId": row["source_id"],
            "type": row["type"],
            "title": row["title"],
            "strength": row["strength"],
            "velocity": row["velocity"],
            "evidenceText": row["evidence_text"],
        }
        for row in rows
    ]


def fetch_issues(connection) -> list[dict[str, object]]:
    rows = connection.execute(
        """
        SELECT
            id,
            title,
            conclusion,
            categories_json,
            tags_json,
            certainty,
            importance,
            velocity,
            practical_value,
            korea_relevance,
            risk,
            direction,
            audiences_json,
            source_ids_json,
            signal_ids_json,
            updated_at,
            summary_json,
            timeline_json,
            validation_json
        FROM issues
        ORDER BY importance DESC, velocity DESC, updated_at DESC, id
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "conclusion": row["conclusion"],
            "categories": loads_json(row["categories_json"]),
            "tags": loads_json(row["tags_json"]),
            "certainty": row["certainty"],
            "importance": row["importance"],
            "velocity": row["velocity"],
            "practicalValue": row["practical_value"],
            "koreaRelevance": row["korea_relevance"],
            "risk": row["risk"],
            "direction": row["direction"],
            "audiences": loads_json(row["audiences_json"]),
            "sourceIds": loads_json(row["source_ids_json"]),
            "signalIds": loads_json(row["signal_ids_json"]),
            "updatedAt": row["updated_at"],
            "summary": loads_json(row["summary_json"]),
            "timeline": loads_json(row["timeline_json"]),
            "validation": loads_json(row["validation_json"]),
        }
        for row in rows
    ]


def fetch_watchlists(connection) -> list[dict[str, object]]:
    rows = connection.execute(
        """
        SELECT id, label, kind, query_text, issue_ids_json, change_text
        FROM watchlists
        ORDER BY id
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "label": row["label"],
            "kind": row["kind"],
            "query": row["query_text"],
            "issueIds": loads_json(row["issue_ids_json"]),
            "change": row["change_text"],
        }
        for row in rows
    ]


def build_snapshot_payload(connection, generated_at: str) -> dict[str, object]:
    return {
        **LABELS,
        "sources": fetch_sources(connection),
        "signals": fetch_signals(connection),
        "issues": fetch_issues(connection),
        "watchlists": fetch_watchlists(connection),
        "generatedAt": generated_at,
    }


def insert_snapshot(connection, generated_at: str, payload: dict[str, object]) -> tuple[str, dict[str, int]]:
    snapshot_id = f"snapshot-{uuid4()}"
    counts = count_table_rows(connection)
    connection.execute(
        """
        INSERT INTO snapshots (
            id,
            generated_at,
            payload_json,
            source_count,
            signal_count,
            issue_count,
            watchlist_count,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            snapshot_id,
            generated_at,
            dumps_json(payload),
            counts["sourceCount"],
            counts["signalCount"],
            counts["issueCount"],
            counts["watchlistCount"],
            generated_at,
        ),
    )
    return snapshot_id, counts


def mark_job_completed(connection, job_id: str, finished_at: str, snapshot_id: str, details: dict[str, object]) -> None:
    connection.execute(
        """
        UPDATE jobs
        SET status = ?, finished_at = ?, snapshot_id = ?, details_json = ?
        WHERE id = ?
        """,
        ("completed", finished_at, snapshot_id, dumps_json(details), job_id),
    )


def mark_job_failed(connection, job_id: str, finished_at: str, details: dict[str, object]) -> None:
    connection.execute(
        """
        UPDATE jobs
        SET status = ?, finished_at = ?, details_json = ?
        WHERE id = ?
        """,
        ("failed", finished_at, dumps_json(details), job_id),
    )


def create_job(connection, kind: str, started_at: str, details: dict[str, object] | None = None) -> str:
    job_id = f"job-{uuid4()}"
    connection.execute(
        """
        INSERT INTO jobs (id, kind, status, started_at, finished_at, snapshot_id, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, kind, "running", started_at, None, None, dumps_json(details or {})),
    )
    return job_id


def latest_snapshot_payload(connection) -> dict[str, object] | None:
    row = connection.execute(
        """
        SELECT payload_json
        FROM snapshots
        ORDER BY generated_at DESC, created_at DESC, id DESC
        LIMIT 1
        """
    ).fetchone()
    if row is None:
        return None
    return loads_json(row["payload_json"])


def ensure_bootstrap_data(connection) -> bool:
    if has_bootstrap_data(connection):
        return False
    seed_reference_data(connection)
    return True


def create_snapshot_from_current_tables(
    connection,
    generated_at: str,
    job_kind: str,
    job_details: dict[str, object] | None = None,
) -> dict[str, object]:
    job_id = create_job(connection, job_kind, generated_at, job_details)
    connection.commit()
    try:
        connection.execute("BEGIN")
        seeded = ensure_bootstrap_data(connection)
        payload = build_snapshot_payload(connection, generated_at)
        snapshot_id, counts = insert_snapshot(connection, generated_at, payload)
        details = {
            "generatedAt": generated_at,
            "counts": counts,
            "seedLoaded": seeded,
        }
        if job_details:
            details.update(job_details)
        mark_job_completed(connection, job_id, generated_at, snapshot_id, details)
        connection.commit()
        return {
            "jobId": job_id,
            "snapshotId": snapshot_id,
            "generatedAt": generated_at,
            "counts": counts,
            "payload": payload,
            "details": details,
        }
    except Exception as exc:
        connection.rollback()
        mark_job_failed(
            connection,
            job_id,
            generated_at,
            {
                "generatedAt": generated_at,
                "error": str(exc),
            },
        )
        connection.commit()
        raise


def rebuild_bootstrap_snapshot(generated_at: str) -> dict[str, object]:
    with db_session() as connection:
        return create_snapshot_from_current_tables(connection, generated_at, "rebuild_snapshot")


def collect_bootstrap_snapshot(generated_at: str) -> dict[str, object]:
    with db_session() as connection:
        job_id = create_job(connection, "collect_official_feeds", generated_at)
        connection.commit()
        try:
            dataset, collector_details = collect_official_feed_dataset(generated_at)
            connection.execute("BEGIN")
            replace_dataset(connection, dataset)
            payload = build_snapshot_payload(connection, generated_at)
            snapshot_id, counts = insert_snapshot(connection, generated_at, payload)
            details = {
                "generatedAt": generated_at,
                "counts": counts,
                "collector": collector_details,
            }
            mark_job_completed(connection, job_id, generated_at, snapshot_id, details)
            connection.commit()
            return {
                "jobId": job_id,
                "snapshotId": snapshot_id,
                "generatedAt": generated_at,
                "counts": counts,
                "payload": payload,
                "details": details,
            }
        except Exception as exc:
            connection.rollback()
            mark_job_failed(
                connection,
                job_id,
                generated_at,
                {
                    "generatedAt": generated_at,
                    "error": str(exc),
                },
            )
            connection.commit()
            raise


def build_bootstrap_payload(generated_at: str) -> dict[str, object]:
    with db_session() as connection:
        payload = latest_snapshot_payload(connection)
        if payload is not None:
            return payload
        result = create_snapshot_from_current_tables(connection, generated_at, "bootstrap_seed")
        return result["payload"]
