-- Bind verification tokens to the email present at issuance, enforce one active
-- token per user / reservation, and revoke legacy unbound or duplicate actives.
-- Additive: do not rewrite 029_email_verification_and_claim_tokens.sql.

ALTER TABLE email_verification_tokens
  ADD COLUMN IF NOT EXISTS email_hash CHAR(64);

-- Legacy active tokens have no email binding and must not remain usable.
UPDATE email_verification_tokens
SET revoked_at = NOW()
WHERE used_at IS NULL
  AND revoked_at IS NULL
  AND email_hash IS NULL;

-- Keep only the newest active verification token per user.
UPDATE email_verification_tokens t
SET revoked_at = NOW()
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM email_verification_tokens
  WHERE used_at IS NULL
    AND revoked_at IS NULL
) d
WHERE t.id = d.id
  AND d.rn > 1;

-- Keep only the newest active claim token per reservation.
UPDATE reservation_claim_tokens t
SET revoked_at = NOW()
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY reservation_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM reservation_claim_tokens
  WHERE used_at IS NULL
    AND revoked_at IS NULL
) d
WHERE t.id = d.id
  AND d.rn > 1;

DROP INDEX IF EXISTS idx_email_verification_tokens_active;
DROP INDEX IF EXISTS idx_reservation_claim_tokens_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_tokens_one_active
  ON email_verification_tokens (user_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_claim_tokens_one_active
  ON reservation_claim_tokens (reservation_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;
