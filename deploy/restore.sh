#!/usr/bin/env bash
# Restores a nightly backup over the live database. Everything since that backup is lost, so only
# use it when you mean to:  ./restore.sh backups/vicisrota-2026-10-04.sql.gz
set -euo pipefail
cd "$(dirname "$0")"
f=${1:?Usage: ./restore.sh backups/vicisrota-YYYY-MM-DD.sql.gz}
[ -f "$f" ] || { echo "No such file: $f"; exit 1; }
read -rp "This replaces ALL current data with $f. Type RESTORE to continue: " ok
[ "$ok" = "RESTORE" ] || { echo "Cancelled."; exit 1; }
. ./.env
docker compose stop web scheduler
docker compose exec -T db psql -U postgres -d postgres -c "DROP DATABASE vicisrota WITH (FORCE)" -c "CREATE DATABASE vicisrota OWNER vicisrota"
gunzip -c "$f" | docker compose exec -T db psql -U postgres -d vicisrota -v ON_ERROR_STOP=1 >/dev/null
docker compose up -d
echo "Restored from $f."
