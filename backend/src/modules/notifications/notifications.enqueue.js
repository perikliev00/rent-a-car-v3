/**
 * Idempotent notification enqueue helpers.
 *
 * Every insert requires an idempotencyKey so retries do not duplicate sends.
 * Domain helpers build keys from order/reservation/failure identities.
 */

const repo = require('./notifications.repository');
// Destructure object properties into local variables.
const { NOTIFICATION_TYPES } = require('./notificationTypes');

/** Coerce id-like values (number, string, or { id }) to a positive integer or null. */
function normalizeId(value) {
  // Evaluate the condition and enter the branch when it is true.
  if (value == null) return null;
  // Evaluate the condition and enter the branch when it is true.
  if (typeof value === 'object' && value.id != null) {
    // Create the n constant.
    const n = Number(value.id);
    // Return the resulting value to the caller.
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  // Create the n constant.
  const n = Number(value);
  // Return the resulting value to the caller.
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Insert a notification row if the idempotency key is new.
 * @returns {Promise<object|null>} Mapped row or null on conflict
 */
async function enqueue({
  // Contribute this line to the enclosing declaration or statement.
  type,
  // Update channel with the right-hand side value.
  channel = 'email',
  // Contribute this line to the enclosing declaration or statement.
  recipientEmail,
  // Contribute this line to the enclosing declaration or statement.
  recipientUserId,
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  orderId,
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Update payload with the right-hand side value.
  payload = {},
  // Update scheduledAt with the right-hand side value.
  scheduledAt = null,
  // Contribute this line to the enclosing declaration or statement.
  idempotencyKey,
  // Update status with the right-hand side value.
  status = 'pending',
// Continue the surrounding logic with this statement.
}) {
  // Reject unknown types early so typos do not pollute the outbox.
  if (!NOTIFICATION_TYPES.includes(type)) {
    // Throw an error to stop the current control flow.
    throw new Error(`Unknown notification type: ${type}`);
  }
  // Idempotency key is mandatory — duplicates return null from insert.
  if (!idempotencyKey) {
    // Throw an error to stop the current control flow.
    throw new Error('idempotencyKey is required');
  }

  // Return the resulting value to the caller.
  return repo.insertNotification({
    // Contribute this line to the enclosing declaration or statement.
    type,
    // Contribute this line to the enclosing declaration or statement.
    channel,
    // Contribute this line to the enclosing declaration or statement.
    recipientEmail,
    // Provide the recipient user id field value.
    recipientUserId: normalizeId(recipientUserId),
    // Provide the reservation id field value.
    reservationId: normalizeId(reservationId),
    // Provide the order id field value.
    orderId: normalizeId(orderId),
    // Provide the car id field value.
    carId: normalizeId(carId),
    // Contribute this line to the enclosing declaration or statement.
    payload,
    // Contribute this line to the enclosing declaration or statement.
    scheduledAt,
    // Contribute this line to the enclosing declaration or statement.
    idempotencyKey,
    // Contribute this line to the enclosing declaration or statement.
    status,
  });
}

/** Customer confirmation email keyed by order id. */
async function enqueueReservationConfirmation({ order, reservation, carName }) {
  // Evaluate the condition and enter the branch when it is true.
  if (!order?.email) return null;
  // Create the order id constant.
  const orderId = order.id;
  // Create the reservation id constant.
  const reservationId = reservation?.id || order.reservationId || null;
  // Create the car id constant.
  const carId = order.carId || reservation?.carId || null;

  // Return the resulting value to the caller.
  return enqueue({
    // Provide the type field value.
    type: 'reservation_confirmation',
    // Provide the recipient email field value.
    recipientEmail: order.email,
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Contribute this line to the enclosing declaration or statement.
    orderId,
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Provide the payload field value.
    payload: {
      // Contribute this line to the enclosing declaration or statement.
      orderId,
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Provide the car name field value.
      carName: carName || null,
      // Provide the full name field value.
      fullName: order.fullName,
      // Provide the pickup date field value.
      pickupDate: order.pickupDate,
      // Provide the return date field value.
      returnDate: order.returnDate,
      // Provide the pickup location field value.
      pickupLocation: order.pickupLocation,
      // Provide the return location field value.
      returnLocation: order.returnLocation,
      // Provide the total price field value.
      totalPrice: order.totalPrice,
    },
    // Provide the idempotency key field value.
    idempotencyKey: `reservation_confirmation:order:${orderId}`,
  });
}

/** Admin alert to ADMIN_EMAIL for a newly confirmed booking. */
async function enqueueAdminNewBooking({ order, reservation, carName }) {
  // Create the admin email constant.
  const adminEmail = process.env.ADMIN_EMAIL;
  // Evaluate the condition and enter the branch when it is true.
  if (!adminEmail) return null;
  // Create the order id constant.
  const orderId = order.id;
  // Create the reservation id constant.
  const reservationId = reservation?.id || order.reservationId || null;

  // Return the resulting value to the caller.
  return enqueue({
    // Provide the type field value.
    type: 'admin_new_booking_alert',
    // Provide the recipient email field value.
    recipientEmail: adminEmail,
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Contribute this line to the enclosing declaration or statement.
    orderId,
    // Provide the car id field value.
    carId: order.carId || reservation?.carId || null,
    // Provide the payload field value.
    payload: {
      // Contribute this line to the enclosing declaration or statement.
      orderId,
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Provide the car name field value.
      carName: carName || null,
      // Provide the full name field value.
      fullName: order.fullName,
      // Provide the email field value.
      email: order.email,
      // Provide the total price field value.
      totalPrice: order.totalPrice,
    },
    // Provide the idempotency key field value.
    idempotencyKey: `admin_new_booking_alert:order:${orderId}`,
  });
}

/** Payment-failure notice; prefers failureId for a stable idempotency key. */
async function enqueuePaymentFailed({
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  email,
  // Contribute this line to the enclosing declaration or statement.
  reason,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  failureId,
// Continue the surrounding logic with this statement.
}) {
  // Evaluate the condition and enter the branch when it is true.
  if (!email) return null;
  // Create the key constant.
  const key = failureId
    // Continue the surrounding logic with this statement.
    ? `payment_failed:failure:${failureId}`
    // Continue the surrounding logic with this statement.
    : `payment_failed:reservation:${reservationId || 'none'}:session:${stripeSessionId || 'none'}:reason:${reason}`;

  // Return the resulting value to the caller.
  return enqueue({
    // Provide the type field value.
    type: 'payment_failed',
    // Provide the recipient email field value.
    recipientEmail: email,
    // Provide the reservation id field value.
    reservationId: reservationId || null,
    // Provide the payload field value.
    payload: { reason, stripeSessionId, failureId },
    // Provide the idempotency key field value.
    idempotencyKey: key,
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  enqueue,
  // Contribute this line to the enclosing declaration or statement.
  enqueueReservationConfirmation,
  // Contribute this line to the enclosing declaration or statement.
  enqueueAdminNewBooking,
  // Contribute this line to the enclosing declaration or statement.
  enqueuePaymentFailed,
};
