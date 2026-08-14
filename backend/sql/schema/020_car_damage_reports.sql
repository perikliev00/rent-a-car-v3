CREATE TABLE IF NOT EXISTS car_damage_reports (
  id                   BIGSERIAL PRIMARY KEY,
  car_id               BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  reservation_id       BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  description          TEXT NOT NULL,
  photos               JSONB NOT NULL DEFAULT '[]'::jsonb,
  repair_cost          NUMERIC(10,2),
  reported_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status               VARCHAR(16) NOT NULL DEFAULT 'unresolved',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at          TIMESTAMPTZ,
  CONSTRAINT car_damage_status_valid CHECK (status IN ('unresolved', 'resolved')),
  CONSTRAINT car_damage_cost_nonneg CHECK (repair_cost IS NULL OR repair_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_car_damage_car_status
  ON car_damage_reports(car_id, status, created_at DESC);
