-- Fleet operational fields on cars (applied via 012_fleet_management migration for existing DBs).
ALTER TABLE cars ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'available';
ALTER TABLE cars ADD COLUMN IF NOT EXISTS registration_number VARCHAR(32);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vin VARCHAR(32);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel_level VARCHAR(32);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS current_location TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS technical_inspection_expiry DATE;

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
