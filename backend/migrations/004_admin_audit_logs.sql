-- Admin action audit trail.
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id             BIGSERIAL PRIMARY KEY,
  admin_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action         VARCHAR(100) NOT NULL,
  entity_type    VARCHAR(50)  NOT NULL,
  entity_id      VARCHAR(255),
  metadata       JSONB,
  ip_address     INET,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id
  ON admin_audit_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON admin_audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON admin_audit_logs(created_at DESC);
