#!/bin/sh
# Run the shell command that performs this deployment or validation step.
set -e

# Set the CONFIG_SRC shell variable.
CONFIG_SRC="${PROMETHEUS_CONFIG:-/etc/prometheus/prometheus.yml}"
# Set the CONFIG_DST shell variable.
CONFIG_DST="/tmp/prometheus.yml"

# Evaluate the shell condition before running the branch body.
if [ -n "$METRICS_TOKEN" ] && grep -q '__METRICS_TOKEN__' "$CONFIG_SRC" 2>/dev/null; then
  # Run the shell command that performs this deployment or validation step.
  sed "s|__METRICS_TOKEN__|${METRICS_TOKEN}|g" "$CONFIG_SRC" > "$CONFIG_DST"
  # Set the CONFIG_SRC shell variable.
  CONFIG_SRC="$CONFIG_DST"
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
exec /bin/prometheus \
  # Run the shell command that performs this deployment or validation step.
  --config.file="$CONFIG_SRC" \
  # Run the shell command that performs this deployment or validation step.
  --storage.tsdb.path=/prometheus \
  # Run the shell command that performs this deployment or validation step.
  "$@"
