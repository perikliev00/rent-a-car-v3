-- Payment / webhook finalization failures for admin visibility and reconciliation
CREATE TABLE IF NOT EXISTS payment_failures (
  id                BIGSERIAL PRIMARY KEY,
  reason            VARCHAR(100) NOT NULL,
  correlation_id    VARCHAR(255),
  stripe_session_id VARCHAR(255),
  reservation_id    BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  event_id          VARCHAR(255),
  context           JSONB,
  resolved          BOOLEAN      NOT NULL DEFAULT FALSE,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_failures_resolved
  ON payment_failures(resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_failures_stripe_session
  ON payment_failures(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_payment_failures_created_at
  ON payment_failures(created_at DESC);
