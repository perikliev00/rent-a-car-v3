#!/bin/sh
# Render Alertmanager config at runtime. Secrets come from the environment and
# must never be printed. Avoid sed/envsubst for secret substitution — passwords
# may contain &, /, |, $, quotes, and other shell/sed metacharacters.
set -eu

# Restrictive umask before any secret-bearing temp config is created.
# chmod 600 after render remains as defense in depth.
umask 077

# Set the CONFIG_SRC shell variable.
CONFIG_SRC="${ALERTMANAGER_CONFIG_SRC:-/etc/alertmanager/alertmanager.yml}"
# Set the CONFIG_TPL shell variable.
CONFIG_TPL="${ALERTMANAGER_CONFIG_TPL:-/etc/alertmanager/alertmanager.yml.tpl}"
# Set the CONFIG_DST shell variable.
CONFIG_DST="${ALERTMANAGER_CONFIG_DST:-/tmp/alertmanager.yml}"

# Run the shell command that performs this deployment or validation step.
log() {
  # Append formatted text using printf.
  printf '%s\n' "$*" >&2
}

# Run the shell command that performs this deployment or validation step.
die() {
  # Run the shell command that performs this deployment or validation step.
  log "ERROR: $*"
  # Stop the script with the specified exit status.
  exit 1
}

# YAML single-quoted scalar: escape ' as ''
yaml_sq() {
  # Append formatted text using printf.
  printf '%s' "$1" | awk 'BEGIN { ORS = "" } {
    # Run the shell command that performs this deployment or validation step.
    gsub(/\047/, "\047\047")
    # Append formatted text using printf.
    printf "\047%s\047", $0
  # Run the shell command that performs this deployment or validation step.
  }'
}

# Run the shell command that performs this deployment or validation step.
smtp_var_set() {
  # Run the shell command that performs this deployment or validation step.
  [ -n "${ALERT_SMTP_HOST:-}" ] \
    # Run the shell command that performs this deployment or validation step.
    || [ -n "${ALERT_SMTP_PORT:-}" ] \
    # Run the shell command that performs this deployment or validation step.
    || [ -n "${ALERT_SMTP_FROM:-}" ] \
    # Run the shell command that performs this deployment or validation step.
    || [ -n "${ALERT_SMTP_USERNAME:-}" ] \
    # Run the shell command that performs this deployment or validation step.
    || [ -n "${ALERT_SMTP_PASSWORD:-}" ] \
    # Run the shell command that performs this deployment or validation step.
    || [ -n "${ALERT_EMAIL_TO:-}" ]
}

# Run the shell command that performs this deployment or validation step.
require_smtp_vars() {
  # Set the missing shell variable.
  missing=""
  # Start a shell for-loop over the given items.
  for name in \
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
    # Run the shell command that performs this deployment or validation step.
    eval "value=\${$name:-}"
    # Evaluate the shell condition before running the branch body.
    if [ -z "$value" ]; then
      # Set the missing shell variable.
      missing="$missing $name"
    # Close the conditional block.
    fi
  # Close the loop body.
  done

  # Evaluate the shell condition before running the branch body.
  if [ -n "$missing" ]; then
    # Run the shell command that performs this deployment or validation step.
    die "missing required Alertmanager SMTP environment variable(s):$missing"
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
require_tls_value() {
  # Run the shell command that performs this deployment or validation step.
  case "${ALERT_SMTP_REQUIRE_TLS:-true}" in
    # Run the shell command that performs this deployment or validation step.
    true|false) printf '%s' "${ALERT_SMTP_REQUIRE_TLS:-true}" ;;
    # Run the shell command that performs this deployment or validation step.
    *) die "ALERT_SMTP_REQUIRE_TLS must be 'true' or 'false'" ;;
  # Run the shell command that performs this deployment or validation step.
  esac
}

# Run the shell command that performs this deployment or validation step.
webhook_block() {
  # Evaluate the shell condition before running the branch body.
  if [ -z "${ALERTMANAGER_WEBHOOK_URL:-}" ]; then
    # Append formatted text using printf.
    printf ''
    # Run the shell command that performs this deployment or validation step.
    return 0
  # Close the conditional block.
  fi

  # Set the url_yaml shell variable.
  url_yaml="$(yaml_sq "$ALERTMANAGER_WEBHOOK_URL")"
  # Append formatted text using printf.
  printf '%s\n' \
    # Run the shell command that performs this deployment or validation step.
    "    webhook_configs:" \
    # Run the shell command that performs this deployment or validation step.
    "      - url: ${url_yaml}" \
    # Run the shell command that performs this deployment or validation step.
    "        send_resolved: true"
}

# Literal placeholder replacement via concatenation (no awk gsub replacement,
# which treats & specially and would corrupt passwords).
render_template() {
  # Set the tpl_path shell variable.
  tpl_path="$1"
  # Set the dst_path shell variable.
  dst_path="$2"

  # Evaluate the shell condition before running the branch body.
  if [ ! -f "$tpl_path" ]; then
    # Run the shell command that performs this deployment or validation step.
    die "Alertmanager config template not found: $tpl_path"
  # Close the conditional block.
  fi

  # Set the smarthost_yaml shell variable.
  smarthost_yaml="$(yaml_sq "${ALERT_SMTP_HOST}:${ALERT_SMTP_PORT}")"
  # Set the from_yaml shell variable.
  from_yaml="$(yaml_sq "$ALERT_SMTP_FROM")"
  # Set the user_yaml shell variable.
  user_yaml="$(yaml_sq "$ALERT_SMTP_USERNAME")"
  # Password is read only into this scoped variable and never logged.
  pass_yaml="$(yaml_sq "$ALERT_SMTP_PASSWORD")"
  # Set the to_yaml shell variable.
  to_yaml="$(yaml_sq "$ALERT_EMAIL_TO")"
  # Set the require_tls shell variable.
  require_tls="$(require_tls_value)"
  # Set the default_webhook shell variable.
  default_webhook="$(webhook_block)"
  # Set the critical_webhook shell variable.
  critical_webhook="$(webhook_block)"

  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_SMARTHOST="$smarthost_yaml"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_FROM="$from_yaml"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_USERNAME="$user_yaml"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_PASSWORD="$pass_yaml"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_TO="$to_yaml"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_REQUIRE_TLS="$require_tls"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_DEFAULT_WEBHOOK="$default_webhook"
  # Run the shell command that performs this deployment or validation step.
  export ALERTMANAGER_RENDER_CRITICAL_WEBHOOK="$critical_webhook"

  # Run the shell command that performs this deployment or validation step.
  awk '
    # Run the shell command that performs this deployment or validation step.
    function replace_all(str, placeholder, value,    pos, plen) {
      # Run the shell command that performs this deployment or validation step.
      plen = length(placeholder)
      # Run the shell command that performs this deployment or validation step.
      while ((pos = index(str, placeholder)) > 0) {
        # Run the shell command that performs this deployment or validation step.
        str = substr(str, 1, pos - 1) value substr(str, pos + plen)
      }
      # Run the shell command that performs this deployment or validation step.
      return str
    }
    {
      # Run the shell command that performs this deployment or validation step.
      line = $0
      # Run the shell command that performs this deployment or validation step.
      line = replace_all(line, "__ALERT_SMTP_SMARTHOST__", ENVIRON["ALERTMANAGER_RENDER_SMARTHOST"])
      # Run the shell command that performs this deployment or validation step.
      line = replace_all(line, "__ALERT_SMTP_FROM__", ENVIRON["ALERTMANAGER_RENDER_FROM"])
      # Run the shell command that performs this deployment or validation step.
      line = replace_all(line, "__ALERT_SMTP_USERNAME__", ENVIRON["ALERTMANAGER_RENDER_USERNAME"])
      # Run the shell command that performs this deployment or validation step.
      line = replace_all(line, "__ALERT_SMTP_PASSWORD__", ENVIRON["ALERTMANAGER_RENDER_PASSWORD"])
      # Run the shell command that performs this deployment or validation step.
      line = replace_all(line, "__ALERT_EMAIL_TO__", ENVIRON["ALERTMANAGER_RENDER_TO"])
      # Run the shell command that performs this deployment or validation step.
      line = replace_all(line, "__ALERT_SMTP_REQUIRE_TLS__", ENVIRON["ALERTMANAGER_RENDER_REQUIRE_TLS"])
      # Evaluate the shell condition before running the branch body.
      if (index(line, "__DEFAULT_WEBHOOK_BLOCK__") > 0) {
        # Run the shell command that performs this deployment or validation step.
        line = replace_all(line, "__DEFAULT_WEBHOOK_BLOCK__", ENVIRON["ALERTMANAGER_RENDER_DEFAULT_WEBHOOK"])
      }
      # Evaluate the shell condition before running the branch body.
      if (index(line, "__CRITICAL_WEBHOOK_BLOCK__") > 0) {
        # Run the shell command that performs this deployment or validation step.
        line = replace_all(line, "__CRITICAL_WEBHOOK_BLOCK__", ENVIRON["ALERTMANAGER_RENDER_CRITICAL_WEBHOOK"])
      }
      # Run the shell command that performs this deployment or validation step.
      print line
    }
  # Run the shell command that performs this deployment or validation step.
  ' "$tpl_path" > "$dst_path"

  # Drop rendered secret-bearing env copies from this process environment.
  unset ALERTMANAGER_RENDER_SMARTHOST
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_FROM
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_USERNAME
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_PASSWORD
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_TO
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_REQUIRE_TLS
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_DEFAULT_WEBHOOK
  # Remove the variable from the environment after use.
  unset ALERTMANAGER_RENDER_CRITICAL_WEBHOOK
}

# Run the shell command that performs this deployment or validation step.
render_webhook_fallback() {
  # Evaluate the shell condition before running the branch body.
  if [ -n "${ALERTMANAGER_WEBHOOK_URL:-}" ]; then
    # Set the url_yaml shell variable.
    url_yaml="$(yaml_sq "$ALERTMANAGER_WEBHOOK_URL")"
    # Run the shell command that performs this deployment or validation step.
    awk -v url="$url_yaml" '
      # Run the shell command that performs this deployment or validation step.
      function replace_all(str, placeholder, value,    pos, plen) {
        # Run the shell command that performs this deployment or validation step.
        plen = length(placeholder)
        # Run the shell command that performs this deployment or validation step.
        while ((pos = index(str, placeholder)) > 0) {
          # Run the shell command that performs this deployment or validation step.
          str = substr(str, 1, pos - 1) value substr(str, pos + plen)
        }
        # Run the shell command that performs this deployment or validation step.
        return str
      }
      {
        # Run the shell command that performs this deployment or validation step.
        print replace_all($0, "\047http://127.0.0.1:65535/disabled\047", url)
      }
    # Run the shell command that performs this deployment or validation step.
    ' "$CONFIG_SRC" > "$CONFIG_DST"
  # Begin the fallback branch of the conditional.
  else
    # Run the shell command that performs this deployment or validation step.
    cp "$CONFIG_SRC" "$CONFIG_DST"
  # Close the conditional block.
  fi
}

# Run the shell command that performs this deployment or validation step.
validate_config() {
  # Evaluate the shell condition before running the branch body.
  if command -v amtool >/dev/null 2>&1; then
    # amtool may print config snippets on failure; keep stdout/stderr for
    # operators but never echo env secrets ourselves.
    if ! amtool check-config "$CONFIG_DST" >/tmp/alertmanager-check.out 2>&1; then
      # Run the shell command that performs this deployment or validation step.
      log "ERROR: generated Alertmanager config failed validation"
      # Redact likely secret-bearing lines before showing checker output.
      awk '
        {
          # Run the shell command that performs this deployment or validation step.
          lower = $0
          # BusyBox awk has no IGNORECASE; avoid echoing secret-looking lines.
          if (lower ~ /[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]/ || lower ~ /[Ss][Ee][Cc][Rr][Ee][Tt]/ || lower ~ /[Tt][Oo][Kk][Ee][Nn]/ || lower ~ /smtp_auth_password/) {
            # Run the shell command that performs this deployment or validation step.
            next
          }
          # Run the shell command that performs this deployment or validation step.
          print
        }
      # Run the shell command that performs this deployment or validation step.
      ' /tmp/alertmanager-check.out >&2 || true
      # Run the shell command that performs this deployment or validation step.
      rm -f /tmp/alertmanager-check.out
      # Stop the script with the specified exit status.
      exit 1
    # Close the conditional block.
    fi
    # Run the shell command that performs this deployment or validation step.
    rm -f /tmp/alertmanager-check.out
    # Run the shell command that performs this deployment or validation step.
    log "Alertmanager config validated with amtool check-config"
  # Begin the fallback branch of the conditional.
  else
    # Run the shell command that performs this deployment or validation step.
    log "amtool not found; skipping Alertmanager config validation"
  # Close the conditional block.
  fi
}

# Evaluate the shell condition before running the branch body.
if smtp_var_set; then
  # Run the shell command that performs this deployment or validation step.
  require_smtp_vars
  # Run the shell command that performs this deployment or validation step.
  log "Rendering Alertmanager SMTP email configuration"
  # Run the shell command that performs this deployment or validation step.
  render_template "$CONFIG_TPL" "$CONFIG_DST"
# Begin the fallback branch of the conditional.
else
  # Run the shell command that performs this deployment or validation step.
  log "SMTP env not configured; using static Alertmanager config (webhook/disabled fallback)"
  # Evaluate the shell condition before running the branch body.
  if [ ! -f "$CONFIG_SRC" ]; then
    # Run the shell command that performs this deployment or validation step.
    die "Alertmanager config not found: $CONFIG_SRC"
  # Close the conditional block.
  fi
  # Run the shell command that performs this deployment or validation step.
  render_webhook_fallback
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
chmod 600 "$CONFIG_DST" 2>/dev/null || true
# Run the shell command that performs this deployment or validation step.
validate_config

# Set the ALERTMANAGER_BIN shell variable.
ALERTMANAGER_BIN="${ALERTMANAGER_BIN:-/bin/alertmanager}"
# Evaluate the shell condition before running the branch body.
if [ "${ALERTMANAGER_KEEP_SHELL:-0}" = "1" ]; then
  # Test/validation hook: avoid exec so callers can inspect CONFIG_DST mode.
  "$ALERTMANAGER_BIN" --config.file="$CONFIG_DST" --storage.path=/alertmanager "$@"
  # Stop the script with the specified exit status.
  exit $?
# Close the conditional block.
fi
# Run the shell command that performs this deployment or validation step.
exec "$ALERTMANAGER_BIN" --config.file="$CONFIG_DST" --storage.path=/alertmanager "$@"
