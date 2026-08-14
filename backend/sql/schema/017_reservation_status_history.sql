-- Reservation status transition history.
CREATE TABLE IF NOT EXISTS reservation_status_history (
  id                  BIGSERIAL PRIMARY KEY,
  reservation_id      BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  old_status          VARCHAR(32),
  new_status          VARCHAR(32) NOT NULL,
  changed_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  changed_by_system   BOOLEAN NOT NULL DEFAULT FALSE,
  reason              TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_status_history_reservation_created
  ON reservation_status_history(reservation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservation_status_history_new_status_created
  ON reservation_status_history(new_status, created_at DESC);
