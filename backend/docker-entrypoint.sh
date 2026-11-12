#!/bin/sh
# Run the shell command that performs this deployment or validation step.
set -e

# Evaluate the shell condition before running the branch body.
if [ -z "$DATABASE_URL" ]; then
  # Write a status message to the terminal.
  echo "DATABASE_URL is not set" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
use_local_database() {
  # Run the shell command that performs this deployment or validation step.
  case "${USE_LOCAL_DATABASE:-}" in
    # Run the shell command that performs this deployment or validation step.
    1|true|yes) return 0 ;;
    # Run the shell command that performs this deployment or validation step.
    *) return 1 ;;
  # Run the shell command that performs this deployment or validation step.
  esac
}

# Run the shell command that performs this deployment or validation step.
rewrite_loopback() {
  # Append formatted text using printf.
  printf '%s' "$1" | sed 's/@localhost:/@host.docker.internal:/; s/@127.0.0.1:/@host.docker.internal:/'
}

# Evaluate the shell condition before running the branch body.
if use_local_database; then
  # Set the DATABASE_URL shell variable.
  DATABASE_URL="$(rewrite_loopback "$DATABASE_URL")"
  # Run the shell command that performs this deployment or validation step.
  export DATABASE_URL
  # Evaluate the shell condition before running the branch body.
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    # Set the MIGRATION_DATABASE_URL shell variable.
    MIGRATION_DATABASE_URL="$(rewrite_loopback "$MIGRATION_DATABASE_URL")"
    # Run the shell command that performs this deployment or validation step.
    export MIGRATION_DATABASE_URL
  # Close the conditional block.
  fi
  # Write a status message to the terminal.
  echo "Using host PostgreSQL via host.docker.internal"
# Close the conditional block.
fi

# The runtime URL may point at a role that does not exist until setup runs.
# Wait on the migration connection when this process is allowed to bootstrap.
RUNTIME_DATABASE_URL="$DATABASE_URL"
# Evaluate the shell condition before running the branch body.
if [ "${SKIP_DB_SETUP:-false}" = "true" ]; then
  # Set the WAIT_DATABASE_URL shell variable.
  WAIT_DATABASE_URL="$RUNTIME_DATABASE_URL"
# Begin the fallback branch of the conditional.
else
  # Set the WAIT_DATABASE_URL shell variable.
  WAIT_DATABASE_URL="${MIGRATION_DATABASE_URL:-$RUNTIME_DATABASE_URL}"
# Close the conditional block.
fi

# Write a status message to the terminal.
echo "Waiting for PostgreSQL..."
# Run the shell command that performs this deployment or validation step.
until DATABASE_URL="$WAIT_DATABASE_URL" node -e "
  # Run the shell command that performs this deployment or validation step.
  const { Client } = require('pg');
  # Run the shell command that performs this deployment or validation step.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  # Run the shell command that performs this deployment or validation step.
  client.connect()
    # Run the shell command that performs this deployment or validation step.
    .then(() => client.end())
    # Run the shell command that performs this deployment or validation step.
    .then(() => process.exit(0))
    # Run the shell command that performs this deployment or validation step.
    .catch(() => process.exit(1));
# Run the shell command that performs this deployment or validation step.
" 2>/dev/null; do
  # Run the shell command that performs this deployment or validation step.
  sleep 2
# Close the loop body.
done

# Evaluate the shell condition before running the branch body.
if [ "${SKIP_DB_SETUP:-false}" = "true" ]; then
  # Write a status message to the terminal.
  echo "Skipping database setup for this process"
# Begin the fallback branch of the conditional.
else
  # Write a status message to the terminal.
  echo "Running database setup..."
  # Set the DATABASE_URL shell variable.
  DATABASE_URL="${MIGRATION_DATABASE_URL:-$RUNTIME_DATABASE_URL}" npm run db:setup
  # Evaluate the shell condition before running the branch body.
  if [ -n "${MIGRATION_DATABASE_URL:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ]; then
    # Set the DATABASE_URL shell variable.
    DATABASE_URL="$MIGRATION_DATABASE_URL" node sql/ensureRuntimeRole.js
  # Close the conditional block.
  fi
# Close the conditional block.
fi

# The application process keeps only the runtime connection.
unset MIGRATION_DATABASE_URL
# Remove the variable from the environment after use.
unset APP_DB_PASSWORD
# Remove the variable from the environment after use.
unset POSTGRES_PASSWORD
# Run the shell command that performs this deployment or validation step.
export DATABASE_URL="$RUNTIME_DATABASE_URL"

# Write a status message to the terminal.
echo "Starting application..."
# Run the shell command that performs this deployment or validation step.
exec "$@"
