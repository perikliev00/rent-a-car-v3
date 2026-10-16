/**
 * Calendar ops-task application service.
 *
 * Encodes create/update/delete/status rules, assignee scoping for VIEW_OWN,
 * and realtime/audit side effects. Status transitions use calendar.taskDomain.
 */

const repo = require('./calendar.repository');
const mapper = require('./calendar.eventMapper');
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
const taskDomain = require('./calendar.taskDomain');
const rbacService = require('../../services/rbac/rbacService');
const { logAdminAction } = require('../../services/admin/adminAuditService');
const userRoleSql = require('../../services/sql/userRoleSqlService');
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');
const { canMutateTask } = require('./calendarAccessPolicy');

/** Coerce common truthy query string forms to boolean. */
function parseBoolQuery(value) {
  return value === true || value === 'true' || value === '1';
}

/**
 * Create a calendar task; assignment requires ASSIGN_STAFF.
 * @param {object} access
 * @param {object} body
 * @param {object} req
 */
async function createTask(access, body, req) {
  // Gate: CREATE_TASKS required for any create.
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  if (!taskDomain.isValidTaskType(body.taskType)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid task type.', 422);
  }
  // Assigning on create needs ASSIGN_STAFF in addition to CREATE_TASKS.
  if (
    body.assignedToUserId &&
    !rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.ASSIGN_STAFF)
  ) {
    throw createHttpError('FORBIDDEN', 'Cannot assign staff.', 403);
  }

  const status = taskDomain.initialStatusForCreate(body.assignedToUserId);

  const task = await repo.createTask({
    carId: body.carId,
    reservationId: body.reservationId,
    taskType: body.taskType,
    title: body.title,
    notes: body.notes,
    locationText: body.locationText,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    dueAt: body.dueAt ? new Date(body.dueAt) : null,
    status,
    assignedToUserId: body.assignedToUserId,
    createdByUserId: access.userId,
  });

  // Audit + live calendar fan-out after successful insert.
  await logAdminAction(req, {
    action: 'calendar.task.create',
    entityType: 'calendar_task',
    entityId: task.id,
    metadata: { taskType: task.taskType, status: task.status },
  });

  emitCalendarUpdated({
    action: 'task_created',
    entityType: 'calendar_task',
    entityId: task.id,
  });

  return mapper.mapTaskEvent({
    id: task.id,
    car_id: task.carId,
    reservation_id: task.reservationId,
    task_type: task.taskType,
    title: task.title,
    notes: task.notes,
    location_text: task.locationText,
    starts_at: task.startsAt,
    due_at: task.dueAt,
    status: task.status,
    assigned_to_user_id: task.assignedToUserId,
  });
}

/**
 * Transition task status. Assignees and CREATE_TASKS managers may update;
 * manager reopen coerces pending/assigned based on whether an assignee exists.
 * @param {object} access
 * @param {string|number} taskId
 * @param {string} status
 * @param {object} req
 */
async function updateTaskStatus(access, taskId, status, req) {
  const row = await repo.findTaskById(taskId);
  if (!row) throw createHttpError('NOT_FOUND', 'Task not found.', 404);

  // Assignees may advance their own tasks; managers with CREATE_TASKS may act on any.
  const isAssignee = String(row.assigned_to_user_id) === String(access.userId);
  const canManage = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS);
  if (!isAssignee && !canManage) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }

  // Domain machine: workers use TRANSITIONS; managers may reopen failed/cancelled.
  try {
    taskDomain.assertTransition(row.status, status, { isManager: canManage });
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      throw createHttpError(err.code, err.message, err.status || 422);
    }
    throw err;
  }

  // Reopen coercion: assigned without assignee → pending; pending with assignee → assigned.
  let nextStatus = status;
  if (
    canManage &&
    (row.status === 'failed' || row.status === 'cancelled') &&
    status === 'assigned' &&
    row.assigned_to_user_id == null
  ) {
    nextStatus = 'pending';
  }
  if (
    canManage &&
    (row.status === 'failed' || row.status === 'cancelled') &&
    status === 'pending' &&
    row.assigned_to_user_id != null
  ) {
    nextStatus = 'assigned';
  }

  const task = await repo.updateTaskStatus(taskId, nextStatus);
  await logAdminAction(req, {
    action: 'calendar.task.status',
    entityType: 'calendar_task',
    entityId: task.id,
    metadata: { status: nextStatus, from: row.status },
  });
  emitCalendarUpdated({
    action: 'task_status_changed',
    entityType: 'calendar_task',
    entityId: task.id,
  });
  return task;
}

/**
 * Patch task fields; assignee changes require ASSIGN_STAFF and may adjust status.
 * @param {object} access
 * @param {string|number} taskId
 * @param {object} body
 * @param {object} req
 */
async function updateTask(access, taskId, body, req) {
  const existing = await repo.findTaskById(taskId);
  if (!existing) throw createHttpError('NOT_FOUND', 'Task not found.', 404);
  if (!canMutateTask(access, existing)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Changing assignee (including clear) always requires ASSIGN_STAFF.
  if (
    body.assignedToUserId !== undefined &&
    !rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.ASSIGN_STAFF)
  ) {
    throw createHttpError('FORBIDDEN', 'Cannot assign staff.', 403);
  }
  if (body.taskType != null && !taskDomain.isValidTaskType(body.taskType)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid task type.', 422);
  }

  // Derive pending/assigned from assignee presence when assignee field is patched.
  let nextStatus;
  if (body.assignedToUserId !== undefined) {
    nextStatus = taskDomain.statusAfterAssigneeChange(existing.status, body.assignedToUserId);
  }

  const task = await repo.updateTask(taskId, {
    title: body.title,
    taskType: body.taskType,
    carId: body.carId,
    startsAt: body.startsAt !== undefined ? (body.startsAt ? new Date(body.startsAt) : null) : undefined,
    dueAt: body.dueAt !== undefined ? (body.dueAt ? new Date(body.dueAt) : null) : undefined,
    locationText: body.locationText,
    notes: body.notes,
    assignedToUserId: body.assignedToUserId,
    reservationId: body.reservationId,
    status: nextStatus,
  });
  if (!task) throw createHttpError('NOT_FOUND', 'Task not found.', 404);

  await logAdminAction(req, {
    action: 'calendar.task.update',
    entityType: 'calendar_task',
    entityId: String(taskId),
    metadata: { title: task.title, status: task.status },
  });

  emitCalendarUpdated({
    action: 'task_updated',
    entityType: 'calendar_task',
    entityId: taskId,
  });

  return task;
}

/**
 * Soft-delete gate: CREATE_TASKS or assignee via canMutateTask.
 * @param {object} access
 * @param {string|number} taskId
 * @param {object} req
 */
async function deleteTask(access, taskId, req) {
  const existing = await repo.findTaskById(taskId);
  if (!existing) throw createHttpError('NOT_FOUND', 'Task not found.', 404);
  if (!canMutateTask(access, existing)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const deleted = await repo.deleteTask(taskId);
  if (!deleted) throw createHttpError('NOT_FOUND', 'Task not found.', 404);

  await logAdminAction(req, {
    action: 'calendar.task.delete',
    entityType: 'calendar_task',
    entityId: String(taskId),
    metadata: {},
  });

  emitCalendarUpdated({
    action: 'task_deleted',
    entityType: 'calendar_task',
    entityId: taskId,
  });

  return { id: String(taskId), deleted: true };
}

/**
 * List tasks with filters; VIEW_OWN forces assignee = current user.
 * @param {object} access
 * @param {object} [query]
 */
async function listTasks(access, query = {}) {
  const ownOnly = isOwnTasksOnly(access);
  const filters = {
    from: query.from ? new Date(query.from) : null,
    to: query.to ? new Date(query.to) : null,
    taskType: query.type || null,
    taskTypes: Array.isArray(query.types) ? query.types : null,
    status: query.status || null,
    carId: query.carId != null ? Number(query.carId) : null,
    includeCancelled: parseBoolQuery(query.includeCancelled) || query.status === 'cancelled',
    unassigned: false,
    assignedToUserId: null,
  };

  // Assignee scoping: VIEW_OWN locks to self; otherwise honor unassigned / me / id.
  if (ownOnly) {
    filters.assignedToUserId = access.userId;
  } else if (parseBoolQuery(query.unassigned)) {
    filters.unassigned = true;
  } else if (query.assignee === 'me') {
    filters.assignedToUserId = access.userId;
  } else if (query.assignee != null && query.assignee !== '') {
    const n = Number(query.assignee);
    if (!Number.isInteger(n) || n <= 0) {
      throw createHttpError('VALIDATION_ERROR', 'Invalid assignee.', 422);
    }
    filters.assignedToUserId = n;
  }

  if (filters.from && filters.to && !(filters.from < filters.to)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid from/to range.', 422);
  }

  const tasks = await repo.listTasks(filters);
  return { tasks };
}

/**
 * Staff users with driver/cleaner/receptionist roles for assignment pickers.
 * @param {object} access
 */
async function listAssignableStaff(access) {
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.ASSIGN_STAFF)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const users = await userRoleSql.listAssignableStaffByRoleSlugs([
    ...taskDomain.ASSIGNABLE_ROLE_SLUGS,
  ]);
  return { users };
}

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  listTasks,
  listAssignableStaff,
};
