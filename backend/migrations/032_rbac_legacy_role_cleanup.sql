-- RBAC: users.role is denormalized cache only.
-- Ensure every admin has owner; demote orphan staff/admin without user_roles;
-- sync users.role from user_roles so stale 'staff' cannot restore access.

-- Existing admins without owner assignment get owner
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM users u
CROSS JOIN roles r
WHERE u.role = 'admin'
  AND r.slug = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- Orphans: legacy staff/admin with no RBAC roles → customer
UPDATE users u
SET role = 'user', updated_at = NOW()
WHERE u.role IN ('staff', 'admin')
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id);

-- Sync cache from authoritative user_roles
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
