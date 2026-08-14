-- Allow manual-review status for paid reservations that cannot be auto-finalized.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_valid_status;
ALTER TABLE reservations ADD CONSTRAINT reservations_valid_status CHECK (
  status IN (
    'pending',
    'processing',
    'confirmed',
    'cancelled',
    'expired',
    'paid_needs_manual_review'
  )
);
