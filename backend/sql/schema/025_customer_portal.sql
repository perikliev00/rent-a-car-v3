-- Customer portal: link bookings to users + travel fields

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS flight_number VARCHAR(64);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS special_requests TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_user_id
  ON reservations(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON orders(user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_documents (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reservation_id     BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  doc_type           VARCHAR(32) NOT NULL,
  storage_key        TEXT NOT NULL,
  original_filename  VARCHAR(255) NOT NULL,
  mime_type          VARCHAR(128) NOT NULL,
  size_bytes         INTEGER NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_documents_doc_type_valid CHECK (
    doc_type IN ('driver_license', 'passport_id', 'other')
  ),
  CONSTRAINT customer_documents_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_user
  ON customer_documents(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_documents_user_type_unique
  ON customer_documents(user_id, doc_type)
  WHERE doc_type IN ('driver_license', 'passport_id');

CREATE TABLE IF NOT EXISTS reservation_cancellation_requests (
  id                   BIGSERIAL PRIMARY KEY,
  reservation_id       BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason               TEXT,
  status               VARCHAR(16) NOT NULL DEFAULT 'pending',
  admin_note           TEXT,
  reviewed_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservation_cancellation_status_valid CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cancellation_requests_one_pending
  ON reservation_cancellation_requests(reservation_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status
  ON reservation_cancellation_requests(status, created_at DESC);
