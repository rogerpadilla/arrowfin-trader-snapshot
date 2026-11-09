#!/bin/sh
# Runtime role: not superuser, not table owner, no BYPASSRLS, so row-level security always applies to it.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE arrowfin_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE arrowfin TO arrowfin_app;
SQL
