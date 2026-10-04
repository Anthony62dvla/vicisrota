#!/usr/bin/env bash
# Gives a VicisRota login superadmin access (sign up on the site first). Add --remove to take it away.
set -euo pipefail
cd "$(dirname "$0")"
if [ $# -lt 1 ]; then echo "Usage: ./superadmin.sh email [--remove]"; exit 1; fi
. ./.env
docker compose run --rm -e DATABASE_URL="postgres://vicisrota:${APP_DB_PASSWORD}@db:5432/vicisrota" migrate npm run add-superadmin -w @vicisrota/db -- "$@"
