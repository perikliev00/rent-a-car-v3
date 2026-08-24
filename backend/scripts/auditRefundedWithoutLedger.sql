-- Pre-deploy audit: reservations marked refunded without a succeeded refund_operations row.
--
-- Run this manually against production (or a recent dump) BEFORE deploying the
-- REFUND_LEDGER_INCONSISTENT guard. Compare each row to Stripe Dashboard /
-- PaymentIntent refunds. Ops must decide the money movement; this script does
-- not INSERT ledger rows and must not be used as a backfill.
--
-- Do not wire this into app startup.
--
-- The LEFT JOIN below already includes:
--   - refunded with no refund_operations rows at all (legacy status-only)
--   - refunded with only failed and/or pending ops (no succeeded row)
-- Inspect those in Stripe before treating the reservation as actually refunded.

SELECT r.id,
       r.status,
       r.stripe_payment_intent_id,
       r.stripe_session_id,
       r.total_price,
       r.updated_at
FROM reservations r
LEFT JOIN refund_operations ro
  ON ro.reservation_id = r.id
 AND ro.status = 'succeeded'
WHERE r.status = 'refunded'
  AND ro.id IS NULL
ORDER BY r.id;
