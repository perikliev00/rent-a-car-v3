global:
  resolve_timeout: 5m
  smtp_smarthost: __ALERT_SMTP_SMARTHOST__
  smtp_from: __ALERT_SMTP_FROM__
  smtp_auth_username: __ALERT_SMTP_USERNAME__
  smtp_auth_password: __ALERT_SMTP_PASSWORD__
  smtp_require_tls: __ALERT_SMTP_REQUIRE_TLS__

route:
  receiver: default
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 3h
  routes:
    - match:
        alertname: PaidButNotConfirmed
      receiver: critical
      group_wait: 0s
      repeat_interval: 5m
    - match:
        severity: critical
      receiver: critical
      repeat_interval: 15m

receivers:
  - name: default
    email_configs:
      - to: __ALERT_EMAIL_TO__
        send_resolved: true
        headers:
          subject: '[{{ .Status | toUpper }}][{{ .CommonLabels.severity }}] {{ .CommonLabels.alertname }}'
__DEFAULT_WEBHOOK_BLOCK__
  - name: critical
    email_configs:
      - to: __ALERT_EMAIL_TO__
        send_resolved: true
        headers:
          subject: '[{{ .Status | toUpper }}][{{ .CommonLabels.severity }}] {{ .CommonLabels.alertname }}'
__CRITICAL_WEBHOOK_BLOCK__

inhibit_rules:
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['alertname']
