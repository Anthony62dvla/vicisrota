#!/bin/sh
# Runs once, when the database is first created. The app uses its own role, which is not a
# superuser, so row-level security keeps every business's data apart.
set -eu
psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
CREATE ROLE vicisrota LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE vicisrota OWNER vicisrota;
SQL
psql -v ON_ERROR_STOP=1 -U postgres -d vicisrota -c "ALTER SCHEMA public OWNER TO vicisrota"
