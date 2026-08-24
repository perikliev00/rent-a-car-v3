-- Unique non-null stripe_refund_id, monotonic succeeded status, reservation DELETE RESTRICT.
-- Re-runnable. Do not invent ledger rows. Do not touch 027_payment_events_event_id_unique.sql.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY stripe_refund_id
           ORDER BY
             CASE status WHEN 'succeeded' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
             id ASC
         ) AS rn
  FROM refund_operations
  WHERE stripe_refund_id IS NOT NULL
)
DELETE FROM refund_operations
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS idx_refund_operations_stripe_refund_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_operations_stripe_refund_id_unique
  ON refund_operations (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE OR REPLACE FUNCTION refund_operations_status_monotonic()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'succeeded' AND NEW.status IN ('pending', 'failed') THEN
    RAISE EXCEPTION 'refund_operations status cannot leave succeeded'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refund_operations_status_monotonic ON refund_operations;
CREATE TRIGGER trg_refund_operations_status_monotonic
  BEFORE UPDATE ON refund_operations
  FOR EACH ROW
  EXECUTE FUNCTION refund_operations_status_monotonic();

ALTER TABLE refund_operations
  DROP CONSTRAINT IF EXISTS refund_operations_reservation_id_fkey;

ALTER TABLE refund_operations
  ADD CONSTRAINT refund_operations_reservation_id_fkey
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT;
