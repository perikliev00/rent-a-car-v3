/**
 * Single source of truth for reservation lifecycle statuses and transitions.
 * Controllers and services must use these helpers instead of ad-hoc status string checks.
 */

const RESERVATION_STATUSES = Object.freeze([
  'pending_payment',
  'processing_payment',
  'paid',
  'confirmed',
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
  'completed',
  'cancelled',
  'no_show',
  'expired',
  'manual_review',
  'refunded',
]);

/** Holds that block car availability (GiST exclusion + overlap queries). */
const ACTIVE_HOLD_STATUSES = Object.freeze(['pending_payment', 'processing_payment']);

/** @deprecated Use ACTIVE_HOLD_STATUSES */
const ACTIVE_RESERVATION_STATUSES = ACTIVE_HOLD_STATUSES;

const TERMINAL_STATUSES = Object.freeze([
  'completed',
  'cancelled',
  'expired',
  'no_show',
  'refunded',
]);

const TRANSITIONS = Object.freeze({
  pending_payment: Object.freeze(['processing_payment', 'expired', 'cancelled']),
  processing_payment: Object.freeze([
    'paid',
    'pending_payment',
    'expired',
    'cancelled',
    'manual_review',
  ]),
  paid: Object.freeze(['confirmed', 'manual_review', 'refunded', 'cancelled']),
  manual_review: Object.freeze(['confirmed', 'refunded', 'cancelled']),
  confirmed: Object.freeze(['car_prepared', 'cancelled', 'no_show', 'refunded']),
  car_prepared: Object.freeze(['picked_up', 'cancelled', 'no_show', 'refunded']),
  picked_up: Object.freeze(['active_rental', 'returned']),
  active_rental: Object.freeze(['returned']),
  returned: Object.freeze(['completed']),
  completed: Object.freeze([]),
  cancelled: Object.freeze(['manual_review']),
  expired: Object.freeze(['paid', 'manual_review']),
  no_show: Object.freeze([]),
  refunded: Object.freeze([]),
});

const ADMIN_OPS_STATUSES = Object.freeze([
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
  'completed',
  'cancelled',
  'no_show',
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
  return [
    'confirmed',
    'car_prepared',
    'picked_up',
    'active_rental',
    'returned',
    'completed',
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
    return toStatus === 'pending_payment' || toStatus === 'confirmed';
  }
  // Unknown statuses are never transitionable.
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) {
    return false;
  }
  // Idempotent no-op updates are always allowed.
  if (fromStatus === toStatus) {
    return true;
  }
  // Look up the allowed edge list for the current status.
  const allowed = TRANSITIONS[fromStatus] || [];
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
    return;
  }
  if (!canTransition(fromStatus, toStatus)) {
    const err = new Error(
      `Invalid reservation status transition: ${fromStatus ?? 'null'} → ${toStatus}`
    );
    err.code = 'INVALID_STATUS_TRANSITION';
    err.status = 422;
    err.fromStatus = fromStatus;
    err.toStatus = toStatus;
    throw err;
  }
}

module.exports = {
  RESERVATION_STATUSES,
  ACTIVE_HOLD_STATUSES,
  ACTIVE_RESERVATION_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  ADMIN_OPS_STATUSES,
  isValidStatus,
  isHoldStatus,
  isTerminal,
  isOpsLifecycleStatus,
  canTransition,
  assertTransition,
};
