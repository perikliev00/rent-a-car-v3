-- Persist a Stripe Checkout attempt counter so create uses a stable
-- idempotency key per attempt and retries cannot open a second payable session.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS stripe_checkout_attempt INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_stripe_checkout_attempt_nonnegative;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_stripe_checkout_attempt_nonnegative
  CHECK (stripe_checkout_attempt >= 0);
