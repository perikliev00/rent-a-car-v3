#!/bin/sh
set -eu

CONFIG_SRC="/etc/alertmanager/alertmanager.yml"
CONFIG_DST="/tmp/alertmanager.yml"

if [ -n "${ALERTMANAGER_WEBHOOK_URL:-}" ]; then
  sed "s|http://127.0.0.1:65535/disabled|${ALERTMANAGER_WEBHOOK_URL}|g" "$CONFIG_SRC" > "$CONFIG_DST"
else
  cp "$CONFIG_SRC" "$CONFIG_DST"
fi

exec /bin/alertmanager --config.file="$CONFIG_DST" --storage.path=/alertmanager "$@"
