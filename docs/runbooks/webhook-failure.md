# Runbook: Stripe webhook / payment finalization failure

## Signals

Common signals include:

- `StripeWebhookFailed`
- `PaidButNotConfirmed`
- `ReservationConflictAfterPayment`
- rising `stripe_webhook_failures_total`
- non-zero `paid_not_confirmed_count`
- non-zero `processing_paid_count`
- logs containing `stripe.webhook.*`, `checkout.failed`, or a request/correlation ID

## Immediate checks

1. Check Stripe Dashboard webhook delivery attempts.
2. Confirm the endpoint is the production `/webhook/stripe` endpoint.
3. Inspect response status and delivery timing.
4. Correlate the event/request ID with backend logs.
5. Check `GET /ready` for database, Stripe configuration, and migration failures.
6. Check database-pool, worker, and 5xx alerts.

## Classification

| Signal | Likely cause | Action |
| --- | --- | --- |
| HTTP 400 before handler work | Signature/body/configuration problem | Verify webhook secret and raw-body middleware |
| HTTP 5xx / timeout | API or database failure | Restore readiness before replaying events |
| Paid + `processing_payment` | Finalization/reconciliation incomplete | Inspect reservation and run reconciliation |
| `manual_review` | Paid booking conflicted with availability/state | Resolve in staff workflow; do not auto-confirm blindly |
| Duplicate event | Normal Stripe retry/idempotency path | Verify it was safely skipped |
| Amount/currency/session mismatch | Invalid/stale payment context | Investigate before any manual status change |

## Recovery

1. Verify the payment in Stripe first.
2. Inspect the reservation/order by Stripe session/payment identifiers.
3. If appropriate, run:

```bash
cd backend
npm run reconcile:stripe
```

4. Use the staff manual-review/refund/reconciliation workflow when the system deliberately refused automatic finalization.
5. After fixing the root cause, resend the webhook from Stripe Dashboard if needed.
6. Confirm:
   - `paid_not_confirmed_count == 0`;
   - `processing_paid_count == 0` for completed payments;
   - no new reservation-conflict alert remains unexplained.

## Important safety rule

Do not manually mark a reservation confirmed merely because Stripe shows a payment. Finalization also protects vehicle availability, order creation, payment context, and idempotency.

When money was received but automatic confirmation was blocked, preserve the state for reconciliation/manual review and resolve the booking or refund explicitly.
