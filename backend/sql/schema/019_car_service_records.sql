CREATE TABLE IF NOT EXISTS car_service_records (
  id                  BIGSERIAL PRIMARY KEY,
  car_id              BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  service_type        VARCHAR(64) NOT NULL,
  description         TEXT,
  cost                NUMERIC(10,2),
  mileage             INTEGER,
  service_date        DATE NOT NULL,
  next_service_date   DATE,
  created_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT car_service_cost_nonneg CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT car_service_mileage_nonneg CHECK (mileage IS NULL OR mileage >= 0)
);

CREATE INDEX IF NOT EXISTS idx_car_service_car_date
  ON car_service_records(car_id, service_date DESC);
