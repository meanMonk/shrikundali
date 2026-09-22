#!/usr/bin/env bash
# Sync ONLY the .env files to the VPS and apply them.
#   frontend: PUBLIC_* are baked at build time -> rebuild the image
#   backend:  env_file is read at runtime      -> recreate the container
#
# Usage:
#   bash vps/sync-env.sh            # both
#   bash vps/sync-env.sh frontend
#   bash vps/sync-env.sh backend
#
# Override target with env vars if needed:
#   REMOTE_HOST=contabo REPO_DIR=/root/workspace/shrikundali bash vps/sync-env.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

SERVICE="${1:-all}"
REMOTE_HOST="${REMOTE_HOST:-contabo}"
REPO_DIR="${REPO_DIR:-/root/workspace/shrikundali}"

FE="packages/web/kundaliweb"
BE="packages/backend/kundaliapi"

case "$SERVICE" in
  frontend|backend|all) ;;
  *) echo "usage: $0 [frontend|backend|all]"; exit 1 ;;
esac

echo "==> Syncing .env -> $REMOTE_HOST:$REPO_DIR ($SERVICE)"

if [ "$SERVICE" = "frontend" ] || [ "$SERVICE" = "all" ]; then
  [ -f "$FE/.env" ] || { echo "missing $FE/.env"; exit 1; }
  rsync -avz "$FE/.env" "$REMOTE_HOST:$REPO_DIR/$FE/.env"
fi

if [ "$SERVICE" = "backend" ] || [ "$SERVICE" = "all" ]; then
  [ -f "$BE/.env" ] || { echo "missing $BE/.env"; exit 1; }
  rsync -avz "$BE/.env" "$REMOTE_HOST:$REPO_DIR/$BE/.env"
fi

ssh "$REMOTE_HOST" "SERVICE='$SERVICE' REPO_DIR='$REPO_DIR' bash -s" <<'REMOTE'
set -euo pipefail
cd "$REPO_DIR"

apply_backend() {
  echo "==> backend: recreating container (runtime env)"
  docker compose -f packages/backend/kundaliapi/compose.yaml up -d --force-recreate
}

apply_frontend() {
  echo "==> frontend: rebuilding image (build-time env)"
  docker compose -f packages/web/kundaliweb/compose.yaml up -d --build
}

case "$SERVICE" in
  frontend) apply_frontend ;;
  backend)  apply_backend ;;
  all)      apply_backend; apply_frontend ;;
esac

docker system prune -f >/dev/null 2>&1 || true
echo "==> env applied"
REMOTE

echo "done."
