/**
 * Live admin event shapes, toast copy, and mappers from domain contexts.
 *
 * Status changes map to high-signal toast types when known; otherwise a
 * generic reservation_updated event is emitted for real transitions only.
 */

const LIVE_EVENT_TYPES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'new_booking',
  // Supply the literal value used by the enclosing expression.
  'payment_succeeded',
  // Supply the literal value used by the enclosing expression.
  'payment_failed',
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_returned',
  // Supply the literal value used by the enclosing expression.
  'manual_review_needed',
  // Supply the literal value used by the enclosing expression.
  'paid_but_not_confirmed',
  // Supply the literal value used by the enclosing expression.
  'reservation_updated',
  // Supply the literal value used by the enclosing expression.
  'calendar_updated',
]);

/** High-signal statuses → dedicated event types (toasts on frontend). */
const STATUS_TO_EVENT_TYPES = Object.freeze({
  // Provide the paid field value.
  paid: Object.freeze(['payment_succeeded', 'paid_but_not_confirmed']),
  // Provide the confirmed field value.
  confirmed: Object.freeze(['reservation_confirmed']),
  // Provide the returned field value.
  returned: Object.freeze(['car_returned']),
  // Provide the manual review field value.
  manual_review: Object.freeze(['manual_review_needed']),
  // Provide the expired field value.
  expired: Object.freeze(['payment_failed']),
});

// Create the toast messages constant.
const TOAST_MESSAGES = Object.freeze({
  // Provide the new booking field value.
  new_booking: (ctx) =>
    // Continue the surrounding logic with this statement.
    `New booking${ctx.reservationId ? ` #${ctx.reservationId}` : ''}${
      // Continue the surrounding logic with this statement.
      ctx.carName ? ` · ${ctx.carName}` : ''
    // Continue the surrounding logic with this statement.
    }`,
  // Provide the payment succeeded field value.
  payment_succeeded: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Payment succeeded${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  // Provide the payment failed field value.
  payment_failed: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Payment failed${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  // Provide the reservation confirmed field value.
  reservation_confirmed: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Reservation confirmed${ctx.reservationId ? ` #${ctx.reservationId}` : ''}`,
  // Provide the car returned field value.
  car_returned: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Car returned${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  // Provide the manual review needed field value.
  manual_review_needed: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Manual review needed${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  // Provide the paid but not confirmed field value.
  paid_but_not_confirmed: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Paid but not confirmed${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  // Provide the reservation updated field value.
  reservation_updated: (ctx) =>
    // Continue the surrounding logic with this statement.
    `Reservation updated${ctx.reservationId ? ` #${ctx.reservationId}` : ''}`,
  // Provide the calendar updated field value.
  calendar_updated: () => 'Calendar updated',
});

// Initialize the mutable event seq variable.
let eventSeq = 0;

/** Monotonic-ish event id (timestamp + process sequence) for SSE Last-Event-ID. */
function nextEventId() {
  // Update eventSeq with the right-hand side value.
  eventSeq += 1;
  // Return the resulting value to the caller.
  return `${Date.now()}-${eventSeq}`;
}

/**
 * Normalize car id from populated or scalar reservation.carId.
 * @param {object|null|undefined} reservation
 * @returns {string|null}
 */
function resolveCarId(reservation) {
  // Evaluate the condition and enter the branch when it is true.
  if (!reservation) return null;
  // Create the car id constant.
  const carId = reservation.carId;
  // Evaluate the condition and enter the branch when it is true.
  if (carId == null) return null;
  // Populated car document: prefer nested id.
  if (typeof carId === 'object' && carId.id != null) return String(carId.id);
  // Return the resulting value to the caller.
  return String(carId);
}

/**
 * Resolve display car name from fallback or populated reservation.carId.
 * @param {object|null|undefined} reservation
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
function resolveCarName(reservation, fallback = null) {
  // Evaluate the condition and enter the branch when it is true.
  if (fallback) return fallback;
  // Evaluate the condition and enter the branch when it is true.
  if (!reservation) return null;
  // Create the car id constant.
  const carId = reservation.carId;
  // Evaluate the condition and enter the branch when it is true.
  if (typeof carId === 'object' && carId.name) return carId.name;
  // Return the resulting value to the caller.
  return null;
}

/**
 * Build a normalized live event DTO with toast message.
 * @param {string} type One of LIVE_EVENT_TYPES
 * @param {object} [partial]
 */
function buildLiveEvent(type, partial = {}) {
  // Evaluate the condition and enter the branch when it is true.
  if (!LIVE_EVENT_TYPES.includes(type)) {
    // Throw an error to stop the current control flow.
    throw new Error(`Unknown live event type: ${type}`);
  }

  // Coerce ids to strings for stable SSE JSON / client equality checks.
  const reservationId =
    // Continue the surrounding logic with this statement.
    partial.reservationId != null ? String(partial.reservationId) : null;
  // Create the order id constant.
  const orderId = partial.orderId != null ? String(partial.orderId) : null;
  // Create the car id constant.
  const carId = partial.carId != null ? String(partial.carId) : null;
  // Create the ctx constant.
  const ctx = {
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Provide the car name field value.
    carName: partial.carName || null,
  };
  // Prefer caller-supplied message; otherwise use type-specific toast template.
  const messageFn = TOAST_MESSAGES[type];
  // Create the message constant.
  const message =
    // Contribute this line to the enclosing declaration or statement.
    partial.message ||
    // Continue the surrounding logic with this statement.
    (typeof messageFn === 'function' ? messageFn(ctx) : type);

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: partial.id || nextEventId(),
    // Contribute this line to the enclosing declaration or statement.
    type,
    // Provide the occurred at field value.
    occurredAt: partial.occurredAt || new Date().toISOString(),
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Contribute this line to the enclosing declaration or statement.
    orderId,
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Provide the car name field value.
    carName: partial.carName || null,
    // Provide the customer name field value.
    customerName: partial.customerName || null,
    // Provide the status field value.
    status: partial.status || null,
    // Provide the old status field value.
    oldStatus: partial.oldStatus || null,
    // Contribute this line to the enclosing declaration or statement.
    message,
    // Provide the meta field value.
    meta: partial.meta && typeof partial.meta === 'object' ? partial.meta : {},
  };
}

/**
 * Extract live-event context fields from a reservation status-change payload.
 * @param {object} event
 */
function contextFromStatusChange(event) {
  // Create the reservation constant.
  const reservation = event?.reservation || null;
  // Return the resulting value to the caller.
  return {
    // Provide the reservation id field value.
    reservationId: event?.reservationId || reservation?.id || null,
    // Provide the order id field value.
    orderId: event?.metadata?.orderId || reservation?.orderId || null,
    // Provide the car id field value.
    carId: resolveCarId(reservation),
    // Provide the car name field value.
    carName: resolveCarName(reservation),
    // Provide the customer name field value.
    customerName: reservation?.fullName || null,
    // Provide the status field value.
    status: event?.newStatus || reservation?.status || null,
    // Provide the old status field value.
    oldStatus: event?.oldStatus ?? null,
    // Provide the meta field value.
    meta: {
      // Provide the reason field value.
      reason: event?.reason || null,
      // Call ... to perform this step.
      ...(event?.metadata && typeof event.metadata === 'object' ? event.metadata : {}),
    },
  };
}

/**
 * Map a reservation status-change listener event to zero or more live admin events.
 * High-signal statuses keep dedicated types; all other real changes emit reservation_updated.
 * @param {object} event
 * @returns {object[]}
 */
function mapStatusChangeToEvents(event) {
  // Create the new status constant.
  const newStatus = event?.newStatus;
  // Evaluate the condition and enter the branch when it is true.
  if (!newStatus) return [];

  // Create the base constant.
  const base = contextFromStatusChange(event);
  // High-signal statuses may emit multiple dedicated toast types (e.g. paid).
  const types = STATUS_TO_EVENT_TYPES[newStatus];
  // Evaluate the condition and enter the branch when it is true.
  if (types && types.length > 0) {
    // Return the resulting value to the caller.
    return types.map((type) => buildLiveEvent(type, base));
  }

  // Ignore no-op status "changes" (same old/new).
  if (event.oldStatus === newStatus) {
    // Return the resulting value to the caller.
    return [];
  }

  // Generic catch-all for other real transitions.
  return [
    // Call buildLiveEvent to perform this step.
    buildLiveEvent('reservation_updated', {
      // Spread base into the surrounding structure.
      ...base,
      // Provide the message field value.
      message: `Reservation updated${
        // Continue the surrounding logic with this statement.
        base.reservationId ? ` #${base.reservationId}` : ''
      // Continue the surrounding logic with this statement.
      }${newStatus ? ` → ${newStatus}` : ''}`,
    }),
  ];
}

/** Build new_booking from order/reservation confirmation context. */
function buildNewBookingEvent({ order, reservation, carName } = {}) {
  // Create the reservation id constant.
  const reservationId = reservation?.id || order?.reservationId || null;
  // Create the order id constant.
  const orderId = order?.id || null;
  // Create the car id constant.
  const carId =
    // Call resolveCarId to perform this step.
    resolveCarId(reservation) ||
    // Continue the surrounding logic with this statement.
    (order?.carId != null ? String(order.carId) : null);

  // Return the resulting value to the caller.
  return buildLiveEvent('new_booking', {
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Contribute this line to the enclosing declaration or statement.
    orderId,
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Provide the car name field value.
    carName: carName || resolveCarName(reservation) || null,
    // Provide the customer name field value.
    customerName: order?.fullName || reservation?.fullName || null,
    // Provide the status field value.
    status: reservation?.status || 'confirmed',
    // Provide the old status field value.
    oldStatus: null,
    // Provide the meta field value.
    meta: {},
  });
}

/** Build payment_failed with Stripe/failure metadata in meta. */
function buildPaymentFailedEvent(context = {}) {
  // Return the resulting value to the caller.
  return buildLiveEvent('payment_failed', {
    // Provide the reservation id field value.
    reservationId: context.reservationId || null,
    // Provide the order id field value.
    orderId: context.orderId || null,
    // Provide the car id field value.
    carId: context.carId || null,
    // Provide the car name field value.
    carName: context.carName || null,
    // Provide the customer name field value.
    customerName: context.customerName || null,
    // Provide the status field value.
    status: context.status || null,
    // Provide the old status field value.
    oldStatus: context.oldStatus || null,
    // Provide the message field value.
    message: context.message || undefined,
    // Provide the meta field value.
    meta: {
      // Provide the reason field value.
      reason: context.reason || null,
      // Provide the stripe session id field value.
      stripeSessionId: context.stripeSessionId || null,
      // Provide the failure id field value.
      failureId: context.failureId || null,
      // Call ... to perform this step.
      ...(context.meta && typeof context.meta === 'object' ? context.meta : {}),
    },
  });
}

/** Build calendar_updated; action/entity stored in meta for client refetch hints. */
function buildCalendarUpdatedEvent({
  // Update action with the right-hand side value.
  action = null,
  // Update entityType with the right-hand side value.
  entityType = null,
  // Update entityId with the right-hand side value.
  entityId = null,
  // Update message with the right-hand side value.
  message = null,
  // Update meta with the right-hand side value.
  meta = {},
// Continue the surrounding logic with this statement.
} = {}) {
  // Return the resulting value to the caller.
  return buildLiveEvent('calendar_updated', {
    // Provide the message field value.
    message: message || 'Calendar updated',
    // Provide the meta field value.
    meta: {
      // Contribute this line to the enclosing declaration or statement.
      action,
      // Contribute this line to the enclosing declaration or statement.
      entityType,
      // Provide the entity id field value.
      entityId: entityId != null ? String(entityId) : null,
      // Call ... to perform this step.
      ...(meta && typeof meta === 'object' ? meta : {}),
    },
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  LIVE_EVENT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  STATUS_TO_EVENT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  buildLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  mapStatusChangeToEvents,
  // Contribute this line to the enclosing declaration or statement.
  buildNewBookingEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildPaymentFailedEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildCalendarUpdatedEvent,
  // Contribute this line to the enclosing declaration or statement.
  contextFromStatusChange,
  // Contribute this line to the enclosing declaration or statement.
  nextEventId,
};
