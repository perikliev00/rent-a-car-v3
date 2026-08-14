-- Soft-delete for cars — preserve order/reservation history.
ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cars_is_deleted ON cars(is_deleted);
