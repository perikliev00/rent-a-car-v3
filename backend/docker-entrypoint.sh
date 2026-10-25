#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

use_local_database() {
  case "${USE_LOCAL_DATABASE:-}" in
    1|true|yes) return 0 ;;
    *) return 1 ;;
  esac
}

rewrite_loopback() {
  printf '%s' "$1" | sed 's/@localhost:/@host.docker.internal:/; s/@127.0.0.1:/@host.docker.internal:/'
}

if use_local_database; then
  DATABASE_URL="$(rewrite_loopback "$DATABASE_URL")"
  export DATABASE_URL
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    MIGRATION_DATABASE_URL="$(rewrite_loopback "$MIGRATION_DATABASE_URL")"
    export MIGRATION_DATABASE_URL
  fi
  echo "Using host PostgreSQL via host.docker.internal"
fi

# The runtime URL may point at a role that does not exist until setup runs.
# Wait on the migration connection when this process is allowed to bootstrap.
RUNTIME_DATABASE_URL="$DATABASE_URL"
if [ "${SKIP_DB_SETUP:-false}" = "true" ]; then
  WAIT_DATABASE_URL="$RUNTIME_DATABASE_URL"
else
  WAIT_DATABASE_URL="${MIGRATION_DATABASE_URL:-$RUNTIME_DATABASE_URL}"
fi

echo "Waiting for PostgreSQL..."
until DATABASE_URL="$WAIT_DATABASE_URL" node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => client.end())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

if [ "${SKIP_DB_SETUP:-false}" = "true" ]; then
  echo "Skipping database setup for this process"
else
  echo "Running database setup..."
  DATABASE_URL="${MIGRATION_DATABASE_URL:-$RUNTIME_DATABASE_URL}" npm run db:setup
  if [ -n "${MIGRATION_DATABASE_URL:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ]; then
    DATABASE_URL="$MIGRATION_DATABASE_URL" node sql/ensureRuntimeRole.js
  fi
fi

# The application process keeps only the runtime connection.
unset MIGRATION_DATABASE_URL
unset APP_DB_PASSWORD
unset POSTGRES_PASSWORD
export DATABASE_URL="$RUNTIME_DATABASE_URL"

echo "Starting application..."
exec "$@"
