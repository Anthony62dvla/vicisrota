#!/usr/bin/env bash
# Gets the latest VicisRota from GitHub and restarts with it. Database changes apply automatically.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
echo "Updated. Running: $(git log -1 --format='%h %s')"
