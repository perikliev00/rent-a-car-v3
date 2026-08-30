-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id                              BIGSERIAL PRIMARY KEY,
  email                           VARCHAR(255) NOT NULL,
  password                        TEXT         NOT NULL,
  role                            VARCHAR(20)  NOT NULL DEFAULT 'user',
  email_verified_at               TIMESTAMPTZ,
  email_verification_token_hash   TEXT,
  email_verification_expires_at   TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT users_valid_role CHECK (role IN ('user', 'staff', 'admin'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
