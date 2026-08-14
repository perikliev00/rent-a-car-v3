-- API keys for partner / machine clients (public read scopes)

CREATE TABLE IF NOT EXISTS api_keys (
  id                   BIGSERIAL PRIMARY KEY,
  name                 VARCHAR(120) NOT NULL,
  key_prefix           VARCHAR(16)  NOT NULL,
  key_hash             CHAR(64)     NOT NULL UNIQUE,
  scopes               TEXT[]       NOT NULL DEFAULT '{}',
  rate_tier            VARCHAR(32)  NOT NULL DEFAULT 'standard',
  created_by_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  last_used_at         TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (id) WHERE revoked_at IS NULL;

INSERT INTO permissions (key, name, description, category) VALUES
  (
    'can_manage_api_keys',
    'Manage API keys',
    'Create, list, and revoke partner API keys',
    'settings'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('owner', 'manager')
  AND p.key = 'can_manage_api_keys'
ON CONFLICT DO NOTHING;
