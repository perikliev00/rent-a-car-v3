-- Split reservation view vs status-change; remove driver full ops view

INSERT INTO permissions (key, name, description, category) VALUES
  (
    'can_change_reservation_status',
    'Change reservation status',
    'Update reservation lifecycle status (pickup, return, etc.)',
    'ops'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('owner', 'manager')
  AND p.key = 'can_change_reservation_status'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key = 'can_change_reservation_status'
WHERE r.slug = 'receptionist'
ON CONFLICT DO NOTHING;

-- Drivers should not access full reservation ops / arbitrary reservation IDs
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.slug = 'driver'
  AND p.key = 'can_view_reservations_ops';
