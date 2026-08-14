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

if use_local_database; then
  case "$DATABASE_URL" in
    *@localhost:*|*@127.0.0.1:*)
      DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed 's/@localhost:/@host.docker.internal:/; s/@127.0.0.1:/@host.docker.internal:/')"
      export DATABASE_URL
      echo "Using host PostgreSQL via host.docker.internal"
      ;;
  esac
fi

echo "Waiting for PostgreSQL..."
until node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => client.end())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "Running database setup..."
npm run db:setup

echo "Starting application..."
exec "$@"
