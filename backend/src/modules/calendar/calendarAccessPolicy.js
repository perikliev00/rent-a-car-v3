/**
 * Calendar data-access policy: which cars/tasks a session may see or mutate.
 *
 * Own-tasks-only users are limited to cars they are assigned to in the range;
 * task mutation requires CREATE_TASKS or being the assignee.
 */

const repo = require('./calendar.repository');
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');

/**
 * Resolve the set of cars visible for a calendar query given access + filters.
 * @param {object} access Session access from sessionAccess()
 * @param {Date|string} from
 * @param {Date|string} to
 * @param {object} filters Optional car list filters
 * @returns {Promise<{ ownOnly: boolean, cars: object[], carIds: Array<string|number> }>}
 */
async function resolveScope(access, from, to, filters) {
  const ownOnly = isOwnTasksOnly(access);
  let carIds = null;
  if (ownOnly) {
    carIds = await repo.listAssignedCarIdsForUser(access.userId, from, to);
    if (carIds.length === 0) {
      return { ownOnly, cars: [], carIds: [] };
    }
  }
  const cars = await repo.listCarsForCalendar({ filters, carIds });
  return { ownOnly, cars, carIds: cars.map((c) => c.id) };
}

/**
 * Whether the user may change a task (create-permission or assignee).
 * @param {object} access
 * @param {object} taskRow DB row with assigned_to_user_id
 * @returns {boolean}
 */
function canMutateTask(access, taskRow) {
  if (rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS)) return true;
  if (
    taskRow.assigned_to_user_id != null &&
    String(taskRow.assigned_to_user_id) === String(access.userId)
  ) {
    return true;
  }
  return false;
}

module.exports = {
  resolveScope,
  canMutateTask,
};
