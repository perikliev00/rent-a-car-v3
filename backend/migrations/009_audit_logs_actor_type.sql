-- Add actor_type for admin vs system audit events; remap legacy action codes.
ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_audit_logs_actor_type_check'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_actor_type_check
      CHECK (actor_type IN ('admin', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_created
  ON admin_audit_logs(actor_type, created_at DESC);

UPDATE admin_audit_logs SET action = 'admin.created_car' WHERE action = 'car.create';
UPDATE admin_audit_logs SET action = 'admin.updated_car' WHERE action = 'car.update';
UPDATE admin_audit_logs SET action = 'admin.changed_car_status' WHERE action = 'car.delete';
UPDATE admin_audit_logs SET action = 'admin.created_reservation' WHERE action = 'order.create';
UPDATE admin_audit_logs SET action = 'admin.updated_reservation' WHERE action = 'order.update';
UPDATE admin_audit_logs SET action = 'admin.cancelled_reservation' WHERE action = 'order.delete';
UPDATE admin_audit_logs SET action = 'admin.restored_reservation' WHERE action = 'order.restore';
UPDATE admin_audit_logs SET action = 'admin.emptied_deleted_orders' WHERE action = 'order.empty_deleted_bin';
