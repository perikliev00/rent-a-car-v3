-- Phase 11: Admin Fleet Calendar (fresh installs)

ALTER TABLE car_date_blocks
  ADD COLUMN IF NOT EXISTS block_type VARCHAR(32) NOT NULL DEFAULT 'booking',
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE car_date_blocks DROP CONSTRAINT IF EXISTS car_date_blocks_valid_block_type;
ALTER TABLE car_date_blocks
  ADD CONSTRAINT car_date_blocks_valid_block_type
  CHECK (block_type IN ('booking', 'manual', 'maintenance', 'other'));

CREATE TABLE IF NOT EXISTS calendar_tasks (
  id                   BIGSERIAL PRIMARY KEY,
  car_id               BIGINT REFERENCES cars(id) ON DELETE SET NULL,
  reservation_id       BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  task_type            VARCHAR(32) NOT NULL,
  title                VARCHAR(255) NOT NULL,
  notes                TEXT,
  location_text        TEXT,
  starts_at            TIMESTAMPTZ,
  due_at               TIMESTAMPTZ,
  status               VARCHAR(32) NOT NULL DEFAULT 'pending',
  assigned_to_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_tasks_valid_type CHECK (task_type IN (
    'pickup',
    'delivery',
    'return',
    'cleaning',
    'inspection',
    'maintenance_dropoff',
    'maintenance_pickup',
    'document_check'
  )),
  CONSTRAINT calendar_tasks_valid_status CHECK (status IN (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
  ))
);

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_assignee_due
  ON calendar_tasks(assigned_to_user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_car_starts
  ON calendar_tasks(car_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_reservation
  ON calendar_tasks(reservation_id);
CREATE INDEX IF NOT EXISTS idx_car_date_blocks_type
  ON car_date_blocks(block_type);

INSERT INTO permissions (key, name, description, category) VALUES
  ('can_view_calendar', 'View calendar', 'Fleet timeline and day operations', 'calendar'),
  ('can_view_own_calendar_tasks', 'View own calendar tasks', 'Assigned tasks only', 'calendar'),
  ('can_move_calendar_reservations', 'Move calendar reservations', 'Move reservation time/car', 'calendar'),
  ('can_resize_calendar_reservations', 'Resize calendar reservations', 'Change pickup/return bounds', 'calendar'),
  ('can_create_calendar_blocks', 'Create calendar blocks', 'Create manual/maintenance blocks', 'calendar'),
  ('can_create_calendar_tasks', 'Create calendar tasks', 'Create staff calendar tasks', 'calendar'),
  ('can_assign_calendar_staff', 'Assign calendar staff', 'Assign tasks to staff', 'calendar'),
  ('can_mark_calendar_pickup', 'Mark calendar pickup', 'Mark pickup from calendar', 'calendar'),
  ('can_mark_calendar_return', 'Mark calendar return', 'Mark return from calendar', 'calendar'),
  ('can_view_calendar_customer_phone', 'View customer phone on calendar', 'Show phone in calendar UI', 'calendar'),
  ('can_view_calendar_customer_documents', 'View customer docs on calendar', 'Document links in calendar', 'calendar'),
  ('can_override_calendar_conflicts', 'Override calendar conflicts', 'Force past warn/selected block conflicts', 'calendar')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug IN ('owner', 'manager') AND p.key LIKE 'can_%calendar%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.key IN (
  'can_view_calendar', 'can_mark_calendar_pickup', 'can_mark_calendar_return',
  'can_view_calendar_customer_phone', 'can_create_calendar_tasks'
)
WHERE r.slug = 'receptionist' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.key IN ('can_view_own_calendar_tasks')
WHERE r.slug = 'driver' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.key IN ('can_view_own_calendar_tasks')
WHERE r.slug = 'cleaner' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.key IN ('can_view_calendar')
WHERE r.slug = 'accountant' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.key IN ('can_view_calendar', 'can_view_calendar_customer_phone')
WHERE r.slug = 'support' ON CONFLICT DO NOTHING;
