-- Pickup and return inspection checklists

CREATE TABLE IF NOT EXISTS reservation_pickup_checklists (
  id                       BIGSERIAL PRIMARY KEY,
  reservation_id           BIGINT NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  fuel_level               VARCHAR(32) NOT NULL,
  mileage                  INTEGER NOT NULL,
  existing_damages         TEXT,
  photos                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_signature_key   TEXT,
  employee_signature_key   TEXT,
  pickup_time              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                    TEXT,
  created_by_user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pickup_checklist_fuel_valid CHECK (
    fuel_level IN ('empty', 'quarter', 'half', 'three_quarters', 'full')
  ),
  CONSTRAINT pickup_checklist_mileage_nonneg CHECK (mileage >= 0)
);

CREATE TABLE IF NOT EXISTS reservation_return_checklists (
  id                       BIGSERIAL PRIMARY KEY,
  reservation_id           BIGINT NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  fuel_level               VARCHAR(32) NOT NULL,
  mileage                  INTEGER NOT NULL,
  new_damages              TEXT,
  photos                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  late_return              BOOLEAN NOT NULL DEFAULT FALSE,
  extra_fees               NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_signature_key   TEXT,
  employee_signature_key   TEXT,
  return_time              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                    TEXT,
  created_by_user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT return_checklist_fuel_valid CHECK (
    fuel_level IN ('empty', 'quarter', 'half', 'three_quarters', 'full')
  ),
  CONSTRAINT return_checklist_mileage_nonneg CHECK (mileage >= 0),
  CONSTRAINT return_checklist_extra_fees_nonneg CHECK (extra_fees >= 0)
);
