-- Analytics / notifications RBAC

INSERT INTO permissions (key, name, description, category) VALUES
  (
    'can_manage_notifications',
    'Manage notifications',
    'View notification delivery log and status',
    'ops'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('owner', 'manager')
  AND p.key = 'can_manage_notifications'
ON CONFLICT DO NOTHING;

-- Accountant can view notifications that relate to payment failures
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key = 'can_manage_notifications'
WHERE r.slug = 'accountant'
ON CONFLICT DO NOTHING;
