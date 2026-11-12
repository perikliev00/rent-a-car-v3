#!/bin/sh
set -e

CONFIG_SRC="${PROMETHEUS_CONFIG:-/etc/prometheus/prometheus.yml}"
CONFIG_DST="/tmp/prometheus.yml"

if [ -n "$METRICS_TOKEN" ] && grep -q '__METRICS_TOKEN__' "$CONFIG_SRC" 2>/dev/null; then
  sed "s|__METRICS_TOKEN__|${METRICS_TOKEN}|g" "$CONFIG_SRC" > "$CONFIG_DST"
  CONFIG_SRC="$CONFIG_DST"
fi

exec /bin/prometheus \
  --config.file="$CONFIG_SRC" \
  --storage.tsdb.path=/prometheus \
  "$@"
