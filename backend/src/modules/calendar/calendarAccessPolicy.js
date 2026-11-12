/**
 * Calendar data-access policy: which cars/tasks a session may see or mutate.
 *
 * Own-tasks-only users are limited to cars they are assigned to in the range;
 * task mutation requires CREATE_TASKS or being the assignee.
 */

const repo = require('./calendar.repository');
// Destructure object properties into local variables.
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
// Require the '../../services/rbac/rbacService' module as rbacService.
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
  // Create the own only constant.
  const ownOnly = isOwnTasksOnly(access);
  // Initialize the mutable car ids variable.
  let carIds = null;
  // Evaluate the condition and enter the branch when it is true.
  if (ownOnly) {
    // Store the awaited result in carIds.
    carIds = await repo.listAssignedCarIdsForUser(access.userId, from, to);
    // Evaluate the condition and enter the branch when it is true.
    if (carIds.length === 0) {
      // Return the resulting value to the caller.
      return { ownOnly, cars: [], carIds: [] };
    }
  }
  // Create the cars constant.
  const cars = await repo.listCarsForCalendar({ filters, carIds });
  // Return the resulting value to the caller.
  return { ownOnly, cars, carIds: cars.map((c) => c.id) };
}

/**
 * Whether the user may change a task (create-permission or assignee).
 * @param {object} access
 * @param {object} taskRow DB row with assigned_to_user_id
 * @returns {boolean}
 */
function canMutateTask(access, taskRow) {
  // Evaluate the condition and enter the branch when it is true.
  if (rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS)) return true;
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Continue the surrounding logic with this statement.
    taskRow.assigned_to_user_id != null &&
    // Call String to perform this step.
    String(taskRow.assigned_to_user_id) === String(access.userId)
  // Continue the surrounding logic with this statement.
  ) {
    // Return the resulting value to the caller.
    return true;
  }
  // Return the resulting value to the caller.
  return false;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolveScope,
  // Contribute this line to the enclosing declaration or statement.
  canMutateTask,
};
