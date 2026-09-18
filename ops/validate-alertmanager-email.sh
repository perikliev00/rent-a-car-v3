#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== shell syntax =="
bash -n ops/deploy-production.sh
echo "deploy-production.sh: OK"
sh -n monitoring/alertmanager/docker-entrypoint.sh
echo "docker-entrypoint.sh: OK"

echo "== CRLF check =="
if grep -q $'\r' monitoring/alertmanager/docker-entrypoint.sh ops/deploy-production.sh; then
  echo "CRLF detected in shell scripts" >&2
  exit 1
fi
echo "LF endings: OK"

echo "== entrypoint SMTP render + fail-fast =="
TMPDIR="$(mktemp -d)"
COMPOSE_TMP=""
cleanup() {
  rm -rf "$TMPDIR"
  if [[ -n "$COMPOSE_TMP" ]]; then
    rm -rf "$COMPOSE_TMP"
  fi
}
trap cleanup EXIT

mkdir -p "$TMPDIR/bin"
cat > "$TMPDIR/bin/alertmanager" <<'EOF'
#!/bin/sh
echo "alertmanager-stub args=$*"
exit 0
EOF
cat > "$TMPDIR/bin/amtool" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$TMPDIR/bin/alertmanager" "$TMPDIR/bin/amtool"

export PATH="$TMPDIR/bin:$PATH"
export ALERTMANAGER_BIN="$TMPDIR/bin/alertmanager"
export ALERTMANAGER_CONFIG_TPL="$PWD/monitoring/alertmanager/alertmanager.yml.tpl"
export ALERTMANAGER_CONFIG_SRC="$PWD/monitoring/alertmanager/alertmanager.yml"
export ALERTMANAGER_CONFIG_DST="$TMPDIR/alertmanager.yml"

export ALERT_SMTP_HOST="smtp.example.com"
export ALERT_SMTP_PORT="587"
export ALERT_SMTP_FROM="alerts@example.com"
export ALERT_SMTP_USERNAME='user&name/with|chars'
export ALERT_SMTP_PASSWORD='p@ss&word/with|pipe$var`tick'\''and"slash'
export ALERT_EMAIL_TO="ops@example.com"
export ALERT_SMTP_REQUIRE_TLS="true"

log_file="$TMPDIR/entrypoint.log"
if ! sh monitoring/alertmanager/docker-entrypoint.sh >"$log_file" 2>&1; then
  echo "entrypoint failed unexpectedly" >&2
  cat "$log_file" >&2
  exit 1
fi

if grep -F "$ALERT_SMTP_PASSWORD" "$log_file"; then
  echo "SMTP password leaked to entrypoint logs" >&2
  exit 1
fi
echo "password not present in logs: OK"

# Prefer Unix permission semantics. On Windows/MSYS hosts the NTFS temp path often
# ignores umask; the container check below is authoritative for production.
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  echo "host FS may ignore umask ($(uname -s)); deferring strict mode check to container"
else
  python - "$ALERTMANAGER_CONFIG_DST" <<'PY'
import os, stat, sys
path = sys.argv[1]
mode = os.stat(path).st_mode
banned = stat.S_IRGRP | stat.S_IWGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IWOTH | stat.S_IXOTH
if mode & banned:
    raise SystemExit(
        f"rendered config is group/world-accessible: mode={oct(mode & 0o777)}"
    )
print("rendered config mode is owner-only: OK")
PY
fi

python - "$ALERTMANAGER_CONFIG_DST" <<'PY'
import os, sys
path = sys.argv[1]
expected = os.environ["ALERT_SMTP_PASSWORD"]
text = open(path, encoding="utf-8").read()
escaped = "'" + expected.replace("'", "''") + "'"
needle = "smtp_auth_password: " + escaped
if needle not in text:
    for line in text.splitlines():
        if "smtp_auth_password" in line:
            print("actual:", repr(line), file=sys.stderr)
    print("expected:", repr(needle), file=sys.stderr)
    raise SystemExit("password mangled or missing in rendered config")
for token in ("__ALERT_", "__DEFAULT_WEBHOOK", "__CRITICAL_WEBHOOK"):
    if token in text:
        raise SystemExit(f"unresolved placeholder: {token}")
print("entrypoint rendered password exactly: OK")
PY

grep -q 'PaidButNotConfirmed' "$ALERTMANAGER_CONFIG_DST"
grep -q 'repeat_interval: 5m' "$ALERTMANAGER_CONFIG_DST"
grep -q 'repeat_interval: 15m' "$ALERTMANAGER_CONFIG_DST"
grep -q 'repeat_interval: 3h' "$ALERTMANAGER_CONFIG_DST"
count="$(grep -c 'send_resolved: true' "$ALERTMANAGER_CONFIG_DST")"
[[ "$count" -ge 2 ]]
grep -q "subject: '\[{{ .Status | toUpper }}\]" "$ALERTMANAGER_CONFIG_DST"
echo "routing/subject checks: OK"

unset ALERT_EMAIL_TO
set +e
sh monitoring/alertmanager/docker-entrypoint.sh >"$TMPDIR/fail.log" 2>&1
rc=$?
set -e
if [[ "$rc" -eq 0 ]]; then
  echo "expected entrypoint failure for missing ALERT_EMAIL_TO" >&2
  exit 1
fi
grep -q 'ALERT_EMAIL_TO' "$TMPDIR/fail.log"
grep -q 'missing required Alertmanager SMTP' "$TMPDIR/fail.log"
if grep -F 'p@ss&word' "$TMPDIR/fail.log"; then
  echo "password leaked on failure path" >&2
  exit 1
fi
echo "fail-fast missing SMTP var: OK"

echo "== deploy preflight SMTP var checks =="
preflight_tmp="$(mktemp -d)"

# Replicate the deploy-production.sh Alertmanager SMTP presence check without printing values.
assert_alertmanager_smtp_complete() {
  local env_file="$1"
  local missing=""
  local key value

  read_am_value() {
    awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
  }

  trim_ws() {
    local v="$1"
    v="${v#"${v%%[![:space:]]*}"}"
    v="${v%"${v##*[![:space:]]}"}"
    printf '%s' "$v"
  }

  for key in ALERT_SMTP_HOST ALERT_SMTP_PORT ALERT_SMTP_FROM ALERT_SMTP_USERNAME ALERT_SMTP_PASSWORD ALERT_EMAIL_TO; do
    value="$(trim_ws "$(read_am_value "$key")")"
    if [[ -z "$value" ]]; then
      missing+=" $key"
    fi
  done

  if [[ -n "$missing" ]]; then
    echo "Alertmanager environment file is missing required SMTP variable(s):${missing}" >&2
    echo "File: $env_file" >&2
    return 2
  fi
  return 0
}

cat > "$preflight_tmp/complete.env" <<'EOF'
ALERT_SMTP_HOST=smtp.example.com
ALERT_SMTP_PORT=587
ALERT_SMTP_FROM=alerts@example.com
ALERT_SMTP_USERNAME=example-user
ALERT_SMTP_PASSWORD=super-secret-should-not-appear
ALERT_EMAIL_TO=ops@example.com
EOF

cat > "$preflight_tmp/incomplete.env" <<'EOF'
ALERT_SMTP_HOST=smtp.example.com
ALERT_SMTP_PORT=587
ALERT_EMAIL_TO=
EOF

assert_alertmanager_smtp_complete "$preflight_tmp/complete.env" >/tmp/am-preflight-ok.out 2>/tmp/am-preflight-ok.err
if grep -F 'super-secret-should-not-appear' /tmp/am-preflight-ok.out /tmp/am-preflight-ok.err 2>/dev/null; then
  echo "SMTP password leaked during successful preflight check" >&2
  exit 1
fi

set +e
assert_alertmanager_smtp_complete "$preflight_tmp/incomplete.env" >/tmp/am-preflight-bad.out 2>/tmp/am-preflight-bad.err
incomplete_rc=$?
set -e
[[ "$incomplete_rc" -ne 0 ]]
grep -q 'ALERT_SMTP_FROM' /tmp/am-preflight-bad.err
grep -q 'ALERT_SMTP_USERNAME' /tmp/am-preflight-bad.err
grep -q 'ALERT_SMTP_PASSWORD' /tmp/am-preflight-bad.err
grep -q 'missing required SMTP variable' /tmp/am-preflight-bad.err
if grep -F 'super-secret-should-not-appear' /tmp/am-preflight-bad.out /tmp/am-preflight-bad.err 2>/dev/null; then
  echo "SMTP password leaked during failed preflight check" >&2
  exit 1
fi
rm -rf "$preflight_tmp" /tmp/am-preflight-ok.out /tmp/am-preflight-ok.err /tmp/am-preflight-bad.out /tmp/am-preflight-bad.err
echo "deploy preflight SMTP completeness: OK"

echo "== compose config validation (if Docker available) =="
if docker info >/dev/null 2>&1; then
  # Docker Desktop on Windows resolves env_file paths from the project dir;
  # keep dummy files inside the repo workspace (not /tmp).
  COMPOSE_TMP_REL=".tmp-am-validate-$$"
  COMPOSE_TMP="$PWD/$COMPOSE_TMP_REL"
  mkdir -p "$COMPOSE_TMP"

  cat > "$COMPOSE_TMP/backend.env" <<'EOF'
SESSION_SECRET=dummy-session-secret
STRIPE_SECRET_KEY=sk_test_dummy
EOF
  cat > "$COMPOSE_TMP/alertmanager.env" <<'EOF'
ALERT_SMTP_HOST=smtp.example.com
ALERT_SMTP_PORT=587
ALERT_SMTP_FROM=alerts@example.com
ALERT_SMTP_USERNAME=example-use
ALERT_SMTP_PASSWORD=dummy-pass&/|chars
ALERT_EMAIL_TO=ops@example.com
ALERT_SMTP_REQUIRE_TLS=true
EOF
  {
    echo "POSTGRES_PASSWORD=dummy-postgres-password"
    echo "API_IMAGE=123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    echo "CUSTOMER_IMAGE=123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-customer@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    echo "ADMIN_IMAGE=123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-admin@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    echo "METRICS_TOKEN=dummy-metrics-token"
    echo "GRAFANA_ADMIN_PASSWORD=dummy-grafana-password"
    echo "BACKEND_ENV_FILE=./$COMPOSE_TMP_REL/backend.env"
    echo "ALERTMANAGER_ENV_FILE=./$COMPOSE_TMP_REL/alertmanager.env"
  } > "$COMPOSE_TMP/compose.env"

  docker compose --env-file "$COMPOSE_TMP/compose.env" -f docker-compose.aws.yml config --quiet
  echo "docker compose config: OK"

  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "$PWD/monitoring/alertmanager/alertmanager.yml.tpl:/etc/alertmanager/alertmanager.yml.tpl:ro" \
    -v "$PWD/monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro" \
    -v "$PWD/monitoring/alertmanager/docker-entrypoint.sh:/docker-entrypoint.sh:ro" \
    -e ALERT_SMTP_HOST=smtp.example.com \
    -e ALERT_SMTP_PORT=587 \
    -e ALERT_SMTP_FROM=alerts@example.com \
    -e ALERT_SMTP_USERNAME='user&name/with|chars' \
    -e ALERT_SMTP_PASSWORD='p@ss&word/with|pipe' \
    -e ALERT_EMAIL_TO=ops@example.com \
    -e ALERT_SMTP_REQUIRE_TLS=true \
    -e ALERTMANAGER_BIN=/bin/true \
    -e ALERTMANAGER_KEEP_SHELL=1 \
    -e ALERTMANAGER_CONFIG_DST=/tmp/alertmanager.yml \
    --entrypoint /bin/sh \
    prom/alertmanager:v0.27.0 \
    -c '
      /bin/sh /docker-entrypoint.sh
      mode="$(stat -c %a /tmp/alertmanager.yml)"
      printf "container rendered mode=%s\n" "$mode"
      case "$mode" in
        600|400) ;;
        *)
          printf "rendered config must not be group/world-readable (mode=%s)\n" "$mode" >&2
          exit 1
          ;;
      esac
    '
  echo "alertmanager image entrypoint+amtool: OK"
else
  echo "Docker daemon unavailable; skipped compose/amtool image validation"
fi

echo "== tracked secret scan =="
# Only scan files touched by this feature. Documented sk_live_... placeholders in README are ignored.
hits="$(git grep -nE 'sk_live_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}' --   monitoring/alertmanager docs/ops/production-alertmanager-email.md   .env.docker.example docker-compose.aws.yml ops/deploy-production.sh   ops/validate-alertmanager-email.sh || true)"
if [[ -n "$hits" ]]; then
  printf '%s\n' "$hits" >&2
  echo "possible secret material found" >&2
  exit 1
fi
if git grep -n 'ALERT_SMTP_PASSWORD=' -- monitoring/alertmanager docs/ops .env.docker.example   | grep -v '<secret>' | grep -v 'dummy-pass' | grep -v 'example'; then
  echo "non-placeholder SMTP password found in tracked files" >&2
  exit 1
fi
echo "secret scan: OK"

echo "ALL CHECKS PASSED"
