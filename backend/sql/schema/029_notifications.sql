-- Notifications (fresh installs)

CREATE TABLE IF NOT EXISTS notifications (
  id                  BIGSERIAL PRIMARY KEY,
  type                VARCHAR(64)  NOT NULL,
  channel             VARCHAR(16)  NOT NULL DEFAULT 'email',
  recipient_email     VARCHAR(255),
  recipient_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reservation_id      BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  order_id            BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  car_id              BIGINT REFERENCES cars(id) ON DELETE SET NULL,
  payload             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status              VARCHAR(16)  NOT NULL DEFAULT 'pending',
  scheduled_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  attempts            INTEGER      NOT NULL DEFAULT 0,
  last_error          TEXT,
  idempotency_key     VARCHAR(255) NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_valid_channel CHECK (channel IN ('email', 'in_app')),
  CONSTRAINT notifications_valid_status CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT notifications_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled
  ON notifications(status, scheduled_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON notifications(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_reservation
  ON notifications(reservation_id)
  WHERE reservation_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_notifications_set_updated_at ON notifications;
CREATE TRIGGER trg_notifications_set_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
