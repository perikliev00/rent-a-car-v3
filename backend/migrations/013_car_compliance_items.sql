-- Car compliance items (insurance, vignette, tax, GTP, equipment, …)

CREATE TABLE IF NOT EXISTS car_compliance_items (
  id                   BIGSERIAL PRIMARY KEY,
  car_id               BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  item_type            VARCHAR(64) NOT NULL,
  title                VARCHAR(255),
  reference_number     VARCHAR(128),
  issued_at            DATE,
  expires_at           DATE,
  notes                TEXT,
  document_url         TEXT,
  status               VARCHAR(16) NOT NULL DEFAULT 'valid',
  created_by_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT car_compliance_type_valid CHECK (item_type IN (
    'civil_insurance',
    'casco',
    'vignette',
    'technical_inspection',
    'vehicle_tax',
    'registration_certificate',
    'fire_extinguisher',
    'first_aid_kit',
    'warning_triangle',
    'leasing',
    'other'
  )),
  CONSTRAINT car_compliance_status_valid CHECK (status IN ('valid', 'expired', 'missing'))
);

CREATE INDEX IF NOT EXISTS idx_car_compliance_car_expires
  ON car_compliance_items(car_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_car_compliance_expires
  ON car_compliance_items(expires_at)
  WHERE expires_at IS NOT NULL;

-- Backfill civil insurance from cars.insurance_expiry
INSERT INTO car_compliance_items (car_id, item_type, expires_at, status)
SELECT
  c.id,
  'civil_insurance',
  c.insurance_expiry,
  CASE
    WHEN c.insurance_expiry < CURRENT_DATE THEN 'expired'
    ELSE 'valid'
  END
FROM cars c
WHERE c.insurance_expiry IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM car_compliance_items i
    WHERE i.car_id = c.id
      AND i.item_type = 'civil_insurance'
  );

-- Backfill technical inspection from cars.technical_inspection_expiry
INSERT INTO car_compliance_items (car_id, item_type, expires_at, status)
SELECT
  c.id,
  'technical_inspection',
  c.technical_inspection_expiry,
  CASE
    WHEN c.technical_inspection_expiry < CURRENT_DATE THEN 'expired'
    ELSE 'valid'
  END
FROM cars c
WHERE c.technical_inspection_expiry IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM car_compliance_items i
    WHERE i.car_id = c.id
      AND i.item_type = 'technical_inspection'
  );
