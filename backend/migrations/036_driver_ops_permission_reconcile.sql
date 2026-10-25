-- Re-assert the driver policy from migration 024.
-- Fresh schema no longer grants can_view_reservations_ops to driver, but a
-- database that already replayed schema/027 after 024 may have the grant back.
-- This file runs once. Later startups must not seed role_permissions again.

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.slug = 'driver'
  AND p.key = 'can_view_reservations_ops';

-- Permissions are copied into the session at login. Drop driver sessions so a
-- re-granted ops view cannot survive in an existing cookie.
DELETE FROM session AS s
WHERE EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE r.slug = 'driver'
    AND s.sess->'user'->>'id' = ur.user_id::text
);
