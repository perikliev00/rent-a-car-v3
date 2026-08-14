CREATE TABLE IF NOT EXISTS car_documents (
  id                   BIGSERIAL PRIMARY KEY,
  car_id               BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  url                  TEXT NOT NULL,
  uploaded_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_documents_car
  ON car_documents(car_id, created_at DESC);
