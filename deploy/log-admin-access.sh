#!/usr/bin/env bash
# Logs every command run in the database with the admin login, so people's access is on record.
# The app uses its own login and is not affected. Safe to run again; install.sh and update.sh run it.
# Read the log with:  docker compose logs db
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T db psql -U postgres -d postgres -qc "ALTER ROLE postgres SET log_statement = 'all'"
