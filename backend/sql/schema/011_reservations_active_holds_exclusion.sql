-- Prevent overlapping active reservation holds at the database level.
-- Partial EXCLUDE: only pending_payment/processing_payment rows participate
-- (confirmed bookings are protected separately via car_date_blocks).
-- Requires btree_gist (created in 010_car_date_blocks_exclusion.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_overlapping_active_reservation_holds'
  ) THEN
    ALTER TABLE reservations
    ADD CONSTRAINT no_overlapping_active_reservation_holds
    EXCLUDE USING gist (
      car_id WITH =,
      tstzrange(pickup_date, return_date, '[)') WITH &&
    )
    WHERE (status IN ('pending_payment', 'processing_payment'));
  END IF;
END $$;
