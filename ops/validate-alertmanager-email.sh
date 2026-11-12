#!/usr/bin/env bash
# Enable strict mode: exit on errors, unset variables, and pipeline failures.
set -euo pipefail

# Run the shell command that performs this deployment or validation step.
cd "$(dirname "$0")/.."

# Write a status message to the terminal.
echo "== shell syntax =="
# Run the shell command that performs this deployment or validation step.
bash -n ops/deploy-production.sh
# Write a status message to the terminal.
echo "deploy-production.sh: OK"
# Run the shell command that performs this deployment or validation step.
sh -n monitoring/alertmanager/docker-entrypoint.sh
# Write a status message to the terminal.
echo "docker-entrypoint.sh: OK"

# Write a status message to the terminal.
echo "== CRLF check =="
# Evaluate the shell condition before running the branch body.
if grep -q $'\r' monitoring/alertmanager/docker-entrypoint.sh ops/deploy-production.sh; then
  # Write a status message to the terminal.
  echo "CRLF detected in shell scripts" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Write a status message to the terminal.
echo "LF endings: OK"

# Write a status message to the terminal.
echo "== entrypoint SMTP render + fail-fast =="
# Set the TMPDIR shell variable.
TMPDIR="$(mktemp -d)"
# Set the COMPOSE_TMP shell variable.
COMPOSE_TMP=""
# Run the shell command that performs this deployment or validation step.
cleanup() {
  # Run the shell command that performs this deployment or validation step.
  rm -rf "$TMPDIR"
  # Evaluate the shell condition before running the branch body.
  if [[ -n "$COMPOSE_TMP" ]]; then
    # Run the shell command that performs this deployment or validation step.
    rm -rf "$COMPOSE_TMP"
  # Close the conditional block.
  fi
}
# Run the shell command that performs this deployment or validation step.
trap cleanup EXIT

# Run the shell command that performs this deployment or validation step.
mkdir -p "$TMPDIR/bin"
# Run the shell command that performs this deployment or validation step.
cat > "$TMPDIR/bin/alertmanager" <<'EOF'
#!/bin/sh
# Write a status message to the terminal.
echo "alertmanager-stub args=$*"
# Stop the script with the specified exit status.
exit 0
# Run the shell command that performs this deployment or validation step.
EOF
# Run the shell command that performs this deployment or validation step.
cat > "$TMPDIR/bin/amtool" <<'EOF'
#!/bin/sh
# Stop the script with the specified exit status.
exit 0
# Run the shell command that performs this deployment or validation step.
EOF
# Run the shell command that performs this deployment or validation step.
chmod +x "$TMPDIR/bin/alertmanager" "$TMPDIR/bin/amtool"

# Run the shell command that performs this deployment or validation step.
export PATH="$TMPDIR/bin:$PATH"
# Run the shell command that performs this deployment or validation step.
export ALERTMANAGER_BIN="$TMPDIR/bin/alertmanager"
# Run the shell command that performs this deployment or validation step.
export ALERTMANAGER_CONFIG_TPL="$PWD/monitoring/alertmanager/alertmanager.yml.tpl"
# Run the shell command that performs this deployment or validation step.
export ALERTMANAGER_CONFIG_SRC="$PWD/monitoring/alertmanager/alertmanager.yml"
# Run the shell command that performs this deployment or validation step.
export ALERTMANAGER_CONFIG_DST="$TMPDIR/alertmanager.yml"

# Run the shell command that performs this deployment or validation step.
export ALERT_SMTP_HOST="smtp.example.com"
# Run the shell command that performs this deployment or validation step.
export ALERT_SMTP_PORT="587"
# Run the shell command that performs this deployment or validation step.
export ALERT_SMTP_FROM="alerts@example.com"
# Run the shell command that performs this deployment or validation step.
export ALERT_SMTP_USERNAME='user&name/with|chars'
# Run the shell command that performs this deployment or validation step.
export ALERT_SMTP_PASSWORD='p@ss&word/with|pipe$var`tick'\''and"slash'
# Run the shell command that performs this deployment or validation step.
export ALERT_EMAIL_TO="ops@example.com"
# Run the shell command that performs this deployment or validation step.
export ALERT_SMTP_REQUIRE_TLS="true"

# Set the log_file shell variable.
log_file="$TMPDIR/entrypoint.log"
# Evaluate the shell condition before running the branch body.
if ! sh monitoring/alertmanager/docker-entrypoint.sh >"$log_file" 2>&1; then
  # Write a status message to the terminal.
  echo "entrypoint failed unexpectedly" >&2
  # Run the shell command that performs this deployment or validation step.
  cat "$log_file" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi

# Evaluate the shell condition before running the branch body.
if grep -F "$ALERT_SMTP_PASSWORD" "$log_file"; then
  # Write a status message to the terminal.
  echo "SMTP password leaked to entrypoint logs" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Write a status message to the terminal.
echo "password not present in logs: OK"

# Prefer Unix permission semantics. On Windows/MSYS hosts the NTFS temp path often
# ignores umask; the container check below is authoritative for production.
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  # Write a status message to the terminal.
  echo "host FS may ignore umask ($(uname -s)); deferring strict mode check to container"
# Begin the fallback branch of the conditional.
else
  # Run the shell command that performs this deployment or validation step.
  python - "$ALERTMANAGER_CONFIG_DST" <<'PY'
# Run the shell command that performs this deployment or validation step.
import os, stat, sys
# Run the shell command that performs this deployment or validation step.
path = sys.argv[1]
# Run the shell command that performs this deployment or validation step.
mode = os.stat(path).st_mode
# Run the shell command that performs this deployment or validation step.
banned = stat.S_IRGRP | stat.S_IWGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IWOTH | stat.S_IXOTH
# Evaluate the shell condition before running the branch body.
if mode & banned:
    # Run the shell command that performs this deployment or validation step.
    raise SystemExit(
        # Run the shell command that performs this deployment or validation step.
        f"rendered config is group/world-accessible: mode={oct(mode & 0o777)}"
    )
# Run the shell command that performs this deployment or validation step.
print("rendered config mode is owner-only: OK")
# Run the shell command that performs this deployment or validation step.
PY
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
python - "$ALERTMANAGER_CONFIG_DST" <<'PY'
# Run the shell command that performs this deployment or validation step.
import os, sys
# Run the shell command that performs this deployment or validation step.
path = sys.argv[1]
# Run the shell command that performs this deployment or validation step.
expected = os.environ["ALERT_SMTP_PASSWORD"]
# Run the shell command that performs this deployment or validation step.
text = open(path, encoding="utf-8").read()
# Run the shell command that performs this deployment or validation step.
escaped = "'" + expected.replace("'", "''") + "'"
# Run the shell command that performs this deployment or validation step.
needle = "smtp_auth_password: " + escaped
# Evaluate the shell condition before running the branch body.
if needle not in text:
    # Start a shell for-loop over the given items.
    for line in text.splitlines():
        # Evaluate the shell condition before running the branch body.
        if "smtp_auth_password" in line:
            # Run the shell command that performs this deployment or validation step.
            print("actual:", repr(line), file=sys.stderr)
    # Run the shell command that performs this deployment or validation step.
    print("expected:", repr(needle), file=sys.stderr)
    # Run the shell command that performs this deployment or validation step.
    raise SystemExit("password mangled or missing in rendered config")
# Start a shell for-loop over the given items.
for token in ("__ALERT_", "__DEFAULT_WEBHOOK", "__CRITICAL_WEBHOOK"):
    # Evaluate the shell condition before running the branch body.
    if token in text:
        # Run the shell command that performs this deployment or validation step.
        raise SystemExit(f"unresolved placeholder: {token}")
# Run the shell command that performs this deployment or validation step.
print("entrypoint rendered password exactly: OK")
# Run the shell command that performs this deployment or validation step.
PY

# Run the shell command that performs this deployment or validation step.
grep -q 'PaidButNotConfirmed' "$ALERTMANAGER_CONFIG_DST"
# Run the shell command that performs this deployment or validation step.
grep -q 'repeat_interval: 5m' "$ALERTMANAGER_CONFIG_DST"
# Run the shell command that performs this deployment or validation step.
grep -q 'repeat_interval: 15m' "$ALERTMANAGER_CONFIG_DST"
# Run the shell command that performs this deployment or validation step.
grep -q 'repeat_interval: 3h' "$ALERTMANAGER_CONFIG_DST"
# Set the count shell variable.
count="$(grep -c 'send_resolved: true' "$ALERTMANAGER_CONFIG_DST")"
# Run the shell command that performs this deployment or validation step.
[[ "$count" -ge 2 ]]
# Run the shell command that performs this deployment or validation step.
grep -q "subject: '\[{{ .Status | toUpper }}\]" "$ALERTMANAGER_CONFIG_DST"
# Write a status message to the terminal.
echo "routing/subject checks: OK"

# Remove the variable from the environment after use.
unset ALERT_EMAIL_TO
# Run the shell command that performs this deployment or validation step.
set +e
# Run the shell command that performs this deployment or validation step.
sh monitoring/alertmanager/docker-entrypoint.sh >"$TMPDIR/fail.log" 2>&1
# Set the rc shell variable.
rc=$?
# Run the shell command that performs this deployment or validation step.
set -e
# Evaluate the shell condition before running the branch body.
if [[ "$rc" -eq 0 ]]; then
  # Write a status message to the terminal.
  echo "expected entrypoint failure for missing ALERT_EMAIL_TO" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Run the shell command that performs this deployment or validation step.
grep -q 'ALERT_EMAIL_TO' "$TMPDIR/fail.log"
# Run the shell command that performs this deployment or validation step.
grep -q 'missing required Alertmanager SMTP' "$TMPDIR/fail.log"
# Evaluate the shell condition before running the branch body.
if grep -F 'p@ss&word' "$TMPDIR/fail.log"; then
  # Write a status message to the terminal.
  echo "password leaked on failure path" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Write a status message to the terminal.
echo "fail-fast missing SMTP var: OK"

# Write a status message to the terminal.
echo "== deploy preflight SMTP var checks =="
# Set the preflight_tmp shell variable.
preflight_tmp="$(mktemp -d)"

# Replicate the deploy-production.sh Alertmanager SMTP presence check without printing values.
assert_alertmanager_smtp_complete() {
  # Run the shell command that performs this deployment or validation step.
  local env_file="$1"
  # Run the shell command that performs this deployment or validation step.
  local missing=""
  # Run the shell command that performs this deployment or validation step.
  local key value

  # Run the shell command that performs this deployment or validation step.
  read_am_value() {
    # Run the shell command that performs this deployment or validation step.
    awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
  }

  # Run the shell command that performs this deployment or validation step.
  trim_ws() {
    # Run the shell command that performs this deployment or validation step.
    local v="$1"
    # Set the v shell variable.
    v="${v#"${v%%[![:space:]]*}"}"
    # Set the v shell variable.
    v="${v%"${v##*[![:space:]]}"}"
    # Append formatted text using printf.
    printf '%s' "$v"
  }

  # Start a shell for-loop over the given items.
  for key in ALERT_SMTP_HOST ALERT_SMTP_PORT ALERT_SMTP_FROM ALERT_SMTP_USERNAME ALERT_SMTP_PASSWORD ALERT_EMAIL_TO; do
    # Set the value shell variable.
    value="$(trim_ws "$(read_am_value "$key")")"
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
    # Run the shell command that performs this deployment or validation step.
    return 2
  # Close the conditional block.
  fi
  # Run the shell command that performs this deployment or validation step.
  return 0
}

# Run the shell command that performs this deployment or validation step.
cat > "$preflight_tmp/complete.env" <<'EOF'
# Set the ALERT_SMTP_HOST shell variable.
ALERT_SMTP_HOST=smtp.example.com
# Set the ALERT_SMTP_PORT shell variable.
ALERT_SMTP_PORT=587
# Set the ALERT_SMTP_FROM shell variable.
ALERT_SMTP_FROM=alerts@example.com
# Set the ALERT_SMTP_USERNAME shell variable.
ALERT_SMTP_USERNAME=example-user
# Assign the sensitive ALERT_SMTP_PASSWORD value for later use.
ALERT_SMTP_PASSWORD=super-secret-should-not-appear
# Set the ALERT_EMAIL_TO shell variable.
ALERT_EMAIL_TO=ops@example.com
# Run the shell command that performs this deployment or validation step.
EOF

# Run the shell command that performs this deployment or validation step.
cat > "$preflight_tmp/incomplete.env" <<'EOF'
# Set the ALERT_SMTP_HOST shell variable.
ALERT_SMTP_HOST=smtp.example.com
# Set the ALERT_SMTP_PORT shell variable.
ALERT_SMTP_PORT=587
# Set the ALERT_EMAIL_TO shell variable.
ALERT_EMAIL_TO=
# Run the shell command that performs this deployment or validation step.
EOF

# Run the shell command that performs this deployment or validation step.
assert_alertmanager_smtp_complete "$preflight_tmp/complete.env" >/tmp/am-preflight-ok.out 2>/tmp/am-preflight-ok.err
# Evaluate the shell condition before running the branch body.
if grep -F 'super-secret-should-not-appear' /tmp/am-preflight-ok.out /tmp/am-preflight-ok.err 2>/dev/null; then
  # Write a status message to the terminal.
  echo "SMTP password leaked during successful preflight check" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
set +e
# Run the shell command that performs this deployment or validation step.
assert_alertmanager_smtp_complete "$preflight_tmp/incomplete.env" >/tmp/am-preflight-bad.out 2>/tmp/am-preflight-bad.err
# Set the incomplete_rc shell variable.
incomplete_rc=$?
# Run the shell command that performs this deployment or validation step.
set -e
# Run the shell command that performs this deployment or validation step.
[[ "$incomplete_rc" -ne 0 ]]
# Run the shell command that performs this deployment or validation step.
grep -q 'ALERT_SMTP_FROM' /tmp/am-preflight-bad.err
# Run the shell command that performs this deployment or validation step.
grep -q 'ALERT_SMTP_USERNAME' /tmp/am-preflight-bad.err
# Run the shell command that performs this deployment or validation step.
grep -q 'ALERT_SMTP_PASSWORD' /tmp/am-preflight-bad.err
# Run the shell command that performs this deployment or validation step.
grep -q 'missing required SMTP variable' /tmp/am-preflight-bad.err
# Evaluate the shell condition before running the branch body.
if grep -F 'super-secret-should-not-appear' /tmp/am-preflight-bad.out /tmp/am-preflight-bad.err 2>/dev/null; then
  # Write a status message to the terminal.
  echo "SMTP password leaked during failed preflight check" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Run the shell command that performs this deployment or validation step.
rm -rf "$preflight_tmp" /tmp/am-preflight-ok.out /tmp/am-preflight-ok.err /tmp/am-preflight-bad.out /tmp/am-preflight-bad.err
# Write a status message to the terminal.
echo "deploy preflight SMTP completeness: OK"

# Write a status message to the terminal.
echo "== compose config validation (if Docker available) =="
# Evaluate the shell condition before running the branch body.
if docker info >/dev/null 2>&1; then
  # Docker Desktop on Windows resolves env_file paths from the project dir;
  # keep dummy files inside the repo workspace (not /tmp).
  COMPOSE_TMP_REL=".tmp-am-validate-$$"
  # Set the COMPOSE_TMP shell variable.
  COMPOSE_TMP="$PWD/$COMPOSE_TMP_REL"
  # Run the shell command that performs this deployment or validation step.
  mkdir -p "$COMPOSE_TMP"

  # Run the shell command that performs this deployment or validation step.
  cat > "$COMPOSE_TMP/backend.env" <<'EOF'
# Assign the sensitive SESSION_SECRET value for later use.
SESSION_SECRET=dummy-session-secret
# Assign the sensitive STRIPE_SECRET_KEY value for later use.
STRIPE_SECRET_KEY=sk_test_dummy
# Run the shell command that performs this deployment or validation step.
EOF
  # Run the shell command that performs this deployment or validation step.
  cat > "$COMPOSE_TMP/alertmanager.env" <<'EOF'
# Set the ALERT_SMTP_HOST shell variable.
ALERT_SMTP_HOST=smtp.example.com
# Set the ALERT_SMTP_PORT shell variable.
ALERT_SMTP_PORT=587
# Set the ALERT_SMTP_FROM shell variable.
ALERT_SMTP_FROM=alerts@example.com
# Set the ALERT_SMTP_USERNAME shell variable.
ALERT_SMTP_USERNAME=example-use
# Assign the sensitive ALERT_SMTP_PASSWORD value for later use.
ALERT_SMTP_PASSWORD=dummy-pass&/|chars
# Set the ALERT_EMAIL_TO shell variable.
ALERT_EMAIL_TO=ops@example.com
# Set the ALERT_SMTP_REQUIRE_TLS shell variable.
ALERT_SMTP_REQUIRE_TLS=true
# Run the shell command that performs this deployment or validation step.
EOF
  {
    # Write a status message to the terminal.
    echo "POSTGRES_PASSWORD=dummy-postgres-password"
    # Write a status message to the terminal.
    echo "APP_DB_PASSWORD=dummy-app-db-password-32chars"
    # Write a status message to the terminal.
    echo "API_IMAGE=123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    # Write a status message to the terminal.
    echo "CUSTOMER_IMAGE=123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-customer@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    # Write a status message to the terminal.
    echo "ADMIN_IMAGE=123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-admin@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    # Write a status message to the terminal.
    echo "METRICS_TOKEN=dummy-metrics-token"
    # Write a status message to the terminal.
    echo "GRAFANA_ADMIN_PASSWORD=dummy-grafana-password"
    # Write a status message to the terminal.
    echo "BACKEND_ENV_FILE=./$COMPOSE_TMP_REL/backend.env"
    # Write a status message to the terminal.
    echo "ALERTMANAGER_ENV_FILE=./$COMPOSE_TMP_REL/alertmanager.env"
  # Run the shell command that performs this deployment or validation step.
  } > "$COMPOSE_TMP/compose.env"

  # Run the shell command that performs this deployment or validation step.
  docker compose --env-file "$COMPOSE_TMP/compose.env" -f docker-compose.aws.yml config --quiet
  # Write a status message to the terminal.
  echo "docker compose config: OK"

  # Set the MSYS_NO_PATHCONV shell variable.
  MSYS_NO_PATHCONV=1 docker run --rm \
    # Run the shell command that performs this deployment or validation step.
    -v "$PWD/monitoring/alertmanager/alertmanager.yml.tpl:/etc/alertmanager/alertmanager.yml.tpl:ro" \
    # Run the shell command that performs this deployment or validation step.
    -v "$PWD/monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro" \
    # Run the shell command that performs this deployment or validation step.
    -v "$PWD/monitoring/alertmanager/docker-entrypoint.sh:/docker-entrypoint.sh:ro" \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_SMTP_HOST=smtp.example.com \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_SMTP_PORT=587 \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_SMTP_FROM=alerts@example.com \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_SMTP_USERNAME='user&name/with|chars' \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_SMTP_PASSWORD='p@ss&word/with|pipe' \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_EMAIL_TO=ops@example.com \
    # Run the shell command that performs this deployment or validation step.
    -e ALERT_SMTP_REQUIRE_TLS=true \
    # Run the shell command that performs this deployment or validation step.
    -e ALERTMANAGER_BIN=/bin/true \
    # Run the shell command that performs this deployment or validation step.
    -e ALERTMANAGER_KEEP_SHELL=1 \
    # Run the shell command that performs this deployment or validation step.
    -e ALERTMANAGER_CONFIG_DST=/tmp/alertmanager.yml \
    # Run the shell command that performs this deployment or validation step.
    --entrypoint /bin/sh \
    # Run the shell command that performs this deployment or validation step.
    prom/alertmanager:v0.27.0 \
    # Run the shell command that performs this deployment or validation step.
    -c '
      # Run the shell command that performs this deployment or validation step.
      /bin/sh /docker-entrypoint.sh
      # Set the mode shell variable.
      mode="$(stat -c %a /tmp/alertmanager.yml)"
      # Append formatted text using printf.
      printf "container rendered mode=%s\n" "$mode"
      # Run the shell command that performs this deployment or validation step.
      case "$mode" in
        # Run the shell command that performs this deployment or validation step.
        600|400) ;;
        # Run the shell command that performs this deployment or validation step.
        *)
          # Append formatted text using printf.
          printf "rendered config must not be group/world-readable (mode=%s)\n" "$mode" >&2
          # Stop the script with the specified exit status.
          exit 1
          # Run the shell command that performs this deployment or validation step.
          ;;
      # Run the shell command that performs this deployment or validation step.
      esac
    # Run the shell command that performs this deployment or validation step.
    '
  # Write a status message to the terminal.
  echo "alertmanager image entrypoint+amtool: OK"
# Begin the fallback branch of the conditional.
else
  # Write a status message to the terminal.
  echo "Docker daemon unavailable; skipped compose/amtool image validation"
# Close the conditional block.
fi

# Write a status message to the terminal.
echo "== tracked secret scan =="
# Only scan files touched by this feature. Documented sk_live_... placeholders in README are ignored.
hits="$(git grep -nE 'sk_live_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}' --   monitoring/alertmanager docs/ops/production-alertmanager-email.md   .env.docker.example docker-compose.aws.yml ops/deploy-production.sh   ops/validate-alertmanager-email.sh || true)"
# Evaluate the shell condition before running the branch body.
if [[ -n "$hits" ]]; then
  # Append formatted text using printf.
  printf '%s\n' "$hits" >&2
  # Write a status message to the terminal.
  echo "possible secret material found" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Evaluate the shell condition before running the branch body.
if git grep -n 'ALERT_SMTP_PASSWORD=' -- monitoring/alertmanager docs/ops .env.docker.example   | grep -v '<secret>' | grep -v 'dummy-pass' | grep -v 'example'; then
  # Write a status message to the terminal.
  echo "non-placeholder SMTP password found in tracked files" >&2
  # Stop the script with the specified exit status.
  exit 1
# Close the conditional block.
fi
# Write a status message to the terminal.
echo "secret scan: OK"

# Write a status message to the terminal.
echo "ALL CHECKS PASSED"
