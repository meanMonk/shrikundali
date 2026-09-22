#!/usr/bin/env bash
# Deploy shrikundali to VPS
# Usage: bash vps/deploy-shrikundali.sh [backend|frontend|all]
set -euo pipefail

SERVICE="${1:-all}"
REPO_DIR="/root/workspace/shrikundali"
REMOTE_HOST="contabo"

echo "==> Deploying shrikundali ($SERVICE)"

# Sync code to VPS
echo "[1/4] Syncing code..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '*.log' \
  ./ "$REMOTE_HOST:$REPO_DIR/"

# Deploy to VPS
echo "[2/4] Building and deploying on VPS..."
ssh "$REMOTE_HOST" SERVICE="$SERVICE" bash -s << 'DEPLOY'
set -euo pipefail
cd /root/workspace/shrikundali

# Ensure vaayu_db network exists
docker network create vaayu_db 2>/dev/null || true

# Create MinIO bucket if it doesn't exist
if docker ps --format '{{.Names}}' | grep -q vaayu-minio; then
  echo "==> Ensuring MinIO bucket exists..."
  docker exec vaayu-minio mc alias set local http://localhost:9000 admin minioadmin 2>/dev/null || true
  docker exec vaayu-minio mc mb local/shrikundali 2>/dev/null || echo "Bucket already exists"
fi

# Deploy backend
if [ "$SERVICE" = "backend" ] || [ "$SERVICE" = "all" ]; then
  echo "==> Deploying kundaliapi..."
  cd packages/backend/kundaliapi
  docker compose up -d --build
  cd ../../..
fi

# Deploy frontend
if [ "$SERVICE" = "frontend" ] || [ "$SERVICE" = "all" ]; then
  echo "==> Deploying kundaliweb..."
  cd packages/web/kundaliweb
  docker compose up -d --build
  cd ../../..
fi

# Prune old images
docker system prune -f >/dev/null 2>&1 || true

echo "==> Deployment complete"
DEPLOY

# Health check
echo "[3/4] Running health checks..."
sleep 5

if [ "$SERVICE" = "backend" ] || [ "$SERVICE" = "all" ]; then
  if curl -sf "http://$REMOTE_HOST:3400/health" >/dev/null 2>&1; then
    echo "  kundaliapi: healthy on :3400"
  else
    echo "  kundaliapi: health check failed on :3400"
  fi
fi

if [ "$SERVICE" = "frontend" ] || [ "$SERVICE" = "all" ]; then
  if curl -sf "http://$REMOTE_HOST:3001" >/dev/null 2>&1; then
    echo "  kundaliweb: healthy on :3001"
  else
    echo "  kundaliweb: health check failed on :3001"
  fi
fi

echo "[4/4] Done!"
echo ""
echo "Services:"
echo "  Backend:  http://kundaliapi.shrikundali.com"
echo "  Frontend: http://kundaliweb.shrikundali.com"
echo ""
echo "Note: Ensure DNS records are configured (see issue #15)"
