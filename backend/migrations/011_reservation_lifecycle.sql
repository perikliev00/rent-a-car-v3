-- Reservation lifecycle: expand statuses, rename legacy values, history table.
-- Drop exclusion before status renames (predicate references old status names).

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlapping_active_reservation_holds;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_valid_status;

UPDATE reservations SET status = 'pending_payment' WHERE status = 'pending';
UPDATE reservations SET status = 'processing_payment' WHERE status = 'processing';
UPDATE reservations SET status = 'manual_review' WHERE status = 'paid_needs_manual_review';

ALTER TABLE reservations
  ALTER COLUMN status SET DEFAULT 'pending_payment';

ALTER TABLE reservations
  ADD CONSTRAINT reservations_valid_status CHECK (
    status IN (
      'pending_payment',
      'processing_payment',
      'paid',
      'confirmed',
      'car_prepared',
      'picked_up',
      'active_rental',
      'returned',
      'completed',
      'cancelled',
      'no_show',
      'expired',
      'manual_review',
      'refunded'
    )
  );

ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_active_reservation_holds
  EXCLUDE USING gist (
    car_id WITH =,
    tstzrange(pickup_date, return_date, '[)') WITH &&
  )
  WHERE (status IN ('pending_payment', 'processing_payment'));

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

CREATE INDEX IF NOT EXISTS idx_reservations_pickup_date
  ON reservations(pickup_date);

CREATE INDEX IF NOT EXISTS idx_reservations_return_date
  ON reservations(return_date);

CREATE INDEX IF NOT EXISTS idx_reservations_status_pickup
  ON reservations(status, pickup_date);

CREATE INDEX IF NOT EXISTS idx_reservations_status_return
  ON reservations(status, return_date);
