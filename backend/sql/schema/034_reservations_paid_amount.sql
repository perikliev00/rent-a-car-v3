-- Immutable verified Stripe payment amount. Written once at finalization
-- (or refund-time backfill from PaymentIntent retrieve). Never updated from
-- mutable reservation/order quote pricing.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS paid_currency VARCHAR(3);

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_paid_amount_cents_positive;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_paid_amount_cents_positive
  CHECK (paid_amount_cents IS NULL OR paid_amount_cents > 0);

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_paid_currency_lower;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_paid_currency_lower
  CHECK (paid_currency IS NULL OR paid_currency = lower(paid_currency));
