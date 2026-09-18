# Production Alertmanager email notifications

Alertmanager on Lightsail sends warning and critical alerts by SMTP.
SMTP credentials are **not** stored in Git.

## Required host file

Create an untracked file on the Lightsail host:

```text
/opt/rentacar/config/alertmanager.env
```

Do **not** reuse `backend.env`. Keep Alertmanager secrets in this dedicated file.

### Variable names

| Variable | Required | Purpose |
|----------|----------|---------|
| `ALERT_SMTP_HOST` | yes | SMTP server hostname |
| `ALERT_SMTP_PORT` | yes | SMTP port (typically `587`) |
| `ALERT_SMTP_FROM` | yes | Envelope/from address |
| `ALERT_SMTP_USERNAME` | yes | SMTP auth username |
| `ALERT_SMTP_PASSWORD` | yes | SMTP auth password |
| `ALERT_EMAIL_TO` | yes | Destination mailbox for alerts |
| `ALERT_SMTP_REQUIRE_TLS` | no | `true` (default) or `false` |
| `ALERTMANAGER_WEBHOOK_URL` | no | Extra webhook receiver (backward compatible) |

### Safe example

```env
ALERT_SMTP_HOST=smtp.example.com
ALERT_SMTP_PORT=587
ALERT_SMTP_FROM=alerts@example.com
ALERT_SMTP_USERNAME=example-user
ALERT_SMTP_PASSWORD=<secret>
ALERT_EMAIL_TO=ops@example.com
ALERT_SMTP_REQUIRE_TLS=true
```

A tracked copy of this layout lives at
`monitoring/alertmanager/alertmanager.env.example`.

Suggested permissions on the host:

```bash
sudo install -d -m 700 /opt/rentacar/config
sudo install -m 600 /dev/null /opt/rentacar/config/alertmanager.env
# edit the file, then:
sudo chown root:root /opt/rentacar/config/alertmanager.env
```

## Compose wiring

`docker-compose.aws.yml` loads only the dedicated Alertmanager env file:

```yaml
env_file:
  - ${ALERTMANAGER_ENV_FILE:-/opt/rentacar/config/alertmanager.env}
```

Optional override in `/opt/rentacar/config/compose.env`:

```env
ALERTMANAGER_ENV_FILE=/opt/rentacar/config/alertmanager.env
```

Alertmanager remains bound to localhost only:

```text
127.0.0.1:9093:9093
```

Prometheus (`127.0.0.1:9090`) and Grafana (`127.0.0.1:3001`) are unchanged in that regard.

## Runtime rendering

`monitoring/alertmanager/docker-entrypoint.sh` validates required SMTP variables,
renders `monitoring/alertmanager/alertmanager.yml.tpl` into a temporary config under
`/tmp`, optionally validates with `amtool check-config`, then starts Alertmanager.

Secrets are substituted without `sed`/`envsubst` so passwords containing
`&`, `/`, `|`, quotes, and similar characters remain intact. The entrypoint does
not print SMTP passwords.

## Routing (unchanged)

| Match | Receiver | Notes |
|-------|----------|--------|
| `alertname=PaidButNotConfirmed` | `critical` | `group_wait: 0s`, `repeat_interval: 5m` |
| `severity=critical` | `critical` | `repeat_interval: 15m` |
| default (warning/normal) | `default` | `repeat_interval: 3h` |

Both email receivers use `send_resolved: true`.
Subjects include status, severity, and alert name, for example:

```text
[FIRING][critical] ApiDown
[RESOLVED][warning] StripeWebhookFailed
```

## Deploy preflight

`ops/deploy-production.sh` checks the Alertmanager env file **before** replacing
live Compose image references, infrastructure, or the monitoring directory.

It requires:

1. The file exists (default `/opt/rentacar/config/alertmanager.env`, or
   `ALERTMANAGER_ENV_FILE` from `compose.env`).
2. All required SMTP keys are present and non-empty:
   `ALERT_SMTP_HOST`, `ALERT_SMTP_PORT`, `ALERT_SMTP_FROM`,
   `ALERT_SMTP_USERNAME`, `ALERT_SMTP_PASSWORD`, `ALERT_EMAIL_TO`.

`ALERT_SMTP_REQUIRE_TLS` may be omitted (runtime default `true`).

Failures look like:

```text
Alertmanager environment file not found: ...
Alertmanager environment file is missing required SMTP variable(s): ALERT_SMTP_PASSWORD ...
```

Variable **values are never printed**. A missing/incomplete file does not
partially deploy the release.

## Local validation

From the repo root (Git Bash / Linux):

```bash
bash ops/validate-alertmanager-email.sh
```

Uses dummy SMTP values only. Does not require production credentials.

## Local / non-AWS stacks

`docker-compose.dev.yml` and `docker-compose.prod.yml` still work without SMTP:
if no `ALERT_SMTP_*` variables are set, Alertmanager keeps the static
`alertmanager.yml` disabled-webhook fallback (or `ALERTMANAGER_WEBHOOK_URL` when set).
