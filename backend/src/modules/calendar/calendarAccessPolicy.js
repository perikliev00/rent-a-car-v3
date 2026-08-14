const repo = require('./calendar.repository');
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');

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
