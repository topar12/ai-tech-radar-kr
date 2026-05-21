from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, status

from app.data.bootstrap import build_bootstrap_payload
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
        "service": "localai-radar-backend",
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
    generated_at = utc_now_iso()
    return {
        "ok": True,
        "status": "completed",
        "snapshotId": f"snapshot-{uuid4()}",
        "generatedAt": generated_at,
        "message": "Snapshot rebuild skeleton completed using in-memory bootstrap data.",
    }
