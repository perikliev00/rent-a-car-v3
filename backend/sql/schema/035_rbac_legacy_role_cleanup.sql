-- Fresh installs: keep users.role aligned with user_roles (cache only).
-- Authz never reads users.role for staff access.

INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM users u
CROSS JOIN roles r
WHERE u.role = 'admin'
  AND r.slug = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

UPDATE users u
SET role = 'user', updated_at = NOW()
WHERE u.role IN ('staff', 'admin')
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id);

UPDATE users u
SET role = CASE
  WHEN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND r.slug = 'owner'
  ) THEN 'admin'
  WHEN EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id) THEN 'staff'
  ELSE 'user'
END,
updated_at = NOW();
