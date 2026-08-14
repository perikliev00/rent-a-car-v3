-- RBAC: roles, permissions, role_permissions, user_roles
-- Expand users.role to allow 'staff'

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_valid_role;
ALTER TABLE users
  ADD CONSTRAINT users_valid_role CHECK (role IN ('user', 'staff', 'admin'));

CREATE TABLE IF NOT EXISTS roles (
  id          BIGSERIAL PRIMARY KEY,
  slug        VARCHAR(64)  NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  is_system   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id          BIGSERIAL PRIMARY KEY,
  key         VARCHAR(64)  NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  category    VARCHAR(64),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id              BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Roles
INSERT INTO roles (slug, name, description, is_system) VALUES
  ('owner', 'Owner', 'Full system access (superuser)', TRUE),
  ('manager', 'Manager', 'Nearly full operational and admin access', TRUE),
  ('receptionist', 'Receptionist', 'Orders, ops, checklists, contacts', TRUE),
  ('driver', 'Driver', 'View reservation ops', TRUE),
  ('cleaner', 'Cleaner', 'Fleet / car status management', TRUE),
  ('accountant', 'Accountant', 'Orders view, revenue, refunds, payments', TRUE),
  ('support', 'Support', 'Orders view/cancel and contacts', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Permissions (9 required + 7 additional)
INSERT INTO permissions (key, name, description, category) VALUES
  ('can_view_orders', 'View orders', 'List and view orders', 'orders'),
  ('can_edit_orders', 'Edit orders', 'Create and update orders', 'orders'),
  ('can_cancel_orders', 'Cancel orders', 'Cancel orders / reservations', 'orders'),
  ('can_refund_payments', 'Refund payments', 'Refund and reconcile payments', 'finance'),
  ('can_manage_cars', 'Manage cars', 'Fleet CRUD and car status', 'cars'),
  ('can_manage_users', 'Manage users', 'Users, roles, and permissions', 'users'),
  ('can_view_revenue', 'View revenue', 'Revenue and financial dashboard stats', 'finance'),
  ('can_export_reports', 'Export reports', 'Export financial/operational reports', 'finance'),
  ('can_manage_settings', 'Manage settings', 'Global settings access', 'settings'),
  ('can_view_reservations_ops', 'View reservation ops', 'Ops dashboard and reservation detail', 'ops'),
  ('can_manage_checklists', 'Manage checklists', 'Pickup/return checklist writes', 'ops'),
  ('can_manage_payments_monitor', 'Payments monitor', 'Payment monitoring list', 'finance'),
  ('can_view_audit_logs', 'View audit logs', 'Browse admin audit logs', 'users'),
  ('can_manage_pricing', 'Manage pricing', 'Pricing engine configuration', 'settings'),
  ('can_manage_contacts', 'Manage contacts', 'Contact inbox', 'ops'),
  ('can_manage_fleet_alerts', 'Manage fleet alerts', 'Fleet alerts and reconcile', 'cars')
ON CONFLICT (key) DO NOTHING;

-- Helper: grant all permissions to a role by slug
-- owner + manager = ALL
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('owner', 'manager')
ON CONFLICT DO NOTHING;

-- receptionist
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'can_view_orders', 'can_edit_orders', 'can_cancel_orders',
  'can_view_reservations_ops', 'can_manage_checklists', 'can_manage_contacts'
)
WHERE r.slug = 'receptionist'
ON CONFLICT DO NOTHING;

-- driver
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('can_view_reservations_ops')
WHERE r.slug = 'driver'
ON CONFLICT DO NOTHING;

-- cleaner
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('can_manage_cars', 'can_manage_fleet_alerts')
WHERE r.slug = 'cleaner'
ON CONFLICT DO NOTHING;

-- accountant
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'can_view_orders', 'can_view_revenue', 'can_export_reports',
  'can_refund_payments', 'can_manage_payments_monitor'
)
WHERE r.slug = 'accountant'
ON CONFLICT DO NOTHING;

-- support
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'can_view_orders', 'can_cancel_orders', 'can_manage_contacts'
)
WHERE r.slug = 'support'
ON CONFLICT DO NOTHING;

-- Backfill: existing admins get owner role
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM users u
CROSS JOIN roles r
WHERE u.role = 'admin' AND r.slug = 'owner'
ON CONFLICT DO NOTHING;
