/**
 * Single source of truth for reservation lifecycle statuses and transitions.
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

function isValidStatus(status) {
  return RESERVATION_STATUSES.includes(status);
}

function isHoldStatus(status) {
  return ACTIVE_HOLD_STATUSES.includes(status);
}

function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/** Confirmed booking or later rental ops (order exists / finalization done). */
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

function canTransition(fromStatus, toStatus) {
  if (fromStatus == null) {
    return toStatus === 'pending_payment' || toStatus === 'confirmed';
  }
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) {
    return false;
  }
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function assertTransition(fromStatus, toStatus) {
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
