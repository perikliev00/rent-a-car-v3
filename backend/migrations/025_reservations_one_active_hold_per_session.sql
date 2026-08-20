-- One active hold (pending_payment / processing_payment) per session_id.
-- Never silently cancels processing_payment rows. Duplicate processing_payment
-- sessions abort the migration with a diagnostic error.

DO $$
DECLARE
  dup_sessions TEXT;
BEGIN
  SELECT string_agg(session_id, ', ' ORDER BY session_id)
  INTO dup_sessions
  FROM (
    SELECT session_id
    FROM reservations
    WHERE status = 'processing_payment'
    GROUP BY session_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_sessions IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create unique active-hold index: duplicate processing_payment rows for session_id(s): %',
      dup_sessions;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY session_id
      ORDER BY
        CASE WHEN status = 'processing_payment' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        id DESC
    ) AS keep_rank
  FROM reservations
  WHERE status IN ('pending_payment', 'processing_payment')
),
to_expire AS (
  SELECT r.id, r.status AS old_status
  FROM reservations r
  JOIN ranked k ON k.id = r.id
  WHERE k.keep_rank > 1
    AND r.status = 'pending_payment'
),
updated AS (
  UPDATE reservations r
  SET status = 'expired',
      hold_expires_at = NOW(),
      updated_at = NOW()
  FROM to_expire t
  WHERE r.id = t.id
  RETURNING r.id, t.old_status
)
INSERT INTO reservation_status_history (
  reservation_id, old_status, new_status, changed_by_system, reason, metadata
)
SELECT
  id,
  old_status,
  'expired',
  TRUE,
  'duplicate_session_hold',
  jsonb_build_object('source', '025_reservations_one_active_hold_per_session')
FROM updated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_one_active_hold_per_session
  ON reservations (session_id)
  WHERE status IN ('pending_payment', 'processing_payment');
