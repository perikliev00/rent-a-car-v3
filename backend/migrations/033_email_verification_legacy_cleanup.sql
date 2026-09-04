-- Repair broad grandfather from early 029_email_verification (all users verified).
-- Old 029 set email_verified_at = created_at exactly for every NULL row.
-- Revoke that false trust for customers, then detach bookings they could not have proven.

-- 1) Mark grandfathered customers as unverified again.
UPDATE users
SET
  email_verified_at = NULL,
  updated_at = NOW()
WHERE role = 'user'
  AND email_verified_at IS NOT NULL
  AND email_verified_at = created_at;

-- 2) Unclaim reservations owned by unverified customers (legacy hijacks).
UPDATE reservations r
SET
  user_id = NULL,
  updated_at = NOW()
FROM users u
WHERE r.user_id = u.id
  AND u.role = 'user'
  AND u.email_verified_at IS NULL;

-- 3) Unclaim orders owned by unverified customers.
UPDATE orders o
SET
  user_id = NULL,
  updated_at = NOW()
FROM users u
WHERE o.user_id = u.id
  AND u.role = 'user'
  AND u.email_verified_at IS NULL;
