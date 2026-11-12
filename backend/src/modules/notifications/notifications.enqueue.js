/**
 * Idempotent notification enqueue helpers.
 *
 * Every insert requires an idempotencyKey so retries do not duplicate sends.
 * Domain helpers build keys from order/reservation/failure identities.
 */

const repo = require('./notifications.repository');
const { NOTIFICATION_TYPES } = require('./notificationTypes');

/** Coerce id-like values (number, string, or { id }) to a positive integer or null. */
function normalizeId(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value.id != null) {
    const n = Number(value.id);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Insert a notification row if the idempotency key is new.
 * @returns {Promise<object|null>} Mapped row or null on conflict
 */
async function enqueue({
  type,
  channel = 'email',
  recipientEmail,
  recipientUserId,
  reservationId,
  orderId,
  carId,
  payload = {},
  scheduledAt = null,
  idempotencyKey,
  status = 'pending',
}) {
  // Reject unknown types early so typos do not pollute the outbox.
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  // Idempotency key is mandatory — duplicates return null from insert.
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }

  return repo.insertNotification({
    type,
    channel,
    recipientEmail,
    recipientUserId: normalizeId(recipientUserId),
    reservationId: normalizeId(reservationId),
    orderId: normalizeId(orderId),
    carId: normalizeId(carId),
    payload,
    scheduledAt,
    idempotencyKey,
    status,
  });
}

/** Customer confirmation email keyed by order id. */
async function enqueueReservationConfirmation({ order, reservation, carName }) {
  if (!order?.email) return null;
  const orderId = order.id;
  const reservationId = reservation?.id || order.reservationId || null;
  const carId = order.carId || reservation?.carId || null;

  return enqueue({
    type: 'reservation_confirmation',
    recipientEmail: order.email,
    reservationId,
    orderId,
    carId,
    payload: {
      orderId,
      reservationId,
      carName: carName || null,
      fullName: order.fullName,
      pickupDate: order.pickupDate,
      returnDate: order.returnDate,
      pickupLocation: order.pickupLocation,
      returnLocation: order.returnLocation,
      totalPrice: order.totalPrice,
    },
    idempotencyKey: `reservation_confirmation:order:${orderId}`,
  });
}

/** Admin alert to ADMIN_EMAIL for a newly confirmed booking. */
async function enqueueAdminNewBooking({ order, reservation, carName }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return null;
  const orderId = order.id;
  const reservationId = reservation?.id || order.reservationId || null;

  return enqueue({
    type: 'admin_new_booking_alert',
    recipientEmail: adminEmail,
    reservationId,
    orderId,
    carId: order.carId || reservation?.carId || null,
    payload: {
      orderId,
      reservationId,
      carName: carName || null,
      fullName: order.fullName,
      email: order.email,
      totalPrice: order.totalPrice,
    },
    idempotencyKey: `admin_new_booking_alert:order:${orderId}`,
  });
}

/** Payment-failure notice; prefers failureId for a stable idempotency key. */
async function enqueuePaymentFailed({
  reservationId,
  email,
  reason,
  stripeSessionId,
  failureId,
}) {
  if (!email) return null;
  const key = failureId
    ? `payment_failed:failure:${failureId}`
    : `payment_failed:reservation:${reservationId || 'none'}:session:${stripeSessionId || 'none'}:reason:${reason}`;

  return enqueue({
    type: 'payment_failed',
    recipientEmail: email,
    reservationId: reservationId || null,
    payload: { reason, stripeSessionId, failureId },
    idempotencyKey: key,
  });
}

module.exports = {
  enqueue,
  enqueueReservationConfirmation,
  enqueueAdminNewBooking,
  enqueuePaymentFailed,
};
