-- Gate guest booking claim on mailbox ownership.
-- Only trusted staff/admin accounts are grandfathered as verified.
-- Customer accounts stay unverified until they prove mailbox ownership.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

UPDATE users
SET email_verified_at = COALESCE(created_at, NOW())
WHERE email_verified_at IS NULL
  AND role IN ('staff', 'admin');

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
