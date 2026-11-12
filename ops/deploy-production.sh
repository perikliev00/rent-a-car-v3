#!/usr/bin/env bash
# Run the shell command that performs this deployment or validation step.
set -Eeuo pipefail

# Set the ROOT shell variable.
ROOT="${RENTACAR_ROOT:-/opt/rentacar}"
# Set the COMPOSE_FILE shell variable.
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.aws.yml}"
# Set the ENV_FILE shell variable.
ENV_FILE="${COMPOSE_ENV_FILE:-$ROOT/config/compose.env}"
# Set the RELEASE_FILE shell variable.
RELEASE_FILE="${1:-}"
# Set the ASSET_ROOT shell variable.
ASSET_ROOT="${2:-$(dirname "$0")}" 
# Set the PAYLOAD_COMPOSE shell variable.
PAYLOAD_COMPOSE="$ASSET_ROOT/docker-compose.aws.yml"
# Set the PAYLOAD_MONITORING shell variable.
PAYLOAD_MONITORING="$ASSET_ROOT/monitoring"

# Evaluate the shell condition before running the branch body.
if [[ -z "$RELEASE_FILE" || ! -f "$RELEASE_FILE" ]]; then
  # Write a status message to the terminal.
  echo "Usage: $0 /path/to/verified-release.env [/path/to/deployment-assets]" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Start a shell for-loop over the given items.
for command in docker curl awk grep mktemp cp mv rm mkdir; do
  # Evaluate the shell condition before running the branch body.
  if ! command -v "$command" >/dev/null 2>&1; then
    # Write a status message to the terminal.
    echo "Required command is missing: $command" >&2
    # Stop the script with the specified exit status.
    exit 2
  # Close the conditional block.
  fi
# Close the loop body.
done

# Evaluate the shell condition before running the branch body.
if [[ ! -f "$ENV_FILE" ]]; then
  # Write a status message to the terminal.
  echo "Compose environment file not found: $ENV_FILE" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Evaluate the shell condition before running the branch body.
if [[ ! -f "$PAYLOAD_COMPOSE" ]]; then
  # Write a status message to the terminal.
  echo "Deployment payload compose file not found: $PAYLOAD_COMPOSE" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Evaluate the shell condition before running the branch body.
if [[ ! -d "$PAYLOAD_MONITORING" ]]; then
  # Write a status message to the terminal.
  echo "Deployment payload monitoring directory not found: $PAYLOAD_MONITORING" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
read_compose_env_value() {
  # Run the shell command that performs this deployment or validation step.
  local key="$1"
  # Run the shell command that performs this deployment or validation step.
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

# Fail before any live compose.env / infrastructure replacement when SMTP env is missing.
ALERTMANAGER_ENV_FILE_PATH="$(read_compose_env_value ALERTMANAGER_ENV_FILE)"
# Set the ALERTMANAGER_ENV_FILE_PATH shell variable.
ALERTMANAGER_ENV_FILE_PATH="${ALERTMANAGER_ENV_FILE_PATH:-/opt/rentacar/config/alertmanager.env}"

# Evaluate the shell condition before running the branch body.
if [[ ! -f "$ALERTMANAGER_ENV_FILE_PATH" ]]; then
  # Write a status message to the terminal.
  echo "Alertmanager environment file not found: $ALERTMANAGER_ENV_FILE_PATH" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Production AWS requires real SMTP email delivery. An empty/incomplete file must not
# silently fall through to the disabled Alertmanager webhook fallback.
# Never print variable values (especially ALERT_SMTP_PASSWORD).
require_alertmanager_smtp_config() {
  # Run the shell command that performs this deployment or validation step.
  local env_file="$1"
  # Run the shell command that performs this deployment or validation step.
  local missing=""
  # Run the shell command that performs this deployment or validation step.
  local key
  # Run the shell command that performs this deployment or validation step.
  local value

  # Start a shell for-loop over the given items.
  for key in \
    # Run the shell command that performs this deployment or validation step.
    ALERT_SMTP_HOST \
    # Run the shell command that performs this deployment or validation step.
    ALERT_SMTP_PORT \
    # Run the shell command that performs this deployment or validation step.
    ALERT_SMTP_FROM \
    # Run the shell command that performs this deployment or validation step.
    ALERT_SMTP_USERNAME \
    # Run the shell command that performs this deployment or validation step.
    ALERT_SMTP_PASSWORD \
    # Run the shell command that performs this deployment or validation step.
    ALERT_EMAIL_TO
  # Begin the loop body.
  do
    # Set the value shell variable.
    value="$(awk -F= -v key="$key" '
      # Run the shell command that performs this deployment or validation step.
      $1 == key {
        # Run the shell command that performs this deployment or validation step.
        sub(/^[^=]*=/, "")
        # Run the shell command that performs this deployment or validation step.
        print
        # Stop the script with the specified exit status.
        exit
      }
    # Run the shell command that performs this deployment or validation step.
    ' "$env_file")"
    # Set the value shell variable.
    value="${value#"${value%%[![:space:]]*}"}"
    # Set the value shell variable.
    value="${value%"${value##*[![:space:]]}"}"
    # Evaluate the shell condition before running the branch body.
    if [[ -z "$value" ]]; then
      # Run the shell command that performs this deployment or validation step.
      missing+=" $key"
    # Close the conditional block.
    fi
  # Close the loop body.
  done

  # Evaluate the shell condition before running the branch body.
  if [[ -n "$missing" ]]; then
    # Write a status message to the terminal.
    echo "Alertmanager environment file is missing required SMTP variable(s):${missing}" >&2
    # Write a status message to the terminal.
    echo "File: $env_file" >&2
    # Stop the script with the specified exit status.
    exit 2
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
require_alertmanager_smtp_config "$ALERTMANAGER_ENV_FILE_PATH"

# Compose interpolation keys must be present in compose.env (--env-file).
# These are distinct from service env_file values (e.g. backend.env).
# Never print variable values.
require_compose_interpolation_keys() {
  # Run the shell command that performs this deployment or validation step.
  local env_file="$1"
  # Run the shell command that performs this deployment or validation step.
  local missing=""
  # Run the shell command that performs this deployment or validation step.
  local key
  # Run the shell command that performs this deployment or validation step.
  local value

  # Start a shell for-loop over the given items.
  for key in \
    # Run the shell command that performs this deployment or validation step.
    POSTGRES_PASSWORD \
    # Run the shell command that performs this deployment or validation step.
    APP_DB_PASSWORD \
    # Run the shell command that performs this deployment or validation step.
    METRICS_TOKEN \
    # Run the shell command that performs this deployment or validation step.
    GRAFANA_ADMIN_PASSWORD \
    # Run the shell command that performs this deployment or validation step.
    API_IMAGE \
    # Run the shell command that performs this deployment or validation step.
    CUSTOMER_IMAGE \
    # Run the shell command that performs this deployment or validation step.
    ADMIN_IMAGE
  # Begin the loop body.
  do
    # Set the value shell variable.
    value="$(awk -F= -v key="$key" '
      # Run the shell command that performs this deployment or validation step.
      $1 == key {
        # Run the shell command that performs this deployment or validation step.
        sub(/^[^=]*=/, "")
        # Run the shell command that performs this deployment or validation step.
        print
        # Stop the script with the specified exit status.
        exit
      }
    # Run the shell command that performs this deployment or validation step.
    ' "$env_file")"
    # Set the value shell variable.
    value="${value#"${value%%[![:space:]]*}"}"
    # Set the value shell variable.
    value="${value%"${value##*[![:space:]]}"}"
    # Evaluate the shell condition before running the branch body.
    if [[ -z "$value" ]]; then
      # Run the shell command that performs this deployment or validation step.
      missing+=" $key"
    # Close the conditional block.
    fi
  # Close the loop body.
  done

  # Evaluate the shell condition before running the branch body.
  if [[ -n "$missing" ]]; then
    # Write a status message to the terminal.
    echo "Compose environment file is missing required variable(s):${missing}" >&2
    # Write a status message to the terminal.
    echo "File: $env_file" >&2
    # Write a status message to the terminal.
    echo "APP_DB_PASSWORD is used for Compose interpolation into DATABASE_URL (luxride_app)." >&2
    # Write a status message to the terminal.
    echo "It must live in compose.env, not only in backend.env." >&2
    # Stop the script with the specified exit status.
    exit 2
  # Close the conditional block.
  fi

  # Set the value shell variable.
  value="$(awk -F= -v key="APP_DB_PASSWORD" '
    # Run the shell command that performs this deployment or validation step.
    $1 == key {
      # Run the shell command that performs this deployment or validation step.
      sub(/^[^=]*=/, "")
      # Run the shell command that performs this deployment or validation step.
      print
      # Stop the script with the specified exit status.
      exit
    }
  # Run the shell command that performs this deployment or validation step.
  ' "$env_file")"
  # Set the value shell variable.
  value="${value#"${value%%[![:space:]]*}"}"
  # Set the value shell variable.
  value="${value%"${value##*[![:space:]]}"}"
  # Evaluate the shell condition before running the branch body.
  if [[ "${#value}" -lt 16 ]]; then
    # Write a status message to the terminal.
    echo "APP_DB_PASSWORD in $env_file must be at least 16 characters" >&2
    # Stop the script with the specified exit status.
    exit 2
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
require_compose_interpolation_keys "$ENV_FILE"

# Run the shell command that performs this deployment or validation step.
read_release_value() {
  # Run the shell command that performs this deployment or validation step.
  local key="$1"
  # Run the shell command that performs this deployment or validation step.
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$RELEASE_FILE"
}

# Run the shell command that performs this deployment or validation step.
read_env_value() {
  # Run the shell command that performs this deployment or validation step.
  local key="$1"
  # Run the shell command that performs this deployment or validation step.
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

# Set the IMAGE_TAG shell variable.
IMAGE_TAG="$(read_release_value IMAGE_TAG)"
# Set the API_IMAGE shell variable.
API_IMAGE="$(read_release_value API_IMAGE)"
# Set the CUSTOMER_IMAGE shell variable.
CUSTOMER_IMAGE="$(read_release_value CUSTOMER_IMAGE)"
# Set the ADMIN_IMAGE shell variable.
ADMIN_IMAGE="$(read_release_value ADMIN_IMAGE)"

# Evaluate the shell condition before running the branch body.
if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  # Write a status message to the terminal.
  echo "Invalid release IMAGE_TAG" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
validate_image() {
  # Run the shell command that performs this deployment or validation step.
  local value="$1"
  # Run the shell command that performs this deployment or validation step.
  local repository="$2"
  # Run the shell command that performs this deployment or validation step.
  local pattern="^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/${repository}@sha256:[0-9a-f]{64}$"

  # Evaluate the shell condition before running the branch body.
  if [[ ! "$value" =~ $pattern ]]; then
    # Write a status message to the terminal.
    echo "Invalid immutable ECR reference for ${repository}" >&2
    # Stop the script with the specified exit status.
    exit 2
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
validate_image "$API_IMAGE" "rentacar-api"
# Run the shell command that performs this deployment or validation step.
validate_image "$CUSTOMER_IMAGE" "rentacar-customer"
# Run the shell command that performs this deployment or validation step.
validate_image "$ADMIN_IMAGE" "rentacar-admin"

# Set the API_REGISTRY shell variable.
API_REGISTRY="${API_IMAGE%%/*}"
# Set the CUSTOMER_REGISTRY shell variable.
CUSTOMER_REGISTRY="${CUSTOMER_IMAGE%%/*}"
# Set the ADMIN_REGISTRY shell variable.
ADMIN_REGISTRY="${ADMIN_IMAGE%%/*}"

# Evaluate the shell condition before running the branch body.
if [[ "$API_REGISTRY" != "$CUSTOMER_REGISTRY" || "$API_REGISTRY" != "$ADMIN_REGISTRY" ]]; then
  # Write a status message to the terminal.
  echo "Release images do not belong to the same ECR registry" >&2
  # Stop the script with the specified exit status.
  exit 2
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
compose() {
  # Run the shell command that performs this deployment or validation step.
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# Run the shell command that performs this deployment or validation step.
wait_http() {
  # Run the shell command that performs this deployment or validation step.
  local url="$1"
  # Run the shell command that performs this deployment or validation step.
  local label="$2"
  # Run the shell command that performs this deployment or validation step.
  local attempts="${3:-30}"

  # Start a shell for-loop over the given items.
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    # Evaluate the shell condition before running the branch body.
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null 2>&1; then
      # Write a status message to the terminal.
      echo "$label is responding"
      # Run the shell command that performs this deployment or validation step.
      return 0
    # Close the conditional block.
    fi
    # Run the shell command that performs this deployment or validation step.
    sleep 4
  # Close the loop body.
  done

  # Write a status message to the terminal.
  echo "$label did not become ready: $url" >&2
  # Run the shell command that performs this deployment or validation step.
  return 1
}

# Run the shell command that performs this deployment or validation step.
assert_running() {
  # Run the shell command that performs this deployment or validation step.
  local service="$1"
  # Run the shell command that performs this deployment or validation step.
  local container_id
  # Run the shell command that performs this deployment or validation step.
  local state

  # Set the container_id shell variable.
  container_id="$(compose ps -q "$service")"
  # Evaluate the shell condition before running the branch body.
  if [[ -z "$container_id" ]]; then
    # Write a status message to the terminal.
    echo "Service has no container: $service" >&2
    # Run the shell command that performs this deployment or validation step.
    return 1
  # Close the conditional block.
  fi

  # Set the state shell variable.
  state="$(docker inspect "$container_id" --format '{{.State.Status}}')"
  # Evaluate the shell condition before running the branch body.
  if [[ "$state" != "running" ]]; then
    # Write a status message to the terminal.
    echo "Service is not running: $service ($state)" >&2
    # Run the shell command that performs this deployment or validation step.
    return 1
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
assert_image() {
  # Run the shell command that performs this deployment or validation step.
  local service="$1"
  # Run the shell command that performs this deployment or validation step.
  local expected="$2"
  # Run the shell command that performs this deployment or validation step.
  local container_id
  # Run the shell command that performs this deployment or validation step.
  local actual

  # Set the container_id shell variable.
  container_id="$(compose ps -q "$service")"
  # Set the actual shell variable.
  actual="$(docker inspect "$container_id" --format '{{.Config.Image}}')"

  # Evaluate the shell condition before running the branch body.
  if [[ "$actual" != "$expected" ]]; then
    # Write a status message to the terminal.
    echo "Unexpected image for $service" >&2
    # Write a status message to the terminal.
    echo "Expected: $expected" >&2
    # Write a status message to the terminal.
    echo "Actual:   $actual" >&2
    # Run the shell command that performs this deployment or validation step.
    return 1
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
cd "$ROOT"

# Run the shell command that performs this deployment or validation step.
mkdir -p "$ROOT/config/deploy-backups"
# Set the TIMESTAMP shell variable.
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
# Set the BACKUP_FILE shell variable.
BACKUP_FILE="$ROOT/config/deploy-backups/compose.env.$TIMESTAMP"
# Set the INFRA_BACKUP_DIR shell variable.
INFRA_BACKUP_DIR="$ROOT/config/deploy-backups/infra.$TIMESTAMP"
# Set the CANDIDATE_FILE shell variable.
CANDIDATE_FILE="$(mktemp "$ROOT/config/.compose.env.XXXXXX")"
# Set the COMPOSE_CANDIDATE shell variable.
COMPOSE_CANDIDATE="$ROOT/.docker-compose.aws.yml.$TIMESTAMP.new"
# Set the MONITORING_CANDIDATE shell variable.
MONITORING_CANDIDATE="$ROOT/.monitoring.$TIMESTAMP.new"
# Set the ROLLBACK_ARMED shell variable.
ROLLBACK_ARMED=0

# Run the shell command that performs this deployment or validation step.
cleanup() {
  # Run the shell command that performs this deployment or validation step.
  rm -f "$CANDIDATE_FILE" "$COMPOSE_CANDIDATE"
  # Run the shell command that performs this deployment or validation step.
  rm -rf "$MONITORING_CANDIDATE"
}

# Run the shell command that performs this deployment or validation step.
restore_infrastructure() {
  # Evaluate the shell condition before running the branch body.
  if [[ -f "$INFRA_BACKUP_DIR/docker-compose.aws.yml" ]]; then
    # Run the shell command that performs this deployment or validation step.
    cp -a "$INFRA_BACKUP_DIR/docker-compose.aws.yml" "$COMPOSE_FILE"
  # Test an additional condition in the if-chain.
  elif [[ -f "$INFRA_BACKUP_DIR/compose.absent" ]]; then
    # Run the shell command that performs this deployment or validation step.
    rm -f "$COMPOSE_FILE"
  # Close the conditional block.
  fi

  # Evaluate the shell condition before running the branch body.
  if [[ -d "$INFRA_BACKUP_DIR/monitoring" ]]; then
    # Run the shell command that performs this deployment or validation step.
    rm -rf "$ROOT/monitoring"
    # Run the shell command that performs this deployment or validation step.
    cp -a "$INFRA_BACKUP_DIR/monitoring" "$ROOT/monitoring"
  # Test an additional condition in the if-chain.
  elif [[ -f "$INFRA_BACKUP_DIR/monitoring.absent" ]]; then
    # Run the shell command that performs this deployment or validation step.
    rm -rf "$ROOT/monitoring"
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
rollback() {
  # Run the shell command that performs this deployment or validation step.
  local exit_code=$?
  # Run the shell command that performs this deployment or validation step.
  trap - ERR

  # Evaluate the shell condition before running the branch body.
  if [[ "$ROLLBACK_ARMED" == "1" ]]; then
    # Write a status message to the terminal.
    echo "Deployment failed. Restoring previous release configuration and infrastructure..." >&2

    # Evaluate the shell condition before running the branch body.
    if [[ -f "$BACKUP_FILE" ]]; then
      # Run the shell command that performs this deployment or validation step.
      cp -a "$BACKUP_FILE" "$ENV_FILE"
    # Close the conditional block.
    fi

    # Run the shell command that performs this deployment or validation step.
    restore_infrastructure

    # Evaluate the shell condition before running the branch body.
    if [[ -f "$COMPOSE_FILE" ]]; then
      # Run the shell command that performs this deployment or validation step.
      compose pull backend worker customer admin >/dev/null 2>&1 || true
      # Run the shell command that performs this deployment or validation step.
      compose up -d --remove-orphans || true
    # Close the conditional block.
    fi
  # Close the conditional block.
  fi

  # Run the shell command that performs this deployment or validation step.
  cleanup
  # Stop the script with the specified exit status.
  exit "$exit_code"
}

# Run the shell command that performs this deployment or validation step.
trap cleanup EXIT
# Run the shell command that performs this deployment or validation step.
trap rollback ERR

# Run the shell command that performs this deployment or validation step.
cp -a "$ENV_FILE" "$BACKUP_FILE"
# Run the shell command that performs this deployment or validation step.
mkdir -p "$INFRA_BACKUP_DIR"
# Run the shell command that performs this deployment or validation step.
chmod 700 "$INFRA_BACKUP_DIR" || true

# Evaluate the shell condition before running the branch body.
if [[ -f "$COMPOSE_FILE" ]]; then
  # Run the shell command that performs this deployment or validation step.
  cp -a "$COMPOSE_FILE" "$INFRA_BACKUP_DIR/docker-compose.aws.yml"
# Begin the fallback branch of the conditional.
else
  # Run the shell command that performs this deployment or validation step.
  touch "$INFRA_BACKUP_DIR/compose.absent"
# Close the conditional block.
fi

# Evaluate the shell condition before running the branch body.
if [[ -d "$ROOT/monitoring" ]]; then
  # Run the shell command that performs this deployment or validation step.
  cp -a "$ROOT/monitoring" "$INFRA_BACKUP_DIR/monitoring"
# Begin the fallback branch of the conditional.
else
  # Run the shell command that performs this deployment or validation step.
  touch "$INFRA_BACKUP_DIR/monitoring.absent"
# Close the conditional block.
fi

# Evaluate the shell condition before running the branch body.
if ! awk \
  # Run the shell command that performs this deployment or validation step.
  -v api="$API_IMAGE" \
  # Run the shell command that performs this deployment or validation step.
  -v customer="$CUSTOMER_IMAGE" \
  # Run the shell command that performs this deployment or validation step.
  -v admin="$ADMIN_IMAGE" '
    # Run the shell command that performs this deployment or validation step.
    BEGIN { api_seen = 0; customer_seen = 0; admin_seen = 0 }
    # Run the shell command that performs this deployment or validation step.
    /^API_IMAGE=/      { print "API_IMAGE=" api; api_seen = 1; next }
    # Run the shell command that performs this deployment or validation step.
    /^CUSTOMER_IMAGE=/ { print "CUSTOMER_IMAGE=" customer; customer_seen = 1; next }
    # Run the shell command that performs this deployment or validation step.
    /^ADMIN_IMAGE=/    { print "ADMIN_IMAGE=" admin; admin_seen = 1; next }
    # Run the shell command that performs this deployment or validation step.
    { print }
    # Run the shell command that performs this deployment or validation step.
    END {
      # Evaluate the shell condition before running the branch body.
      if (!api_seen || !customer_seen || !admin_seen) {
        # Stop the script with the specified exit status.
        exit 42
      }
    }
  # Run the shell command that performs this deployment or validation step.
  ' "$ENV_FILE" > "$CANDIDATE_FILE"; then
  # Write a status message to the terminal.
  echo "compose.env is missing one or more image keys" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
chmod --reference="$ENV_FILE" "$CANDIDATE_FILE"
# Evaluate the shell condition before running the branch body.
if command -v chown >/dev/null 2>&1; then
  # Run the shell command that performs this deployment or validation step.
  chown --reference="$ENV_FILE" "$CANDIDATE_FILE" 2>/dev/null || true
# Close the conditional block.
fi

# Validate the exact compose payload from the release commit before touching live infrastructure.
docker compose --env-file "$CANDIDATE_FILE" -f "$PAYLOAD_COMPOSE" config --quiet

# Stage infrastructure on the same filesystem so final moves are local and predictable.
cp -a "$PAYLOAD_COMPOSE" "$COMPOSE_CANDIDATE"
# Run the shell command that performs this deployment or validation step.
cp -a "$PAYLOAD_MONITORING" "$MONITORING_CANDIDATE"

# Set the ROLLBACK_ARMED shell variable.
ROLLBACK_ARMED=1
# Run the shell command that performs this deployment or validation step.
mv "$CANDIDATE_FILE" "$ENV_FILE"
# Run the shell command that performs this deployment or validation step.
mv "$COMPOSE_CANDIDATE" "$COMPOSE_FILE"
# Run the shell command that performs this deployment or validation step.
rm -rf "$ROOT/monitoring"
# Run the shell command that performs this deployment or validation step.
mv "$MONITORING_CANDIDATE" "$ROOT/monitoring"

# Append formatted text using printf.
printf 'Deploying commit %s\n' "$IMAGE_TAG"
# Append formatted text using printf.
printf 'API image:      %s\n' "$API_IMAGE"
# Append formatted text using printf.
printf 'Customer image: %s\n' "$CUSTOMER_IMAGE"
# Append formatted text using printf.
printf 'Admin image:    %s\n' "$ADMIN_IMAGE"

# Pull first so registry/network failures happen before application containers are touched.
compose pull backend worker customer admin prometheus alertmanager grafana

# Pause background jobs while the API container runs its startup database setup.
compose stop worker >/dev/null 2>&1 || true
# Run the shell command that performs this deployment or validation step.
compose up -d db
# Run the shell command that performs this deployment or validation step.
compose up -d backend
# Run the shell command that performs this deployment or validation step.
wait_http "http://127.0.0.1:3000/ready" "Backend readiness" 30

# Start the worker only after the API is healthy, then update both frontends.
compose up -d worker customer admin
# Run the shell command that performs this deployment or validation step.
wait_http "http://127.0.0.1:8081/" "Customer frontend" 20
# Run the shell command that performs this deployment or validation step.
wait_http "http://127.0.0.1:8082/" "Admin frontend" 20

# Start monitoring only after the application path is healthy.
compose up -d alertmanager prometheus grafana
# Run the shell command that performs this deployment or validation step.
wait_http "http://127.0.0.1:9093/-/ready" "Alertmanager" 20
# Run the shell command that performs this deployment or validation step.
wait_http "http://127.0.0.1:9090/-/ready" "Prometheus" 20
# Run the shell command that performs this deployment or validation step.
wait_http "http://127.0.0.1:3001/api/health" "Grafana" 30

# Start a shell for-loop over the given items.
for service in db backend worker customer admin prometheus alertmanager grafana; do
  # Run the shell command that performs this deployment or validation step.
  assert_running "$service"
# Close the loop body.
done

# Run the shell command that performs this deployment or validation step.
assert_image backend "$API_IMAGE"
# Run the shell command that performs this deployment or validation step.
assert_image worker "$API_IMAGE"
# Run the shell command that performs this deployment or validation step.
assert_image customer "$CUSTOMER_IMAGE"
# Run the shell command that performs this deployment or validation step.
assert_image admin "$ADMIN_IMAGE"

# Assign the sensitive METRICS_TOKEN value for later use.
METRICS_TOKEN="$(read_env_value METRICS_TOKEN)"
# Evaluate the shell condition before running the branch body.
if [[ -z "$METRICS_TOKEN" ]]; then
  # Write a status message to the terminal.
  echo "METRICS_TOKEN is unexpectedly empty after compose validation" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi

# Evaluate the shell condition before running the branch body.
if ! curl --fail --silent --show-error --max-time 5 \
  # Run the shell command that performs this deployment or validation step.
  -H "Authorization: Bearer $METRICS_TOKEN" \
  # Run the shell command that performs this deployment or validation step.
  http://127.0.0.1:3000/prometheus >/dev/null; then
  # Write a status message to the terminal.
  echo "Authenticated backend Prometheus endpoint check failed" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi

# Write a status message to the terminal.
echo "Authenticated backend Prometheus endpoint is responding"

# Run the shell command that performs this deployment or validation step.
cat > "$ROOT/config/current-release.env" <<EOF
# Set the IMAGE_TAG shell variable.
IMAGE_TAG=$IMAGE_TAG
# Set the API_IMAGE shell variable.
API_IMAGE=$API_IMAGE
# Set the CUSTOMER_IMAGE shell variable.
CUSTOMER_IMAGE=$CUSTOMER_IMAGE
# Set the ADMIN_IMAGE shell variable.
ADMIN_IMAGE=$ADMIN_IMAGE
# Set the DEPLOYED_AT shell variable.
DEPLOYED_AT=$TIMESTAMP
# Run the shell command that performs this deployment or validation step.
EOF

# Run the shell command that performs this deployment or validation step.
chmod 600 "$ROOT/config/current-release.env" || true

# Run the shell command that performs this deployment or validation step.
trap - ERR
# Set the ROLLBACK_ARMED shell variable.
ROLLBACK_ARMED=0

# Write a status message to the terminal.
echo "Production deployment completed successfully."
# Run the shell command that performs this deployment or validation step.
compose ps
