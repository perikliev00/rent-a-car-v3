/**
 * Calendar ops-task application service.
 *
 * Encodes create/update/delete/status rules, assignee scoping for VIEW_OWN,
 * and realtime/audit side effects. Status transitions use calendar.taskDomain.
 */

const repo = require('./calendar.repository');
// Require the './calendar.eventMapper' module as mapper.
const mapper = require('./calendar.eventMapper');
// Destructure object properties into local variables.
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
// Require the './calendar.taskDomain' module as taskDomain.
const taskDomain = require('./calendar.taskDomain');
// Require the '../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../services/rbac/rbacService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../services/admin/adminAuditService');
// Require the '../../services/sql/userRoleSqlService' module as userRoleSql.
const userRoleSql = require('../../services/sql/userRoleSqlService');
// Destructure object properties into local variables.
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');
// Destructure object properties into local variables.
const { canMutateTask } = require('./calendarAccessPolicy');

/** Coerce common truthy query string forms to boolean. */
function parseBoolQuery(value) {
  // Return the resulting value to the caller.
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
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!taskDomain.isValidTaskType(body.taskType)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid task type.', 422);
  }
  // Assigning on create needs ASSIGN_STAFF in addition to CREATE_TASKS.
  if (
    // Contribute this line to the enclosing declaration or statement.
    body.assignedToUserId &&
    // Continue the surrounding logic with this statement.
    !rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.ASSIGN_STAFF)
  // Continue the surrounding logic with this statement.
  ) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Cannot assign staff.', 403);
  }

  // Create the status constant.
  const status = taskDomain.initialStatusForCreate(body.assignedToUserId);

  // Create the task constant.
  const task = await repo.createTask({
    // Provide the car id field value.
    carId: body.carId,
    // Provide the reservation id field value.
    reservationId: body.reservationId,
    // Provide the task type field value.
    taskType: body.taskType,
    // Provide the title field value.
    title: body.title,
    // Provide the notes field value.
    notes: body.notes,
    // Provide the location text field value.
    locationText: body.locationText,
    // Provide the starts at field value.
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    // Provide the due at field value.
    dueAt: body.dueAt ? new Date(body.dueAt) : null,
    // Contribute this line to the enclosing declaration or statement.
    status,
    // Provide the assigned to user id field value.
    assignedToUserId: body.assignedToUserId,
    // Provide the created by user id field value.
    createdByUserId: access.userId,
  });

  // Audit + live calendar fan-out after successful insert.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.task.create',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: task.id,
    // Provide the metadata field value.
    metadata: { taskType: task.taskType, status: task.status },
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'task_created',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: task.id,
  });

  // Return the resulting value to the caller.
  return mapper.mapTaskEvent({
    // Provide the id field value.
    id: task.id,
    // Provide the car id field value.
    car_id: task.carId,
    // Provide the reservation id field value.
    reservation_id: task.reservationId,
    // Provide the task type field value.
    task_type: task.taskType,
    // Provide the title field value.
    title: task.title,
    // Provide the notes field value.
    notes: task.notes,
    // Provide the location text field value.
    location_text: task.locationText,
    // Provide the starts at field value.
    starts_at: task.startsAt,
    // Provide the due at field value.
    due_at: task.dueAt,
    // Provide the status field value.
    status: task.status,
    // Provide the assigned to user id field value.
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
  // Create the row constant.
  const row = await repo.findTaskById(taskId);
  // Evaluate the condition and enter the branch when it is true.
  if (!row) throw createHttpError('NOT_FOUND', 'Task not found.', 404);

  // Assignees may advance their own tasks; managers with CREATE_TASKS may act on any.
  const isAssignee = String(row.assigned_to_user_id) === String(access.userId);
  // Create the can manage constant.
  const canManage = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS);
  // Evaluate the condition and enter the branch when it is true.
  if (!isAssignee && !canManage) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }

  // Domain machine: workers use TRANSITIONS; managers may reopen failed/cancelled.
  try {
    // Call taskDomain.assertTransition to perform this step.
    taskDomain.assertTransition(row.status, status, { isManager: canManage });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'VALIDATION_ERROR') {
      // Throw an error to stop the current control flow.
      throw createHttpError(err.code, err.message, err.status || 422);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Reopen coercion: assigned without assignee → pending; pending with assignee → assigned.
  let nextStatus = status;
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Contribute this line to the enclosing declaration or statement.
    canManage &&
    // Continue the surrounding logic with this statement.
    (row.status === 'failed' || row.status === 'cancelled') &&
    // Update status with the right-hand side value.
    status === 'assigned' &&
    // Update row.assigned_to_user_id with the right-hand side value.
    row.assigned_to_user_id == null
  // Continue the surrounding logic with this statement.
  ) {
    // Update nextStatus with the right-hand side value.
    nextStatus = 'pending';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Contribute this line to the enclosing declaration or statement.
    canManage &&
    // Continue the surrounding logic with this statement.
    (row.status === 'failed' || row.status === 'cancelled') &&
    // Update status with the right-hand side value.
    status === 'pending' &&
    // Continue the surrounding logic with this statement.
    row.assigned_to_user_id != null
  // Continue the surrounding logic with this statement.
  ) {
    // Update nextStatus with the right-hand side value.
    nextStatus = 'assigned';
  }

  // Create the task constant.
  const task = await repo.updateTaskStatus(taskId, nextStatus);
  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.task.status',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: task.id,
    // Provide the metadata field value.
    metadata: { status: nextStatus, from: row.status },
  });
  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'task_status_changed',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: task.id,
  });
  // Return the resulting value to the caller.
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
  // Create the existing constant.
  const existing = await repo.findTaskById(taskId);
  // Evaluate the condition and enter the branch when it is true.
  if (!existing) throw createHttpError('NOT_FOUND', 'Task not found.', 404);
  // Evaluate the condition and enter the branch when it is true.
  if (!canMutateTask(access, existing)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Changing assignee (including clear) always requires ASSIGN_STAFF.
  if (
    // Continue the surrounding logic with this statement.
    body.assignedToUserId !== undefined &&
    // Continue the surrounding logic with this statement.
    !rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.ASSIGN_STAFF)
  // Continue the surrounding logic with this statement.
  ) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Cannot assign staff.', 403);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (body.taskType != null && !taskDomain.isValidTaskType(body.taskType)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid task type.', 422);
  }

  // Derive pending/assigned from assignee presence when assignee field is patched.
  let nextStatus;
  // Evaluate the condition and enter the branch when it is true.
  if (body.assignedToUserId !== undefined) {
    // Update nextStatus with the right-hand side value.
    nextStatus = taskDomain.statusAfterAssigneeChange(existing.status, body.assignedToUserId);
  }

  // Create the task constant.
  const task = await repo.updateTask(taskId, {
    // Provide the title field value.
    title: body.title,
    // Provide the task type field value.
    taskType: body.taskType,
    // Provide the car id field value.
    carId: body.carId,
    // Provide the starts at field value.
    startsAt: body.startsAt !== undefined ? (body.startsAt ? new Date(body.startsAt) : null) : undefined,
    // Provide the due at field value.
    dueAt: body.dueAt !== undefined ? (body.dueAt ? new Date(body.dueAt) : null) : undefined,
    // Provide the location text field value.
    locationText: body.locationText,
    // Provide the notes field value.
    notes: body.notes,
    // Provide the assigned to user id field value.
    assignedToUserId: body.assignedToUserId,
    // Provide the reservation id field value.
    reservationId: body.reservationId,
    // Provide the status field value.
    status: nextStatus,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (!task) throw createHttpError('NOT_FOUND', 'Task not found.', 404);

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.task.update',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: String(taskId),
    // Provide the metadata field value.
    metadata: { title: task.title, status: task.status },
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'task_updated',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: taskId,
  });

  // Return the resulting value to the caller.
  return task;
}

/**
 * Soft-delete gate: CREATE_TASKS or assignee via canMutateTask.
 * @param {object} access
 * @param {string|number} taskId
 * @param {object} req
 */
async function deleteTask(access, taskId, req) {
  // Create the existing constant.
  const existing = await repo.findTaskById(taskId);
  // Evaluate the condition and enter the branch when it is true.
  if (!existing) throw createHttpError('NOT_FOUND', 'Task not found.', 404);
  // Evaluate the condition and enter the branch when it is true.
  if (!canMutateTask(access, existing)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Create the deleted constant.
  const deleted = await repo.deleteTask(taskId);
  // Evaluate the condition and enter the branch when it is true.
  if (!deleted) throw createHttpError('NOT_FOUND', 'Task not found.', 404);

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.task.delete',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: String(taskId),
    // Provide the metadata field value.
    metadata: {},
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'task_deleted',
    // Provide the entity type field value.
    entityType: 'calendar_task',
    // Provide the entity id field value.
    entityId: taskId,
  });

  // Return the resulting value to the caller.
  return { id: String(taskId), deleted: true };
}

/**
 * List tasks with filters; VIEW_OWN forces assignee = current user.
 * @param {object} access
 * @param {object} [query]
 */
async function listTasks(access, query = {}) {
  // Create the own only constant.
  const ownOnly = isOwnTasksOnly(access);
  // Create the filters constant.
  const filters = {
    // Provide the from field value.
    from: query.from ? new Date(query.from) : null,
    // Provide the to field value.
    to: query.to ? new Date(query.to) : null,
    // Provide the task type field value.
    taskType: query.type || null,
    // Provide the task types field value.
    taskTypes: Array.isArray(query.types) ? query.types : null,
    // Provide the status field value.
    status: query.status || null,
    // Provide the car id field value.
    carId: query.carId != null ? Number(query.carId) : null,
    // Provide the include cancelled field value.
    includeCancelled: parseBoolQuery(query.includeCancelled) || query.status === 'cancelled',
    // Provide the unassigned field value.
    unassigned: false,
    // Provide the assigned to user id field value.
    assignedToUserId: null,
  };

  // Assignee scoping: VIEW_OWN locks to self; otherwise honor unassigned / me / id.
  if (ownOnly) {
    // Update filters.assignedToUserId with the right-hand side value.
    filters.assignedToUserId = access.userId;
  // Continue the surrounding logic with this statement.
  } else if (parseBoolQuery(query.unassigned)) {
    // Update filters.unassigned with the right-hand side value.
    filters.unassigned = true;
  // Continue the surrounding logic with this statement.
  } else if (query.assignee === 'me') {
    // Update filters.assignedToUserId with the right-hand side value.
    filters.assignedToUserId = access.userId;
  // Continue the surrounding logic with this statement.
  } else if (query.assignee != null && query.assignee !== '') {
    // Create the n constant.
    const n = Number(query.assignee);
    // Evaluate the condition and enter the branch when it is true.
    if (!Number.isInteger(n) || n <= 0) {
      // Throw an error to stop the current control flow.
      throw createHttpError('VALIDATION_ERROR', 'Invalid assignee.', 422);
    }
    // Update filters.assignedToUserId with the right-hand side value.
    filters.assignedToUserId = n;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (filters.from && filters.to && !(filters.from < filters.to)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid from/to range.', 422);
  }

  // Create the tasks constant.
  const tasks = await repo.listTasks(filters);
  // Return the resulting value to the caller.
  return { tasks };
}

/**
 * Staff users with driver/cleaner/receptionist roles for assignment pickers.
 * @param {object} access
 */
async function listAssignableStaff(access) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.ASSIGN_STAFF)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Create the users constant.
  const users = await userRoleSql.listAssignableStaffByRoleSlugs([
    // Spread taskDomain.ASSIGNABLE_ROLE_SLUGS into the surrounding structure.
    ...taskDomain.ASSIGNABLE_ROLE_SLUGS,
  ]);
  // Return the resulting value to the caller.
  return { users };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaff,
};
