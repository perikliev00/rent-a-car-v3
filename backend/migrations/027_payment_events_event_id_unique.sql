-- Durable Stripe event inbox: unique event_id for refund (and checkout) deliveries.
-- Deduplicate fire-and-forget duplicates before adding the unique index.

DELETE FROM payment_events a
USING payment_events b
WHERE a.event_id IS NOT NULL
  AND a.event_id = b.event_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_event_id_unique
  ON payment_events (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_received_created
  ON payment_events (created_at)
  WHERE status = 'received';
