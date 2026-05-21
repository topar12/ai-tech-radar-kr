from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app.data.bootstrap import (
    build_bootstrap_payload,
    collect_bootstrap_snapshot,
    read_admin_jobs,
    read_admin_status,
    rebuild_bootstrap_snapshot,
)
from app.settings import get_settings

router = APIRouter()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_admin_token(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    settings = get_settings()
    if not settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_TOKEN is not configured.",
        )
    if x_admin_token != settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token.",
        )


@router.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "ok": True,
        "service": "lokana-api",
        "generatedAt": utc_now_iso(),
        "adminConfigured": bool(settings.admin_token),
        "databaseConfigured": bool(settings.database_url),
    }


@router.get("/api/bootstrap")
def bootstrap() -> dict[str, object]:
    return build_bootstrap_payload(generated_at=utc_now_iso())


@router.post("/api/admin/rebuild-snapshot")
def rebuild_snapshot(x_admin_token: Annotated[str | None, Header()] = None) -> dict[str, object]:
    require_admin_token(x_admin_token)
    result = rebuild_bootstrap_snapshot(generated_at=utc_now_iso())
    return {
        "ok": True,
        "status": result["status"],
        "jobId": result["jobId"],
        "snapshotId": result["snapshotId"],
        "generatedAt": result["generatedAt"],
        "counts": result["counts"],
        "message": "Snapshot rebuilt from current SQLite data.",
    }


@router.post("/api/admin/collect")
def collect(x_admin_token: Annotated[str | None, Header()] = None) -> dict[str, object]:
    require_admin_token(x_admin_token)
    result = collect_bootstrap_snapshot(generated_at=utc_now_iso())
    return {
        "ok": True,
        "status": result["status"],
        "jobId": result["jobId"],
        "snapshotId": result["snapshotId"],
        "generatedAt": result["generatedAt"],
        "counts": result["counts"],
        "collector": result["details"]["collector"],
        "message": "Official RSS/Atom feeds collected and snapshot rebuilt.",
    }


@router.get("/api/admin/status")
def admin_status(x_admin_token: Annotated[str | None, Header()] = None) -> dict[str, object]:
    require_admin_token(x_admin_token)
    return {
        "ok": True,
        "generatedAt": utc_now_iso(),
        **read_admin_status(),
    }


@router.get("/api/admin/jobs")
def admin_jobs(limit: int = 20, x_admin_token: Annotated[str | None, Header()] = None) -> dict[str, object]:
    require_admin_token(x_admin_token)
    jobs = read_admin_jobs(limit=limit)
    return {
        "ok": True,
        "generatedAt": utc_now_iso(),
        "jobs": jobs,
        "count": len(jobs),
    }
