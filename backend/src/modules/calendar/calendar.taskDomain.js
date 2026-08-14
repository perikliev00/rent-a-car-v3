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

const DRIVER_TYPES = Object.freeze([
  'pickup',
  'delivery',
  'return',
  'maintenance_dropoff',
  'maintenance_pickup',
]);

const CLEANER_TYPES = Object.freeze(['cleaning', 'inspection']);

const RECEPTIONIST_TYPES = Object.freeze([
  'document_check',
  'pickup',
  'delivery',
  'return',
]);

const ASSIGNABLE_ROLE_SLUGS = Object.freeze(['driver', 'cleaner', 'receptionist']);

const TERMINAL_TASK_STATUSES = Object.freeze(['completed', 'failed', 'cancelled']);

/** @type {Record<string, string[]>} */
const TRANSITIONS = Object.freeze({
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled', 'pending'],
  in_progress: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
});

function isValidTaskType(type) {
  return TASK_TYPES.includes(type);
}

function isValidTaskStatus(status) {
  return TASK_STATUSES.includes(status);
}

/**
 * Initial status for a newly created task.
 * @param {string|number|null|undefined} assigneeId
 */
function initialStatusForCreate(assigneeId) {
  return assigneeId != null && String(assigneeId).trim() !== '' ? 'assigned' : 'pending';
}

/**
 * Derive status after assignee change (without changing in_progress / terminal).
 * @param {string} currentStatus
 * @param {string|number|null|undefined} assigneeId
 */
function statusAfterAssigneeChange(currentStatus, assigneeId) {
  const hasAssignee = assigneeId != null && String(assigneeId).trim() !== '';
  if (currentStatus === 'pending' && hasAssignee) return 'assigned';
  if (currentStatus === 'assigned' && !hasAssignee) return 'pending';
  return currentStatus;
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{ isManager?: boolean }} [opts]
 */
function assertTransition(from, to, opts = {}) {
  if (!isValidTaskStatus(from) || !isValidTaskStatus(to)) {
    const err = new Error('Invalid status.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }
  if (from === to) return;

  const isManager = Boolean(opts.isManager);
  if (isManager && (from === 'failed' || from === 'cancelled') && (to === 'pending' || to === 'assigned')) {
    return;
  }

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
