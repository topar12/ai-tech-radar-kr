#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/index.html" "$ROOT_DIR/styles.css" "$ROOT_DIR/app.js" "$DIST_DIR/"
printf 'window.RADAR_API_BASE_URL = "%s";\n' "${RADAR_API_BASE_URL:-}" > "$DIST_DIR/runtime-config.js"
