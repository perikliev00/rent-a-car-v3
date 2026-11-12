/**
 * Calendar RBAC permission constants and session helpers.
 *
 * VIEW vs VIEW_OWN drives full-fleet vs assignee-scoped calendars;
 * OVERRIDE gates soft conflict force-writes.
 */

const CALENDAR_PERMISSIONS = Object.freeze({
  // Provide the view field value.
  VIEW: 'can_view_calendar',
  // Provide the view own field value.
  VIEW_OWN: 'can_view_own_calendar_tasks',
  // Provide the move field value.
  MOVE: 'can_move_calendar_reservations',
  // Provide the resize field value.
  RESIZE: 'can_resize_calendar_reservations',
  // Provide the create blocks field value.
  CREATE_BLOCKS: 'can_create_calendar_blocks',
  // Provide the create tasks field value.
  CREATE_TASKS: 'can_create_calendar_tasks',
  // Provide the assign staff field value.
  ASSIGN_STAFF: 'can_assign_calendar_staff',
  // Provide the mark pickup field value.
  MARK_PICKUP: 'can_mark_calendar_pickup',
  // Provide the mark return field value.
  MARK_RETURN: 'can_mark_calendar_return',
  // Provide the view phone field value.
  VIEW_PHONE: 'can_view_calendar_customer_phone',
  // Provide the view docs field value.
  VIEW_DOCS: 'can_view_calendar_customer_documents',
  // Provide the override field value.
  OVERRIDE: 'can_override_calendar_conflicts',
});

/**
 * Normalize session user into an access object for RBAC checks.
 * @param {import('express').Request} req
 * @returns {{ roles: string[], permissions: string[], userId: string|null }}
 */
function sessionAccess(req) {
  // Create the user constant.
  const user = req.session?.user || {};
  // Return the resulting value to the caller.
  return {
    // Provide the roles field value.
    roles: Array.isArray(user.roles) ? user.roles : [],
    // Provide the permissions field value.
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    // Provide the user id field value.
    userId: user.id != null ? String(user.id) : null,
  };
}

/**
 * True if the user may open any calendar view (full or own-tasks).
 * @param {object} access
 */
function canViewCalendar(access) {
  // Require the '../../services/rbac/rbacService' module as rbac.
  const rbac = require('../../services/rbac/rbacService');
  // Return control to the caller with the following value.
  return (
    // Call rbac.userHasPermission to perform this step.
    rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW) ||
    // Call rbac.userHasPermission to perform this step.
    rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_OWN)
  );
}

/**
 * True when the user only has VIEW_OWN (no full VIEW) — scope to assigned cars.
 * @param {object} access
 */
function isOwnTasksOnly(access) {
  // Require the '../../services/rbac/rbacService' module as rbac.
  const rbac = require('../../services/rbac/rbacService');
  // Return control to the caller with the following value.
  return (
    // Continue the surrounding logic with this statement.
    !rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW) &&
    // Call rbac.userHasPermission to perform this step.
    rbac.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_OWN)
  );
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CALENDAR_PERMISSIONS,
  // Contribute this line to the enclosing declaration or statement.
  sessionAccess,
  // Contribute this line to the enclosing declaration or statement.
  canViewCalendar,
  // Contribute this line to the enclosing declaration or statement.
  isOwnTasksOnly,
};
