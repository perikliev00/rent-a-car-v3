-- Cars
CREATE TABLE IF NOT EXISTS cars (
  id               BIGSERIAL PRIMARY KEY,
  name             VARCHAR(255)  NOT NULL,
  image            TEXT          NOT NULL,
  transmission     VARCHAR(50)   NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  price_per_day    NUMERIC(10,2),
  price_tier_1_3   NUMERIC(10,2),
  price_tier_7_31  NUMERIC(10,2),
  price_tier_31_plus NUMERIC(10,2),
  seats            INTEGER       NOT NULL,
  fuel_type        VARCHAR(50)   NOT NULL,
  availability     BOOLEAN       NOT NULL DEFAULT TRUE,
  status           VARCHAR(32)   NOT NULL DEFAULT 'available',
  registration_number VARCHAR(32),
  vin              VARCHAR(32),
  mileage          INTEGER,
  fuel_level       VARCHAR(32),
  current_location TEXT,
  insurance_expiry DATE,
  technical_inspection_expiry DATE,
  category_id      BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
  is_deleted       BOOLEAN       NOT NULL DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT cars_price_positive          CHECK (price >= 0),
  CONSTRAINT cars_price_per_day_positive    CHECK (price_per_day IS NULL OR price_per_day >= 0),
  CONSTRAINT cars_price_tier_1_3_positive   CHECK (price_tier_1_3 IS NULL OR price_tier_1_3 >= 0),
  CONSTRAINT cars_price_tier_7_31_positive  CHECK (price_tier_7_31 IS NULL OR price_tier_7_31 >= 0),
  CONSTRAINT cars_price_tier_31_plus_positive CHECK (price_tier_31_plus IS NULL OR price_tier_31_plus >= 0),
  CONSTRAINT cars_seats_positive            CHECK (seats > 0),
  CONSTRAINT cars_valid_status CHECK (status IN (
    'available',
    'reserved',
    'rented',
    'needs_cleaning',
    'needs_inspection',
    'in_maintenance',
    'damaged',
    'inactive'
  )),
  CONSTRAINT cars_valid_fuel_level CHECK (
    fuel_level IS NULL OR fuel_level IN ('empty', 'quarter', 'half', 'three_quarters', 'full')
  ),
  CONSTRAINT cars_mileage_nonneg CHECK (mileage IS NULL OR mileage >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cars_category_id   ON cars(category_id);
CREATE INDEX IF NOT EXISTS idx_cars_is_deleted    ON cars(is_deleted);
CREATE INDEX IF NOT EXISTS idx_cars_availability  ON cars(availability);
CREATE INDEX IF NOT EXISTS idx_cars_transmission  ON cars(transmission);
CREATE INDEX IF NOT EXISTS idx_cars_fuel_type     ON cars(fuel_type);
CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_insurance_expiry ON cars(insurance_expiry);
CREATE INDEX IF NOT EXISTS idx_cars_inspection_expiry ON cars(technical_inspection_expiry);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_registration_unique
  ON cars (registration_number) WHERE registration_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_vin_unique
  ON cars (vin) WHERE vin IS NOT NULL;
