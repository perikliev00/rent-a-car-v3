-- Ledger for Stripe refunds. Reservation becomes "refunded" only after succeeded money movement.

CREATE TABLE IF NOT EXISTS refund_operations (
  id                         BIGSERIAL PRIMARY KEY,
  reservation_id             BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  order_id                   BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  stripe_payment_intent_id   VARCHAR(255) NOT NULL,
  stripe_refund_id           VARCHAR(255),
  amount_cents               INTEGER NOT NULL CHECK (amount_cents > 0),
  currency                   VARCHAR(10) NOT NULL DEFAULT 'eur',
  status                     VARCHAR(30) NOT NULL
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  idempotency_key            VARCHAR(255) NOT NULL,
  requested_by_user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  failure_code               VARCHAR(100),
  failure_message            TEXT,
  stripe_raw_status          VARCHAR(50),
  reason                     TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refund_operations_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_operations_one_active_per_reservation
  ON refund_operations (reservation_id)
  WHERE status IN ('pending', 'succeeded');

CREATE INDEX IF NOT EXISTS idx_refund_operations_stripe_refund_id
  ON refund_operations (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refund_operations_payment_intent
  ON refund_operations (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_refund_operations_pending_created
  ON refund_operations (created_at)
  WHERE status = 'pending';
