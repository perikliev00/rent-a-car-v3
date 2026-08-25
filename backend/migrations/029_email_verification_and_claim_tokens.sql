-- Email verification lifecycle + explicit per-reservation claim tokens.
--
-- Replaces the removed email-based auto-claim (claimByEmail). Guest reservations may
-- now only be linked to an account through a single-use token that was mailed to the
-- booking email, and only by an account whose own email is verified.
--
-- Only raw token hashes are stored. Re-runnable.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Staff/admin accounts are provisioned by seeds and operators, so they are trusted as
-- verified. Existing customer accounts stay unverified on purpose: they must go through
-- the verification-on-next-login / resend flow before they regain portal access.
UPDATE users
SET email_verified_at = NOW()
WHERE role IN ('staff', 'admin')
  AND email_verified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_unverified
  ON users (id)
  WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64)    NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_active
  ON email_verification_tokens (user_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens (user_id);

CREATE TABLE IF NOT EXISTS reservation_claim_tokens (
  id              BIGSERIAL PRIMARY KEY,
  reservation_id  BIGINT       NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  token_hash      CHAR(64)     NOT NULL UNIQUE,
  booking_email   VARCHAR(255) NOT NULL,
  expires_at      TIMESTAMPTZ  NOT NULL,
  used_at         TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  used_by_user_id BIGINT       REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_claim_tokens_active
  ON reservation_claim_tokens (reservation_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_claim_tokens_reservation
  ON reservation_claim_tokens (reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservation_claim_tokens_booking_email
  ON reservation_claim_tokens (booking_email);
