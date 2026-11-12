/**
 * Calendar task domain constants and status-machine helpers.
 *
 * Defines task types, statuses, role-to-type affinity, and transitions.
 * Managers may reopen failed/cancelled tasks; workers follow TRANSITIONS.
 */

const TASK_TYPES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'delivery',
  // Supply the literal value used by the enclosing expression.
  'return',
  // Supply the literal value used by the enclosing expression.
  'cleaning',
  // Supply the literal value used by the enclosing expression.
  'inspection',
  // Supply the literal value used by the enclosing expression.
  'maintenance_dropoff',
  // Supply the literal value used by the enclosing expression.
  'maintenance_pickup',
  // Supply the literal value used by the enclosing expression.
  'document_check',
]);

// Create the task statuses constant.
const TASK_STATUSES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'pending',
  // Supply the literal value used by the enclosing expression.
  'assigned',
  // Supply the literal value used by the enclosing expression.
  'in_progress',
  // Supply the literal value used by the enclosing expression.
  'completed',
  // Supply the literal value used by the enclosing expression.
  'failed',
  // Supply the literal value used by the enclosing expression.
  'cancelled',
]);

/** Task types typically assigned to drivers. */
const DRIVER_TYPES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'delivery',
  // Supply the literal value used by the enclosing expression.
  'return',
  // Supply the literal value used by the enclosing expression.
  'maintenance_dropoff',
  // Supply the literal value used by the enclosing expression.
  'maintenance_pickup',
]);

/** Task types typically assigned to cleaners. */
const CLEANER_TYPES = Object.freeze(['cleaning', 'inspection']);

/** Task types typically assigned to receptionists. */
const RECEPTIONIST_TYPES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'document_check',
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'delivery',
  // Supply the literal value used by the enclosing expression.
  'return',
]);

/** RBAC role slugs that may be assigned calendar tasks. */
const ASSIGNABLE_ROLE_SLUGS = Object.freeze(['driver', 'cleaner', 'receptionist']);

/** Statuses that end the task lifecycle (no further work transitions). */
const TERMINAL_TASK_STATUSES = Object.freeze(['completed', 'failed', 'cancelled']);

/**
 * Allowed status transitions for non-manager flows.
 * Empty arrays = terminal; managers may reopen via assertTransition/allowedNextStatuses.
 * @type {Record<string, string[]>}
 */
const TRANSITIONS = Object.freeze({
  // Provide the pending field value.
  pending: ['assigned', 'cancelled'],
  // Provide the assigned field value.
  assigned: ['in_progress', 'cancelled', 'pending'],
  // Provide the in progress field value.
  in_progress: ['completed', 'failed', 'cancelled'],
  // Provide the completed field value.
  completed: [],
  // Provide the failed field value.
  failed: [],
  // Provide the cancelled field value.
  cancelled: [],
});

/**
 * @param {string} type
 * @returns {boolean} Whether type is one of TASK_TYPES
 */
function isValidTaskType(type) {
  // Return the resulting value to the caller.
  return TASK_TYPES.includes(type);
}

/**
 * @param {string} status
 * @returns {boolean} Whether status is one of TASK_STATUSES
 */
function isValidTaskStatus(status) {
  // Return the resulting value to the caller.
  return TASK_STATUSES.includes(status);
}

/**
 * Initial status for a newly created task.
 * Assigned when an assignee is provided; otherwise pending.
 * @param {string|number|null|undefined} assigneeId
 */
function initialStatusForCreate(assigneeId) {
  // Return the resulting value to the caller.
  return assigneeId != null && String(assigneeId).trim() !== '' ? 'assigned' : 'pending';
}

/**
 * Derive status after assignee change (without changing in_progress / terminal).
 * pending + assignee → assigned; assigned + no assignee → pending; otherwise unchanged.
 * @param {string} currentStatus
 * @param {string|number|null|undefined} assigneeId
 */
function statusAfterAssigneeChange(currentStatus, assigneeId) {
  // Create the has assignee constant.
  const hasAssignee = assigneeId != null && String(assigneeId).trim() !== '';
  // Promote pending → assigned when staff is attached.
  if (currentStatus === 'pending' && hasAssignee) return 'assigned';
  // Demote assigned → pending when staff is cleared.
  if (currentStatus === 'assigned' && !hasAssignee) return 'pending';
  // in_progress / terminal statuses keep their status on assignee edits.
  return currentStatus;
}

/**
 * Enforce status transition rules; managers may reopen failed/cancelled.
 * @param {string} from
 * @param {string} to
 * @param {{ isManager?: boolean }} [opts]
 */
function assertTransition(from, to, opts = {}) {
  // Reject unknown status strings early.
  if (!isValidTaskStatus(from) || !isValidTaskStatus(to)) {
    // Create the err constant.
    const err = new Error('Invalid status.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // No-op transition is always allowed.
  if (from === to) return;

  // Manager reopen escape hatch: failed/cancelled → pending|assigned.
  const isManager = Boolean(opts.isManager);
  // Evaluate the condition and enter the branch when it is true.
  if (isManager && (from === 'failed' || from === 'cancelled') && (to === 'pending' || to === 'assigned')) {
    // Return control to the caller with the following value.
    return;
  }

  // Standard worker/manager path: must be listed in TRANSITIONS[from].
  const allowed = TRANSITIONS[from] || [];
  // Evaluate the condition and enter the branch when it is true.
  if (!allowed.includes(to)) {
    // Create the err constant.
    const err = new Error(`Cannot transition task from ${from} to ${to}.`);
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * Allowed next statuses for UI (includes manager reopen when applicable).
 * @param {string} from
 * @param {{ isManager?: boolean }} [opts]
 */
function allowedNextStatuses(from, opts = {}) {
  // Create the base constant.
  const base = [...(TRANSITIONS[from] || [])];
  // Surface reopen options in the same list the UI uses for action buttons.
  if (opts.isManager && (from === 'failed' || from === 'cancelled')) {
    // Evaluate the condition and enter the branch when it is true.
    if (!base.includes('pending')) base.push('pending');
    // Evaluate the condition and enter the branch when it is true.
    if (!base.includes('assigned')) base.push('assigned');
  }
  // Return the resulting value to the caller.
  return base;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  TASK_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  TASK_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  DRIVER_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  CLEANER_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  RECEPTIONIST_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  ASSIGNABLE_ROLE_SLUGS,
  // Contribute this line to the enclosing declaration or statement.
  TERMINAL_TASK_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  TRANSITIONS,
  // Contribute this line to the enclosing declaration or statement.
  isValidTaskType,
  // Contribute this line to the enclosing declaration or statement.
  isValidTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  initialStatusForCreate,
  // Contribute this line to the enclosing declaration or statement.
  statusAfterAssigneeChange,
  // Contribute this line to the enclosing declaration or statement.
  assertTransition,
  // Contribute this line to the enclosing declaration or statement.
  allowedNextStatuses,
};
