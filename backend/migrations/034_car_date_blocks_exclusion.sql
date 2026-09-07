-- Ensure race-safe double-booking protection exists even when only
-- migrations are applied (btree_gist + exclusion live in schema/010, but
-- migrate-only / legacy DBs may lack them). Idempotent.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_overlapping_car_blocks'
  ) THEN
    ALTER TABLE car_date_blocks
    ADD CONSTRAINT no_overlapping_car_blocks
    EXCLUDE USING gist (
      car_id WITH =,
      tstzrange(start_date, end_date, '[)') WITH &&
    );
  END IF;
END $$;
