#!/usr/bin/env bash
# Deploy to the VPS: build + run one service or everything.
# Usage:  bash deploy.sh [path-to-package] [extra compose args...]
#   bash deploy.sh                # everything (all packages with compose.yaml)
#   bash deploy.sh packages/web/app1
#   bash deploy.sh packages/backend/api1
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

PKG="${1:-all}"
shift 2>/dev/null || true

if [ "$PKG" = "all" ]; then
  echo "==> building & starting all packages"
  docker compose up -d --build "$@"
else
  if [ ! -f "$PKG/compose.yaml" ]; then
    echo "no compose.yaml in $PKG — nothing to deploy"; exit 1
  fi
  if [ ! -f "$PKG/.env" ]; then
    echo "missing $PKG/.env — copy .env.example and edit first"; exit 1
  fi
  echo "==> building & starting $PKG"
  docker compose -f "$PKG/compose.yaml" up -d --build "$@"
fi

echo "==> pruning dangling images"
docker system prune -f >/dev/null 2>&1 || true

PORT="$(grep -Eo '[0-9]+:[0-9]+' "$PKG/compose.yaml" 2>/dev/null | head -1 | cut -d: -f1 || true)"
if [ -n "${PORT:-}" ] && [ "$PKG" != "all" ]; then
  curl -sf "http://localhost:${PORT}/health" && echo " -> healthy on :${PORT}" || echo "health check failed on :${PORT}"
fi

echo "done."
