-- Move car / compliance document files off public URLs into private storage keys.

ALTER TABLE car_documents
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128),
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER;

ALTER TABLE car_documents
  ALTER COLUMN url DROP NOT NULL;

UPDATE car_documents
SET
  original_filename = COALESCE(original_filename, name, 'document'),
  mime_type = COALESCE(mime_type, 'application/octet-stream'),
  size_bytes = COALESCE(size_bytes, 1)
WHERE storage_key IS NULL AND url IS NOT NULL;

ALTER TABLE car_documents
  DROP CONSTRAINT IF EXISTS car_documents_storage_or_url;
ALTER TABLE car_documents
  ADD CONSTRAINT car_documents_storage_or_url CHECK (
    storage_key IS NOT NULL OR url IS NOT NULL
  );

ALTER TABLE car_documents
  DROP CONSTRAINT IF EXISTS car_documents_size_positive;
ALTER TABLE car_documents
  ADD CONSTRAINT car_documents_size_positive CHECK (
    size_bytes IS NULL OR size_bytes > 0
  );

CREATE INDEX IF NOT EXISTS idx_car_documents_storage_key
  ON car_documents(storage_key)
  WHERE storage_key IS NOT NULL;

ALTER TABLE car_compliance_items
  ADD COLUMN IF NOT EXISTS document_storage_key TEXT;

CREATE INDEX IF NOT EXISTS idx_car_compliance_document_storage_key
  ON car_compliance_items(document_storage_key)
  WHERE document_storage_key IS NOT NULL;
