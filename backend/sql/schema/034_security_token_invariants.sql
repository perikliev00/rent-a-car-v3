-- Bind verification tokens to the email present at issuance and enforce one
-- active token per user / reservation. Applied after 033 on a fresh schema.

ALTER TABLE email_verification_tokens
  ADD COLUMN IF NOT EXISTS email_hash CHAR(64);

DROP INDEX IF EXISTS idx_email_verification_tokens_active;
DROP INDEX IF EXISTS idx_reservation_claim_tokens_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_tokens_one_active
  ON email_verification_tokens (user_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_claim_tokens_one_active
  ON reservation_claim_tokens (reservation_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;
