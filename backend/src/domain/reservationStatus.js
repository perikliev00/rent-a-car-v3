/**
 * Single source of truth for reservation lifecycle statuses and transitions.
 * Controllers and services must use these helpers instead of ad-hoc status string checks.
 */

const RESERVATION_STATUSES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'pending_payment',
  // Supply the literal value used by the enclosing expression.
  'processing_payment',
  // Supply the literal value used by the enclosing expression.
  'paid',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'picked_up',
  // Supply the literal value used by the enclosing expression.
  'active_rental',
  // Supply the literal value used by the enclosing expression.
  'returned',
  // Supply the literal value used by the enclosing expression.
  'completed',
  // Supply the literal value used by the enclosing expression.
  'cancelled',
  // Supply the literal value used by the enclosing expression.
  'no_show',
  // Supply the literal value used by the enclosing expression.
  'expired',
  // Supply the literal value used by the enclosing expression.
  'manual_review',
  // Supply the literal value used by the enclosing expression.
  'refunded',
]);

/** Holds that block car availability (GiST exclusion + overlap queries). */
const ACTIVE_HOLD_STATUSES = Object.freeze(['pending_payment', 'processing_payment']);

/** @deprecated Use ACTIVE_HOLD_STATUSES */
const ACTIVE_RESERVATION_STATUSES = ACTIVE_HOLD_STATUSES;

// Create the terminal statuses constant.
const TERMINAL_STATUSES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'completed',
  // Supply the literal value used by the enclosing expression.
  'cancelled',
  // Supply the literal value used by the enclosing expression.
  'expired',
  // Supply the literal value used by the enclosing expression.
  'no_show',
  // Supply the literal value used by the enclosing expression.
  'refunded',
]);

// Create the transitions constant.
const TRANSITIONS = Object.freeze({
  // Provide the pending payment field value.
  pending_payment: Object.freeze(['processing_payment', 'expired', 'cancelled']),
  // Provide the processing payment field value.
  processing_payment: Object.freeze([
    // Supply the literal value used by the enclosing expression.
    'paid',
    // Supply the literal value used by the enclosing expression.
    'pending_payment',
    // Supply the literal value used by the enclosing expression.
    'expired',
    // Supply the literal value used by the enclosing expression.
    'cancelled',
    // Supply the literal value used by the enclosing expression.
    'manual_review',
  ]),
  // Provide the paid field value.
  paid: Object.freeze(['confirmed', 'manual_review', 'refunded', 'cancelled']),
  // Provide the manual review field value.
  manual_review: Object.freeze(['confirmed', 'refunded', 'cancelled']),
  // Provide the confirmed field value.
  confirmed: Object.freeze(['car_prepared', 'cancelled', 'no_show', 'refunded']),
  // Provide the car prepared field value.
  car_prepared: Object.freeze(['picked_up', 'cancelled', 'no_show', 'refunded']),
  // Provide the picked up field value.
  picked_up: Object.freeze(['active_rental', 'returned']),
  // Provide the active rental field value.
  active_rental: Object.freeze(['returned']),
  // Provide the returned field value.
  returned: Object.freeze(['completed']),
  // Provide the completed field value.
  completed: Object.freeze([]),
  // Provide the cancelled field value.
  cancelled: Object.freeze(['manual_review']),
  // Provide the expired field value.
  expired: Object.freeze(['paid', 'manual_review']),
  // Provide the no show field value.
  no_show: Object.freeze([]),
  // Provide the refunded field value.
  refunded: Object.freeze([]),
});

// Create the admin ops statuses constant.
const ADMIN_OPS_STATUSES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'picked_up',
  // Supply the literal value used by the enclosing expression.
  'active_rental',
  // Supply the literal value used by the enclosing expression.
  'returned',
  // Supply the literal value used by the enclosing expression.
  'completed',
  // Supply the literal value used by the enclosing expression.
  'cancelled',
  // Supply the literal value used by the enclosing expression.
  'no_show',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
]);

/**
 * Whether `status` is one of the known reservation lifecycle values.
 *
 * @param {string} status
 * @returns {boolean}
 * @throws {never}
 */
function isValidStatus(status) {
  // Return the resulting value to the caller.
  return RESERVATION_STATUSES.includes(status);
}

/**
 * Whether `status` is a payment hold that blocks car availability.
 *
 * @param {string} status
 * @returns {boolean}
 * @throws {never}
 */
function isHoldStatus(status) {
  // Return the resulting value to the caller.
  return ACTIVE_HOLD_STATUSES.includes(status);
}

/**
 * Whether `status` is terminal (no further customer-facing lifecycle progress).
 *
 * @param {string} status
 * @returns {boolean}
 * @throws {never}
 */
function isTerminal(status) {
  // Return the resulting value to the caller.
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Confirmed booking or later rental ops (order exists / finalization done).
 *
 * @param {string} status
 * @returns {boolean}
 * @throws {never}
 */
function isOpsLifecycleStatus(status) {
  // Return the resulting value to the caller.
  return [
    // Supply the literal value used by the enclosing expression.
    'confirmed',
    // Supply the literal value used by the enclosing expression.
    'car_prepared',
    // Supply the literal value used by the enclosing expression.
    'picked_up',
    // Supply the literal value used by the enclosing expression.
    'active_rental',
    // Supply the literal value used by the enclosing expression.
    'returned',
    // Supply the literal value used by the enclosing expression.
    'completed',
  // Continue the surrounding logic with this statement.
  ].includes(status);
}

/**
 * Whether a status change is allowed by the lifecycle graph.
 * Same-status is always allowed; null `fromStatus` only permits pending_payment or confirmed.
 *
 * @param {string | null | undefined} fromStatus - Current status, or null for brand-new rows
 * @param {string} toStatus - Desired next status
 * @returns {boolean}
 * @throws {never}
 */
function canTransition(fromStatus, toStatus) {
  // New rows may only start as a payment hold or an admin-created confirmed booking.
  if (fromStatus == null) {
    // Return the resulting value to the caller.
    return toStatus === 'pending_payment' || toStatus === 'confirmed';
  }
  // Unknown statuses are never transitionable.
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) {
    // Return the resulting value to the caller.
    return false;
  }
  // Idempotent no-op updates are always allowed.
  if (fromStatus === toStatus) {
    // Return the resulting value to the caller.
    return true;
  }
  // Look up the allowed edge list for the current status.
  const allowed = TRANSITIONS[fromStatus] || [];
  // Return the resulting value to the caller.
  return allowed.includes(toStatus);
}

/**
 * Throw a 422-style error when `canTransition` is false.
 * Same-status is a no-op (returns without throwing).
 *
 * @param {string | null | undefined} fromStatus
 * @param {string} toStatus
 * @returns {void}
 * @throws {Error} With `code=INVALID_STATUS_TRANSITION` and `status=422` when disallowed
 */
function assertTransition(fromStatus, toStatus) {
  // Same status → nothing to assert.
  if (fromStatus === toStatus) {
    // Return control to the caller with the following value.
    return;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!canTransition(fromStatus, toStatus)) {
    // Create the err constant.
    const err = new Error(
      // Continue the surrounding logic with this statement.
      `Invalid reservation status transition: ${fromStatus ?? 'null'} → ${toStatus}`
    );
    // Update err.code with the right-hand side value.
    err.code = 'INVALID_STATUS_TRANSITION';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Update err.fromStatus with the right-hand side value.
    err.fromStatus = fromStatus;
    // Update err.toStatus with the right-hand side value.
    err.toStatus = toStatus;
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_HOLD_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_RESERVATION_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  TERMINAL_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  TRANSITIONS,
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_OPS_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  isValidStatus,
  // Contribute this line to the enclosing declaration or statement.
  isHoldStatus,
  // Contribute this line to the enclosing declaration or statement.
  isTerminal,
  // Contribute this line to the enclosing declaration or statement.
  isOpsLifecycleStatus,
  // Contribute this line to the enclosing declaration or statement.
  canTransition,
  // Contribute this line to the enclosing declaration or statement.
  assertTransition,
};
