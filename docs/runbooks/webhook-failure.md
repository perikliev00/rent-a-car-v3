# Runbook: Stripe webhook failure

## Symptoms

- Alertmanager: `StripeWebhookFailed`
- Grafana Payment dashboard: rising `stripe_webhook_failures_total`
- Logs: `event=webhook_failure` or `stripe.webhook.*` with `requestId`

## Immediate checks

1. Confirm Stripe Dashboard → Developers → Webhooks → endpoint delivery attempts (status, response body).
2. Correlate with API logs using `X-Request-Id` / `requestId`.
3. Check `/ready` (DB, Stripe secrets, migrations) and `DbPoolExhausted`.

## Classify

| Signal | Likely cause | Action |
|--------|--------------|--------|
| 400 / signature | Wrong `STRIPE_WEBHOOK_SECRET` or body not raw | Fix env / middleware; redeploy |
| 5xx / timeout | API or DB unhealthy | Fix readiness; scale/restart carefully |
| Handler error after verify | Finalization / conflict | Inspect reservation by `stripe_session_id` |

## Recovery

1. If Stripe shows `paid` but reservation is `processing_payment` / `manual_review`, use admin review tools and/or `npm run reconcile:stripe` in the backend.
2. Customer fallback: `GET /api/checkout/success` can confirm when the webhook is delayed.
3. After fixing root cause, Resend the event from Stripe Dashboard (handlers must stay idempotent).
4. Confirm `paid_not_confirmed_count` and `processing_paid_count` return to 0.

## Escalate when

- Paid money with no confirmed booking after manual reconcile
- Repeated signature failures after secret rotation
