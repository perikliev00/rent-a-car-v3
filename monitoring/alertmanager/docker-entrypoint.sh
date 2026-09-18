#!/bin/sh
# Render Alertmanager config at runtime. Secrets come from the environment and
# must never be printed. Avoid sed/envsubst for secret substitution — passwords
# may contain &, /, |, $, quotes, and other shell/sed metacharacters.
set -eu

# Restrictive umask before any secret-bearing temp config is created.
# chmod 600 after render remains as defense in depth.
umask 077

CONFIG_SRC="${ALERTMANAGER_CONFIG_SRC:-/etc/alertmanager/alertmanager.yml}"
CONFIG_TPL="${ALERTMANAGER_CONFIG_TPL:-/etc/alertmanager/alertmanager.yml.tpl}"
CONFIG_DST="${ALERTMANAGER_CONFIG_DST:-/tmp/alertmanager.yml}"

log() {
  printf '%s\n' "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

# YAML single-quoted scalar: escape ' as ''
yaml_sq() {
  printf '%s' "$1" | awk 'BEGIN { ORS = "" } {
    gsub(/\047/, "\047\047")
    printf "\047%s\047", $0
  }'
}

smtp_var_set() {
  [ -n "${ALERT_SMTP_HOST:-}" ] \
    || [ -n "${ALERT_SMTP_PORT:-}" ] \
    || [ -n "${ALERT_SMTP_FROM:-}" ] \
    || [ -n "${ALERT_SMTP_USERNAME:-}" ] \
    || [ -n "${ALERT_SMTP_PASSWORD:-}" ] \
    || [ -n "${ALERT_EMAIL_TO:-}" ]
}

require_smtp_vars() {
  missing=""
  for name in \
    ALERT_SMTP_HOST \
    ALERT_SMTP_PORT \
    ALERT_SMTP_FROM \
    ALERT_SMTP_USERNAME \
    ALERT_SMTP_PASSWORD \
    ALERT_EMAIL_TO
  do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
      missing="$missing $name"
    fi
  done

  if [ -n "$missing" ]; then
    die "missing required Alertmanager SMTP environment variable(s):$missing"
  fi
}

require_tls_value() {
  case "${ALERT_SMTP_REQUIRE_TLS:-true}" in
    true|false) printf '%s' "${ALERT_SMTP_REQUIRE_TLS:-true}" ;;
    *) die "ALERT_SMTP_REQUIRE_TLS must be 'true' or 'false'" ;;
  esac
}

webhook_block() {
  if [ -z "${ALERTMANAGER_WEBHOOK_URL:-}" ]; then
    printf ''
    return 0
  fi

  url_yaml="$(yaml_sq "$ALERTMANAGER_WEBHOOK_URL")"
  printf '%s\n' \
    "    webhook_configs:" \
    "      - url: ${url_yaml}" \
    "        send_resolved: true"
}

# Literal placeholder replacement via concatenation (no awk gsub replacement,
# which treats & specially and would corrupt passwords).
render_template() {
  tpl_path="$1"
  dst_path="$2"

  if [ ! -f "$tpl_path" ]; then
    die "Alertmanager config template not found: $tpl_path"
  fi

  smarthost_yaml="$(yaml_sq "${ALERT_SMTP_HOST}:${ALERT_SMTP_PORT}")"
  from_yaml="$(yaml_sq "$ALERT_SMTP_FROM")"
  user_yaml="$(yaml_sq "$ALERT_SMTP_USERNAME")"
  # Password is read only into this scoped variable and never logged.
  pass_yaml="$(yaml_sq "$ALERT_SMTP_PASSWORD")"
  to_yaml="$(yaml_sq "$ALERT_EMAIL_TO")"
  require_tls="$(require_tls_value)"
  default_webhook="$(webhook_block)"
  critical_webhook="$(webhook_block)"

  export ALERTMANAGER_RENDER_SMARTHOST="$smarthost_yaml"
  export ALERTMANAGER_RENDER_FROM="$from_yaml"
  export ALERTMANAGER_RENDER_USERNAME="$user_yaml"
  export ALERTMANAGER_RENDER_PASSWORD="$pass_yaml"
  export ALERTMANAGER_RENDER_TO="$to_yaml"
  export ALERTMANAGER_RENDER_REQUIRE_TLS="$require_tls"
  export ALERTMANAGER_RENDER_DEFAULT_WEBHOOK="$default_webhook"
  export ALERTMANAGER_RENDER_CRITICAL_WEBHOOK="$critical_webhook"

  awk '
    function replace_all(str, placeholder, value,    pos, plen) {
      plen = length(placeholder)
      while ((pos = index(str, placeholder)) > 0) {
        str = substr(str, 1, pos - 1) value substr(str, pos + plen)
      }
      return str
    }
    {
      line = $0
      line = replace_all(line, "__ALERT_SMTP_SMARTHOST__", ENVIRON["ALERTMANAGER_RENDER_SMARTHOST"])
      line = replace_all(line, "__ALERT_SMTP_FROM__", ENVIRON["ALERTMANAGER_RENDER_FROM"])
      line = replace_all(line, "__ALERT_SMTP_USERNAME__", ENVIRON["ALERTMANAGER_RENDER_USERNAME"])
      line = replace_all(line, "__ALERT_SMTP_PASSWORD__", ENVIRON["ALERTMANAGER_RENDER_PASSWORD"])
      line = replace_all(line, "__ALERT_EMAIL_TO__", ENVIRON["ALERTMANAGER_RENDER_TO"])
      line = replace_all(line, "__ALERT_SMTP_REQUIRE_TLS__", ENVIRON["ALERTMANAGER_RENDER_REQUIRE_TLS"])
      if (index(line, "__DEFAULT_WEBHOOK_BLOCK__") > 0) {
        line = replace_all(line, "__DEFAULT_WEBHOOK_BLOCK__", ENVIRON["ALERTMANAGER_RENDER_DEFAULT_WEBHOOK"])
      }
      if (index(line, "__CRITICAL_WEBHOOK_BLOCK__") > 0) {
        line = replace_all(line, "__CRITICAL_WEBHOOK_BLOCK__", ENVIRON["ALERTMANAGER_RENDER_CRITICAL_WEBHOOK"])
      }
      print line
    }
  ' "$tpl_path" > "$dst_path"

  # Drop rendered secret-bearing env copies from this process environment.
  unset ALERTMANAGER_RENDER_SMARTHOST
  unset ALERTMANAGER_RENDER_FROM
  unset ALERTMANAGER_RENDER_USERNAME
  unset ALERTMANAGER_RENDER_PASSWORD
  unset ALERTMANAGER_RENDER_TO
  unset ALERTMANAGER_RENDER_REQUIRE_TLS
  unset ALERTMANAGER_RENDER_DEFAULT_WEBHOOK
  unset ALERTMANAGER_RENDER_CRITICAL_WEBHOOK
}

render_webhook_fallback() {
  if [ -n "${ALERTMANAGER_WEBHOOK_URL:-}" ]; then
    url_yaml="$(yaml_sq "$ALERTMANAGER_WEBHOOK_URL")"
    awk -v url="$url_yaml" '
      function replace_all(str, placeholder, value,    pos, plen) {
        plen = length(placeholder)
        while ((pos = index(str, placeholder)) > 0) {
          str = substr(str, 1, pos - 1) value substr(str, pos + plen)
        }
        return str
      }
      {
        print replace_all($0, "\047http://127.0.0.1:65535/disabled\047", url)
      }
    ' "$CONFIG_SRC" > "$CONFIG_DST"
  else
    cp "$CONFIG_SRC" "$CONFIG_DST"
  fi
}

validate_config() {
  if command -v amtool >/dev/null 2>&1; then
    # amtool may print config snippets on failure; keep stdout/stderr for
    # operators but never echo env secrets ourselves.
    if ! amtool check-config "$CONFIG_DST" >/tmp/alertmanager-check.out 2>&1; then
      log "ERROR: generated Alertmanager config failed validation"
      # Redact likely secret-bearing lines before showing checker output.
      awk '
        {
          lower = $0
          # BusyBox awk has no IGNORECASE; avoid echoing secret-looking lines.
          if (lower ~ /[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]/ || lower ~ /[Ss][Ee][Cc][Rr][Ee][Tt]/ || lower ~ /[Tt][Oo][Kk][Ee][Nn]/ || lower ~ /smtp_auth_password/) {
            next
          }
          print
        }
      ' /tmp/alertmanager-check.out >&2 || true
      rm -f /tmp/alertmanager-check.out
      exit 1
    fi
    rm -f /tmp/alertmanager-check.out
    log "Alertmanager config validated with amtool check-config"
  else
    log "amtool not found; skipping Alertmanager config validation"
  fi
}

if smtp_var_set; then
  require_smtp_vars
  log "Rendering Alertmanager SMTP email configuration"
  render_template "$CONFIG_TPL" "$CONFIG_DST"
else
  log "SMTP env not configured; using static Alertmanager config (webhook/disabled fallback)"
  if [ ! -f "$CONFIG_SRC" ]; then
    die "Alertmanager config not found: $CONFIG_SRC"
  fi
  render_webhook_fallback
fi

chmod 600 "$CONFIG_DST" 2>/dev/null || true
validate_config

ALERTMANAGER_BIN="${ALERTMANAGER_BIN:-/bin/alertmanager}"
if [ "${ALERTMANAGER_KEEP_SHELL:-0}" = "1" ]; then
  # Test/validation hook: avoid exec so callers can inspect CONFIG_DST mode.
  "$ALERTMANAGER_BIN" --config.file="$CONFIG_DST" --storage.path=/alertmanager "$@"
  exit $?
fi
exec "$ALERTMANAGER_BIN" --config.file="$CONFIG_DST" --storage.path=/alertmanager "$@"
