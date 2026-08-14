const CALENDAR_PERMISSIONS = Object.freeze({
  VIEW: 'can_view_calendar',
  VIEW_OWN: 'can_view_own_calendar_tasks',
  MOVE: 'can_move_calendar_reservations',
  RESIZE: 'can_resize_calendar_reservations',
  CREATE_BLOCKS: 'can_create_calendar_blocks',
  CREATE_TASKS: 'can_create_calendar_tasks',
  ASSIGN_STAFF: 'can_assign_calendar_staff',
  MARK_PICKUP: 'can_mark_calendar_pickup',
  MARK_RETURN: 'can_mark_calendar_return',
  VIEW_PHONE: 'can_view_calendar_customer_phone',
  VIEW_DOCS: 'can_view_calendar_customer_documents',
  OVERRIDE: 'can_override_calendar_conflicts',
});

function sessionAccess(req) {
  const user = req.session?.user || {};
  return {
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    userId: user.id != null ? String(user.id) : null,
  };
}

function canViewCalendar(access) {
  const rbac = require('../../services/rbac/rbacService');
  return (
    rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW) ||
    rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_OWN)
  );
}

function isOwnTasksOnly(access) {
  const rbac = require('../../services/rbac/rbacService');
  return (
    !rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW) &&
    rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_OWN)
  );
}

module.exports = {
  CALENDAR_PERMISSIONS,
  sessionAccess,
  canViewCalendar,
  isOwnTasksOnly,
};
