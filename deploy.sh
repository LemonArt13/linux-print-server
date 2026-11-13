#!/usr/bin/env bash
# Run as the unprivileged deployment user; sudo is used only for service restart.
set -euo pipefail
umask 077
APP_ROOT=${APP_ROOT:-/opt/printflow}
REPO_DIR=${REPO_DIR:-$APP_ROOT/repo}
SERVICE=${SERVICE:-printflow.service}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:4000/api/health}
exec 9>"$APP_ROOT/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
if [[ -n $(git -C "$REPO_DIR" status --porcelain) ]]; then
  echo 'Deployment checkout has local changes; update aborted.' >&2; exit 1
fi
git -C "$REPO_DIR" pull --ff-only
revision=$(git -C "$REPO_DIR" rev-parse --short HEAD)
release="$APP_ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-$revision-$$"
mkdir -p "$release"
git -C "$REPO_DIR" archive HEAD | tar -x -C "$release"
cd "$release"
npm ci --prefix client --no-audit --no-fund
npm ci --prefix server --no-audit --no-fund
npm run build
npm prune --prefix server --omit=dev --no-audit --no-fund
# Service user must be able to read this immutable release (no secrets live here).
chmod -R a+rX "$release"
previous=$(readlink "$APP_ROOT/current" || true)
ln -s "$release" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
rollback() {
  if [[ -n "$previous" ]]; then
    ln -s "$previous" "$APP_ROOT/current.rollback"
    mv -Tf "$APP_ROOT/current.rollback" "$APP_ROOT/current"
    sudo systemctl restart "$SERVICE" || true
  else
    sudo systemctl stop "$SERVICE" || true
  fi
  echo "Deployment failed. Previous release: ${previous:-none}." >&2
  exit 1
}
sudo systemctl restart "$SERVICE" || rollback
for attempt in {1..15}; do
  if curl --silent --fail --max-time 2 "$HEALTH_URL" | /usr/bin/node -e 'let s=""; process.stdin.on("data",c=>s+=c); process.stdin.on("end",()=>{try{process.exit(JSON.parse(s).status==="ready"?0:1)}catch{process.exit(1)}})'; then
    echo "Healthy release: $release"; exit 0
  fi
  sleep 1
done
rollback
