#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RENTACAR_ROOT:-/opt/rentacar}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.aws.yml}"
ENV_FILE="${COMPOSE_ENV_FILE:-$ROOT/config/compose.env}"
RELEASE_FILE="${1:-}"
ASSET_ROOT="${2:-$(dirname "$0")}" 
PAYLOAD_COMPOSE="$ASSET_ROOT/docker-compose.aws.yml"
PAYLOAD_MONITORING="$ASSET_ROOT/monitoring"

if [[ -z "$RELEASE_FILE" || ! -f "$RELEASE_FILE" ]]; then
  echo "Usage: $0 /path/to/verified-release.env [/path/to/deployment-assets]" >&2
  exit 2
fi

for command in docker curl awk grep mktemp cp mv rm mkdir; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is missing: $command" >&2
    exit 2
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Compose environment file not found: $ENV_FILE" >&2
  exit 2
fi

if [[ ! -f "$PAYLOAD_COMPOSE" ]]; then
  echo "Deployment payload compose file not found: $PAYLOAD_COMPOSE" >&2
  exit 2
fi

if [[ ! -d "$PAYLOAD_MONITORING" ]]; then
  echo "Deployment payload monitoring directory not found: $PAYLOAD_MONITORING" >&2
  exit 2
fi

read_compose_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

# Fail before any live compose.env / infrastructure replacement when SMTP env is missing.
ALERTMANAGER_ENV_FILE_PATH="$(read_compose_env_value ALERTMANAGER_ENV_FILE)"
ALERTMANAGER_ENV_FILE_PATH="${ALERTMANAGER_ENV_FILE_PATH:-/opt/rentacar/config/alertmanager.env}"

if [[ ! -f "$ALERTMANAGER_ENV_FILE_PATH" ]]; then
  echo "Alertmanager environment file not found: $ALERTMANAGER_ENV_FILE_PATH" >&2
  exit 2
fi

# Production AWS requires real SMTP email delivery. An empty/incomplete file must not
# silently fall through to the disabled Alertmanager webhook fallback.
# Never print variable values (especially ALERT_SMTP_PASSWORD).
require_alertmanager_smtp_config() {
  local env_file="$1"
  local missing=""
  local key
  local value

  for key in \
    ALERT_SMTP_HOST \
    ALERT_SMTP_PORT \
    ALERT_SMTP_FROM \
    ALERT_SMTP_USERNAME \
    ALERT_SMTP_PASSWORD \
    ALERT_EMAIL_TO
  do
    value="$(awk -F= -v key="$key" '
      $1 == key {
        sub(/^[^=]*=/, "")
        print
        exit
      }
    ' "$env_file")"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ -z "$value" ]]; then
      missing+=" $key"
    fi
  done

  if [[ -n "$missing" ]]; then
    echo "Alertmanager environment file is missing required SMTP variable(s):${missing}" >&2
    echo "File: $env_file" >&2
    exit 2
  fi
}

require_alertmanager_smtp_config "$ALERTMANAGER_ENV_FILE_PATH"

read_release_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$RELEASE_FILE"
}

read_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

IMAGE_TAG="$(read_release_value IMAGE_TAG)"
API_IMAGE="$(read_release_value API_IMAGE)"
CUSTOMER_IMAGE="$(read_release_value CUSTOMER_IMAGE)"
ADMIN_IMAGE="$(read_release_value ADMIN_IMAGE)"

if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release IMAGE_TAG" >&2
  exit 2
fi

validate_image() {
  local value="$1"
  local repository="$2"
  local pattern="^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/${repository}@sha256:[0-9a-f]{64}$"

  if [[ ! "$value" =~ $pattern ]]; then
    echo "Invalid immutable ECR reference for ${repository}" >&2
    exit 2
  fi
}

validate_image "$API_IMAGE" "rentacar-api"
validate_image "$CUSTOMER_IMAGE" "rentacar-customer"
validate_image "$ADMIN_IMAGE" "rentacar-admin"

API_REGISTRY="${API_IMAGE%%/*}"
CUSTOMER_REGISTRY="${CUSTOMER_IMAGE%%/*}"
ADMIN_REGISTRY="${ADMIN_IMAGE%%/*}"

if [[ "$API_REGISTRY" != "$CUSTOMER_REGISTRY" || "$API_REGISTRY" != "$ADMIN_REGISTRY" ]]; then
  echo "Release images do not belong to the same ECR registry" >&2
  exit 2
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null 2>&1; then
      echo "$label is responding"
      return 0
    fi
    sleep 4
  done

  echo "$label did not become ready: $url" >&2
  return 1
}

assert_running() {
  local service="$1"
  local container_id
  local state

  container_id="$(compose ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    echo "Service has no container: $service" >&2
    return 1
  fi

  state="$(docker inspect "$container_id" --format '{{.State.Status}}')"
  if [[ "$state" != "running" ]]; then
    echo "Service is not running: $service ($state)" >&2
    return 1
  fi
}

assert_image() {
  local service="$1"
  local expected="$2"
  local container_id
  local actual

  container_id="$(compose ps -q "$service")"
  actual="$(docker inspect "$container_id" --format '{{.Config.Image}}')"

  if [[ "$actual" != "$expected" ]]; then
    echo "Unexpected image for $service" >&2
    echo "Expected: $expected" >&2
    echo "Actual:   $actual" >&2
    return 1
  fi
}

cd "$ROOT"

mkdir -p "$ROOT/config/deploy-backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$ROOT/config/deploy-backups/compose.env.$TIMESTAMP"
INFRA_BACKUP_DIR="$ROOT/config/deploy-backups/infra.$TIMESTAMP"
CANDIDATE_FILE="$(mktemp "$ROOT/config/.compose.env.XXXXXX")"
COMPOSE_CANDIDATE="$ROOT/.docker-compose.aws.yml.$TIMESTAMP.new"
MONITORING_CANDIDATE="$ROOT/.monitoring.$TIMESTAMP.new"
ROLLBACK_ARMED=0

cleanup() {
  rm -f "$CANDIDATE_FILE" "$COMPOSE_CANDIDATE"
  rm -rf "$MONITORING_CANDIDATE"
}

restore_infrastructure() {
  if [[ -f "$INFRA_BACKUP_DIR/docker-compose.aws.yml" ]]; then
    cp -a "$INFRA_BACKUP_DIR/docker-compose.aws.yml" "$COMPOSE_FILE"
  elif [[ -f "$INFRA_BACKUP_DIR/compose.absent" ]]; then
    rm -f "$COMPOSE_FILE"
  fi

  if [[ -d "$INFRA_BACKUP_DIR/monitoring" ]]; then
    rm -rf "$ROOT/monitoring"
    cp -a "$INFRA_BACKUP_DIR/monitoring" "$ROOT/monitoring"
  elif [[ -f "$INFRA_BACKUP_DIR/monitoring.absent" ]]; then
    rm -rf "$ROOT/monitoring"
  fi
}

rollback() {
  local exit_code=$?
  trap - ERR

  if [[ "$ROLLBACK_ARMED" == "1" ]]; then
    echo "Deployment failed. Restoring previous release configuration and infrastructure..." >&2

    if [[ -f "$BACKUP_FILE" ]]; then
      cp -a "$BACKUP_FILE" "$ENV_FILE"
    fi

    restore_infrastructure

    if [[ -f "$COMPOSE_FILE" ]]; then
      compose pull backend worker customer admin >/dev/null 2>&1 || true
      compose up -d --remove-orphans || true
    fi
  fi

  cleanup
  exit "$exit_code"
}

trap cleanup EXIT
trap rollback ERR

cp -a "$ENV_FILE" "$BACKUP_FILE"
mkdir -p "$INFRA_BACKUP_DIR"
chmod 700 "$INFRA_BACKUP_DIR" || true

if [[ -f "$COMPOSE_FILE" ]]; then
  cp -a "$COMPOSE_FILE" "$INFRA_BACKUP_DIR/docker-compose.aws.yml"
else
  touch "$INFRA_BACKUP_DIR/compose.absent"
fi

if [[ -d "$ROOT/monitoring" ]]; then
  cp -a "$ROOT/monitoring" "$INFRA_BACKUP_DIR/monitoring"
else
  touch "$INFRA_BACKUP_DIR/monitoring.absent"
fi

if ! awk \
  -v api="$API_IMAGE" \
  -v customer="$CUSTOMER_IMAGE" \
  -v admin="$ADMIN_IMAGE" '
    BEGIN { api_seen = 0; customer_seen = 0; admin_seen = 0 }
    /^API_IMAGE=/      { print "API_IMAGE=" api; api_seen = 1; next }
    /^CUSTOMER_IMAGE=/ { print "CUSTOMER_IMAGE=" customer; customer_seen = 1; next }
    /^ADMIN_IMAGE=/    { print "ADMIN_IMAGE=" admin; admin_seen = 1; next }
    { print }
    END {
      if (!api_seen || !customer_seen || !admin_seen) {
        exit 42
      }
    }
  ' "$ENV_FILE" > "$CANDIDATE_FILE"; then
  echo "compose.env is missing one or more image keys" >&2
  exit 1
fi

chmod --reference="$ENV_FILE" "$CANDIDATE_FILE"
if command -v chown >/dev/null 2>&1; then
  chown --reference="$ENV_FILE" "$CANDIDATE_FILE" 2>/dev/null || true
fi

# Validate the exact compose payload from the release commit before touching live infrastructure.
docker compose --env-file "$CANDIDATE_FILE" -f "$PAYLOAD_COMPOSE" config --quiet

# Stage infrastructure on the same filesystem so final moves are local and predictable.
cp -a "$PAYLOAD_COMPOSE" "$COMPOSE_CANDIDATE"
cp -a "$PAYLOAD_MONITORING" "$MONITORING_CANDIDATE"

ROLLBACK_ARMED=1
mv "$CANDIDATE_FILE" "$ENV_FILE"
mv "$COMPOSE_CANDIDATE" "$COMPOSE_FILE"
rm -rf "$ROOT/monitoring"
mv "$MONITORING_CANDIDATE" "$ROOT/monitoring"

printf 'Deploying commit %s\n' "$IMAGE_TAG"
printf 'API image:      %s\n' "$API_IMAGE"
printf 'Customer image: %s\n' "$CUSTOMER_IMAGE"
printf 'Admin image:    %s\n' "$ADMIN_IMAGE"

# Pull first so registry/network failures happen before application containers are touched.
compose pull backend worker customer admin prometheus alertmanager grafana

# Pause background jobs while the API container runs its startup database setup.
compose stop worker >/dev/null 2>&1 || true
compose up -d db
compose up -d backend
wait_http "http://127.0.0.1:3000/ready" "Backend readiness" 30

# Start the worker only after the API is healthy, then update both frontends.
compose up -d worker customer admin
wait_http "http://127.0.0.1:8081/" "Customer frontend" 20
wait_http "http://127.0.0.1:8082/" "Admin frontend" 20

# Start monitoring only after the application path is healthy.
compose up -d alertmanager prometheus grafana
wait_http "http://127.0.0.1:9093/-/ready" "Alertmanager" 20
wait_http "http://127.0.0.1:9090/-/ready" "Prometheus" 20
wait_http "http://127.0.0.1:3001/api/health" "Grafana" 30

for service in db backend worker customer admin prometheus alertmanager grafana; do
  assert_running "$service"
done

assert_image backend "$API_IMAGE"
assert_image worker "$API_IMAGE"
assert_image customer "$CUSTOMER_IMAGE"
assert_image admin "$ADMIN_IMAGE"

METRICS_TOKEN="$(read_env_value METRICS_TOKEN)"
if [[ -z "$METRICS_TOKEN" ]]; then
  echo "METRICS_TOKEN is unexpectedly empty after compose validation" >&2
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 5 \
  -H "Authorization: Bearer $METRICS_TOKEN" \
  http://127.0.0.1:3000/prometheus >/dev/null; then
  echo "Authenticated backend Prometheus endpoint check failed" >&2
  exit 1
fi

echo "Authenticated backend Prometheus endpoint is responding"

cat > "$ROOT/config/current-release.env" <<EOF
IMAGE_TAG=$IMAGE_TAG
API_IMAGE=$API_IMAGE
CUSTOMER_IMAGE=$CUSTOMER_IMAGE
ADMIN_IMAGE=$ADMIN_IMAGE
DEPLOYED_AT=$TIMESTAMP
EOF

chmod 600 "$ROOT/config/current-release.env" || true

trap - ERR
ROLLBACK_ARMED=0

echo "Production deployment completed successfully."
compose ps
