-- Fleet management: car operational status + fleet fields, service/damage/docs tables.

ALTER TABLE cars ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'available';
ALTER TABLE cars ADD COLUMN IF NOT EXISTS registration_number VARCHAR(32);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vin VARCHAR(32);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel_level VARCHAR(32);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS current_location TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS technical_inspection_expiry DATE;

UPDATE cars SET status = 'inactive', availability = FALSE WHERE is_deleted = TRUE;
UPDATE cars SET status = 'inactive', availability = FALSE
  WHERE is_deleted = FALSE AND availability = FALSE;
UPDATE cars SET status = 'available', availability = TRUE
  WHERE is_deleted = FALSE AND availability = TRUE;

ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_valid_status;
ALTER TABLE cars ADD CONSTRAINT cars_valid_status CHECK (status IN (
  'available',
  'reserved',
  'rented',
  'needs_cleaning',
  'needs_inspection',
  'in_maintenance',
  'damaged',
  'inactive'
));

ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_valid_fuel_level;
ALTER TABLE cars ADD CONSTRAINT cars_valid_fuel_level CHECK (
  fuel_level IS NULL OR fuel_level IN ('empty', 'quarter', 'half', 'three_quarters', 'full')
);

ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_mileage_nonneg;
ALTER TABLE cars ADD CONSTRAINT cars_mileage_nonneg CHECK (mileage IS NULL OR mileage >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_registration_unique
  ON cars (registration_number) WHERE registration_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_vin_unique
  ON cars (vin) WHERE vin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_insurance_expiry ON cars(insurance_expiry);
CREATE INDEX IF NOT EXISTS idx_cars_inspection_expiry ON cars(technical_inspection_expiry);

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

CREATE TABLE IF NOT EXISTS car_documents (
  id                   BIGSERIAL PRIMARY KEY,
  car_id               BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  url                  TEXT NOT NULL,
  uploaded_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_documents_car
  ON car_documents(car_id, created_at DESC);
