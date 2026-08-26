#!/usr/bin/env bash
# Smoke-check production Compose interpolation without starting containers.
# SMTP must come from backend/.env (env_file), not root Compose ${SMTP_*} overrides.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TMP_ENV="$(mktemp)"
cleanup() {
  rm -f "$TMP_ENV"
  if [[ -f backend/.env.smoke.bak ]]; then
    mv backend/.env.smoke.bak backend/.env
  elif [[ -n "${CREATED_BACKEND_ENV:-}" ]]; then
    rm -f backend/.env
  fi
}
trap cleanup EXIT

if [[ -f backend/.env ]]; then
  cp backend/.env backend/.env.smoke.bak
else
  CREATED_BACKEND_ENV=1
fi

cat > backend/.env <<'EOF'
NODE_ENV=production
DATABASE_URL=postgres://luxride:ci-placeholder@db:5432/luxride
SESSION_SECRET=ci-session-secret-32-chars-minimum!!
FRONTEND_BASE_URL=https://example.com
CORS_ORIGINS=https://example.com
STRIPE_SECRET=sk_live_ci_placeholder_key_123456789012
STRIPE_WEBHOOK_SECRET=whsec_ci_placeholder_secret
EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=ci-smtp-user
SMTP_PASS=ci-smtp-pass
MAIL_FROM=noreply@example.com
METRICS_TOKEN=ci-metrics-token-placeholder
EOF

export POSTGRES_PASSWORD=ci-placeholder-password
export FRONTEND_BASE_URL=https://example.com
export CORS_ORIGINS=https://example.com
export METRICS_TOKEN=ci-metrics-token-placeholder
export VITE_API_BASE_URL=https://api.example.com
export GRAFANA_ADMIN_PASSWORD=ci-grafana-admin-placeholder

# Ensure SMTP is not required from the Compose shell environment.
unset EMAIL_ENABLED SMTP_HOST SMTP_USER SMTP_PASS MAIL_FROM || true

docker compose -f docker-compose.prod.yml config >"$TMP_ENV"

# Config must resolve without root SMTP interpolation; SMTP comes from backend/.env.
if ! grep -E 'EMAIL_ENABLED:[[:space:]]*("true"|true)' "$TMP_ENV" >/dev/null; then
  echo 'expected EMAIL_ENABLED from backend/.env in rendered compose config' >&2
  exit 1
fi
if ! grep -E 'SMTP_HOST:[[:space:]]*smtp\.example\.com' "$TMP_ENV" >/dev/null; then
  echo 'expected SMTP_HOST from backend/.env in rendered compose config' >&2
  exit 1
fi
if grep -E 'SMTP_HOST: \$\{SMTP_HOST' docker-compose.prod.yml >/dev/null 2>&1; then
  echo 'docker-compose.prod.yml must not interpolate SMTP from the shell' >&2
  exit 1
fi

echo '✓ docker-compose.prod.yml config smoke passed'
