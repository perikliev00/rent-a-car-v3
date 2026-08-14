-- Allow customer actor type on audit logs (booking funnel).
ALTER TABLE admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_actor_type_check;

ALTER TABLE admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_actor_type_check
  CHECK (actor_type IN ('admin', 'system', 'customer'));
