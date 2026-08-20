-- At most one active hold per Express session.
-- Confirmed/paid/expired/cancelled rows are not included.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_one_active_hold_per_session
  ON reservations (session_id)
  WHERE status IN ('pending_payment', 'processing_payment');
