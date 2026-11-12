/**
 * Calendar task domain constants and status-machine helpers.
 *
 * Defines task types, statuses, role-to-type affinity, and transitions.
 * Managers may reopen failed/cancelled tasks; workers follow TRANSITIONS.
 */

const TASK_TYPES = Object.freeze([
  'pickup',
  'delivery',
  'return',
  'cleaning',
  'inspection',
  'maintenance_dropoff',
  'maintenance_pickup',
  'document_check',
]);

const TASK_STATUSES = Object.freeze([
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
]);

/** Task types typically assigned to drivers. */
const DRIVER_TYPES = Object.freeze([
  'pickup',
  'delivery',
  'return',
  'maintenance_dropoff',
  'maintenance_pickup',
]);

/** Task types typically assigned to cleaners. */
const CLEANER_TYPES = Object.freeze(['cleaning', 'inspection']);

/** Task types typically assigned to receptionists. */
const RECEPTIONIST_TYPES = Object.freeze([
  'document_check',
  'pickup',
  'delivery',
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
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled', 'pending'],
  in_progress: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
});

/**
 * @param {string} type
 * @returns {boolean} Whether type is one of TASK_TYPES
 */
function isValidTaskType(type) {
  return TASK_TYPES.includes(type);
}

/**
 * @param {string} status
 * @returns {boolean} Whether status is one of TASK_STATUSES
 */
function isValidTaskStatus(status) {
  return TASK_STATUSES.includes(status);
}

/**
 * Initial status for a newly created task.
 * Assigned when an assignee is provided; otherwise pending.
 * @param {string|number|null|undefined} assigneeId
 */
function initialStatusForCreate(assigneeId) {
  return assigneeId != null && String(assigneeId).trim() !== '' ? 'assigned' : 'pending';
}

/**
 * Derive status after assignee change (without changing in_progress / terminal).
 * pending + assignee → assigned; assigned + no assignee → pending; otherwise unchanged.
 * @param {string} currentStatus
 * @param {string|number|null|undefined} assigneeId
 */
function statusAfterAssigneeChange(currentStatus, assigneeId) {
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
    const err = new Error('Invalid status.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }
  // No-op transition is always allowed.
  if (from === to) return;

  // Manager reopen escape hatch: failed/cancelled → pending|assigned.
  const isManager = Boolean(opts.isManager);
  if (isManager && (from === 'failed' || from === 'cancelled') && (to === 'pending' || to === 'assigned')) {
    return;
  }

  // Standard worker/manager path: must be listed in TRANSITIONS[from].
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Cannot transition task from ${from} to ${to}.`);
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }
}

/**
 * Allowed next statuses for UI (includes manager reopen when applicable).
 * @param {string} from
 * @param {{ isManager?: boolean }} [opts]
 */
function allowedNextStatuses(from, opts = {}) {
  const base = [...(TRANSITIONS[from] || [])];
  // Surface reopen options in the same list the UI uses for action buttons.
  if (opts.isManager && (from === 'failed' || from === 'cancelled')) {
    if (!base.includes('pending')) base.push('pending');
    if (!base.includes('assigned')) base.push('assigned');
  }
  return base;
}

module.exports = {
  TASK_TYPES,
  TASK_STATUSES,
  DRIVER_TYPES,
  CLEANER_TYPES,
  RECEPTIONIST_TYPES,
  ASSIGNABLE_ROLE_SLUGS,
  TERMINAL_TASK_STATUSES,
  TRANSITIONS,
  isValidTaskType,
  isValidTaskStatus,
  initialStatusForCreate,
  statusAfterAssigneeChange,
  assertTransition,
  allowedNextStatuses,
};
