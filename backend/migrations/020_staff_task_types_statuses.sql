-- Staff task types & statuses (requirements 44–45)

ALTER TABLE calendar_tasks DROP CONSTRAINT IF EXISTS calendar_tasks_valid_type;
ALTER TABLE calendar_tasks DROP CONSTRAINT IF EXISTS calendar_tasks_valid_status;

UPDATE calendar_tasks SET task_type = 'return' WHERE task_type = 'return_assist';
UPDATE calendar_tasks SET task_type = 'inspection' WHERE task_type = 'custom';
UPDATE calendar_tasks SET status = 'pending' WHERE status = 'open';
UPDATE calendar_tasks SET status = 'completed' WHERE status = 'done';

UPDATE calendar_tasks
SET status = 'assigned'
WHERE assigned_to_user_id IS NOT NULL
  AND status = 'pending';

ALTER TABLE calendar_tasks
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE calendar_tasks
  ADD CONSTRAINT calendar_tasks_valid_type CHECK (task_type IN (
    'pickup',
    'delivery',
    'return',
    'cleaning',
    'inspection',
    'maintenance_dropoff',
    'maintenance_pickup',
    'document_check'
  ));

ALTER TABLE calendar_tasks
  ADD CONSTRAINT calendar_tasks_valid_status CHECK (status IN (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
  ));
