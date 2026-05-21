#!/usr/bin/env bash
set -eu

require_env() {
  var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
}

http_code() {
  curl -sS -o /tmp/localai-smoke-body.txt -w "%{http_code}" "$1"
}

check_200() {
  label="$1"
  url="$2"
  code="$(http_code "$url")"
  if [ "$code" != "200" ]; then
    echo "[FAIL] $label -> $code ($url)" >&2
    cat /tmp/localai-smoke-body.txt >&2 || true
    exit 1
  fi
  echo "[OK]   $label -> 200"
}

check_401() {
  label="$1"
  url="$2"
  code="$(curl -sS -o /tmp/localai-smoke-body.txt -w "%{http_code}" "$url")"
  if [ "$code" != "401" ]; then
    echo "[FAIL] $label -> expected 401, got $code ($url)" >&2
    cat /tmp/localai-smoke-body.txt >&2 || true
    exit 1
  fi
  echo "[OK]   $label -> 401"
}

require_env API_BASE_URL

API_BASE_URL="${API_BASE_URL%/}"
FRONTEND_URL="${FRONTEND_URL:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
RUN_COLLECT="${RUN_COLLECT:-0}"

echo "== AI Tech Radar production smoke test =="
echo "API_BASE_URL=$API_BASE_URL"
if [ -n "$FRONTEND_URL" ]; then
  echo "FRONTEND_URL=$FRONTEND_URL"
fi

if [ -n "$FRONTEND_URL" ]; then
  check_200 "frontend" "$FRONTEND_URL"
fi

check_200 "health" "$API_BASE_URL/health"
check_200 "bootstrap" "$API_BASE_URL/api/bootstrap"

if [ -n "$ADMIN_TOKEN" ]; then
  admin_status_code="$(curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" -o /tmp/localai-smoke-body.txt -w "%{http_code}" "$API_BASE_URL/api/admin/status")"
  if [ "$admin_status_code" != "200" ]; then
    echo "[FAIL] admin status -> $admin_status_code" >&2
    cat /tmp/localai-smoke-body.txt >&2 || true
    exit 1
  fi
  echo "[OK]   admin status -> 200"

  admin_jobs_code="$(curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" -o /tmp/localai-smoke-body.txt -w "%{http_code}" "$API_BASE_URL/api/admin/jobs?limit=5")"
  if [ "$admin_jobs_code" != "200" ]; then
    echo "[FAIL] admin jobs -> $admin_jobs_code" >&2
    cat /tmp/localai-smoke-body.txt >&2 || true
    exit 1
  fi
  echo "[OK]   admin jobs -> 200"

  if [ "$RUN_COLLECT" = "1" ]; then
    collect_code="$(curl -sS -X POST -H "X-Admin-Token: $ADMIN_TOKEN" -o /tmp/localai-smoke-body.txt -w "%{http_code}" "$API_BASE_URL/api/admin/collect")"
    if [ "$collect_code" != "200" ]; then
      echo "[FAIL] admin collect -> $collect_code" >&2
      cat /tmp/localai-smoke-body.txt >&2 || true
      exit 1
    fi
    echo "[OK]   admin collect -> 200"
  else
    echo "[SKIP] admin collect -> set RUN_COLLECT=1 to execute"
  fi
else
  check_401 "admin status without token" "$API_BASE_URL/api/admin/status"
  check_401 "admin jobs without token" "$API_BASE_URL/api/admin/jobs?limit=5"
  echo "[SKIP] admin collect -> provide ADMIN_TOKEN to execute"
fi

echo "== Smoke test completed =="
