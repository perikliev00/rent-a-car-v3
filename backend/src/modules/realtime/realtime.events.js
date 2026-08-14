const LIVE_EVENT_TYPES = Object.freeze([
  'new_booking',
  'payment_succeeded',
  'payment_failed',
  'reservation_confirmed',
  'car_returned',
  'manual_review_needed',
  'paid_but_not_confirmed',
  'reservation_updated',
  'calendar_updated',
]);

/** High-signal statuses → dedicated event types (toasts on frontend). */
const STATUS_TO_EVENT_TYPES = Object.freeze({
  paid: Object.freeze(['payment_succeeded', 'paid_but_not_confirmed']),
  confirmed: Object.freeze(['reservation_confirmed']),
  returned: Object.freeze(['car_returned']),
  manual_review: Object.freeze(['manual_review_needed']),
  expired: Object.freeze(['payment_failed']),
});

const TOAST_MESSAGES = Object.freeze({
  new_booking: (ctx) =>
    `New booking${ctx.reservationId ? ` #${ctx.reservationId}` : ''}${
      ctx.carName ? ` · ${ctx.carName}` : ''
    }`,
  payment_succeeded: (ctx) =>
    `Payment succeeded${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  payment_failed: (ctx) =>
    `Payment failed${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  reservation_confirmed: (ctx) =>
    `Reservation confirmed${ctx.reservationId ? ` #${ctx.reservationId}` : ''}`,
  car_returned: (ctx) =>
    `Car returned${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  manual_review_needed: (ctx) =>
    `Manual review needed${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  paid_but_not_confirmed: (ctx) =>
    `Paid but not confirmed${ctx.reservationId ? ` · reservation #${ctx.reservationId}` : ''}`,
  reservation_updated: (ctx) =>
    `Reservation updated${ctx.reservationId ? ` #${ctx.reservationId}` : ''}`,
  calendar_updated: () => 'Calendar updated',
});

let eventSeq = 0;

function nextEventId() {
  eventSeq += 1;
  return `${Date.now()}-${eventSeq}`;
}

function resolveCarId(reservation) {
  if (!reservation) return null;
  const carId = reservation.carId;
  if (carId == null) return null;
  if (typeof carId === 'object' && carId.id != null) return String(carId.id);
  return String(carId);
}

function resolveCarName(reservation, fallback = null) {
  if (fallback) return fallback;
  if (!reservation) return null;
  const carId = reservation.carId;
  if (typeof carId === 'object' && carId.name) return carId.name;
  return null;
}

function buildLiveEvent(type, partial = {}) {
  if (!LIVE_EVENT_TYPES.includes(type)) {
    throw new Error(`Unknown live event type: ${type}`);
  }

  const reservationId =
    partial.reservationId != null ? String(partial.reservationId) : null;
  const orderId = partial.orderId != null ? String(partial.orderId) : null;
  const carId = partial.carId != null ? String(partial.carId) : null;
  const ctx = {
    reservationId,
    carName: partial.carName || null,
  };
  const messageFn = TOAST_MESSAGES[type];
  const message =
    partial.message ||
    (typeof messageFn === 'function' ? messageFn(ctx) : type);

  return {
    id: partial.id || nextEventId(),
    type,
    occurredAt: partial.occurredAt || new Date().toISOString(),
    reservationId,
    orderId,
    carId,
    carName: partial.carName || null,
    customerName: partial.customerName || null,
    status: partial.status || null,
    oldStatus: partial.oldStatus || null,
    message,
    meta: partial.meta && typeof partial.meta === 'object' ? partial.meta : {},
  };
}

function contextFromStatusChange(event) {
  const reservation = event?.reservation || null;
  return {
    reservationId: event?.reservationId || reservation?.id || null,
    orderId: event?.metadata?.orderId || reservation?.orderId || null,
    carId: resolveCarId(reservation),
    carName: resolveCarName(reservation),
    customerName: reservation?.fullName || null,
    status: event?.newStatus || reservation?.status || null,
    oldStatus: event?.oldStatus ?? null,
    meta: {
      reason: event?.reason || null,
      ...(event?.metadata && typeof event.metadata === 'object' ? event.metadata : {}),
    },
  };
}

/**
 * Map a reservation status-change listener event to zero or more live admin events.
 * High-signal statuses keep dedicated types; all other real changes emit reservation_updated.
 */
function mapStatusChangeToEvents(event) {
  const newStatus = event?.newStatus;
  if (!newStatus) return [];

  const base = contextFromStatusChange(event);
  const types = STATUS_TO_EVENT_TYPES[newStatus];
  if (types && types.length > 0) {
    return types.map((type) => buildLiveEvent(type, base));
  }

  if (event.oldStatus === newStatus) {
    return [];
  }

  return [
    buildLiveEvent('reservation_updated', {
      ...base,
      message: `Reservation updated${
        base.reservationId ? ` #${base.reservationId}` : ''
      }${newStatus ? ` → ${newStatus}` : ''}`,
    }),
  ];
}

function buildNewBookingEvent({ order, reservation, carName } = {}) {
  const reservationId = reservation?.id || order?.reservationId || null;
  const orderId = order?.id || null;
  const carId =
    resolveCarId(reservation) ||
    (order?.carId != null ? String(order.carId) : null);

  return buildLiveEvent('new_booking', {
    reservationId,
    orderId,
    carId,
    carName: carName || resolveCarName(reservation) || null,
    customerName: order?.fullName || reservation?.fullName || null,
    status: reservation?.status || 'confirmed',
    oldStatus: null,
    meta: {},
  });
}

function buildPaymentFailedEvent(context = {}) {
  return buildLiveEvent('payment_failed', {
    reservationId: context.reservationId || null,
    orderId: context.orderId || null,
    carId: context.carId || null,
    carName: context.carName || null,
    customerName: context.customerName || null,
    status: context.status || null,
    oldStatus: context.oldStatus || null,
    message: context.message || undefined,
    meta: {
      reason: context.reason || null,
      stripeSessionId: context.stripeSessionId || null,
      failureId: context.failureId || null,
      ...(context.meta && typeof context.meta === 'object' ? context.meta : {}),
    },
  });
}

function buildCalendarUpdatedEvent({
  action = null,
  entityType = null,
  entityId = null,
  message = null,
  meta = {},
} = {}) {
  return buildLiveEvent('calendar_updated', {
    message: message || 'Calendar updated',
    meta: {
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : null,
      ...(meta && typeof meta === 'object' ? meta : {}),
    },
  });
}

module.exports = {
  LIVE_EVENT_TYPES,
  STATUS_TO_EVENT_TYPES,
  buildLiveEvent,
  mapStatusChangeToEvents,
  buildNewBookingEvent,
  buildPaymentFailedEvent,
  buildCalendarUpdatedEvent,
  contextFromStatusChange,
  nextEventId,
};
