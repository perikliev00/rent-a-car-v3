/**
 * Happy-path paid finalization: mark paid → block calendar range → create order → confirm.
 * Callers must send confirmation emails only after the surrounding transaction commits.
 */
const orderSql = require('../sql/orderSqlService');
// Require the '../sql/paymentFailureSqlService' module as paymentFailureSql.
const paymentFailureSql = require('../sql/paymentFailureSqlService');
// Destructure object properties into local variables.
const { addRange } = require('../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { changeStatus } = require('../reservation/reservationStatusService');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');
// Destructure object properties into local variables.
const { logSystemAction } = require('../admin/adminAuditService');
// Destructure object properties into local variables.
const { paidAmountPatch } = require('../payment/stripeSessionValidation');

/**
 * Whether the active hold's TTL has elapsed.
 * @param {object} reservation
 * @param {Date} [now]
 * @returns {boolean}
 */
function isHoldExpired(reservation, now = new Date()) {
  // Create the hold expires at constant.
  const holdExpiresAt = reservation.holdExpiresAt ? new Date(reservation.holdExpiresAt) : null;
  // Return control to the caller with the following value.
  return (
    // Call ACTIVE_RESERVATION_STATUSES.includes to perform this step.
    ACTIVE_RESERVATION_STATUSES.includes(reservation.status) &&
    // Contribute this line to the enclosing declaration or statement.
    holdExpiresAt &&
    // Continue the surrounding logic with this statement.
    holdExpiresAt <= now
  );
}

/**
 * Complete domain finalization for a paid Stripe session (order + confirmed status).
 *
 * @param {object} params
 * @returns {Promise<object>} Result with finalized: true and order
 */
async function completeReservationFinalization({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Update stripePaymentIntent with the right-hand side value.
  stripePaymentIntent = null,
  // Update paidAmountCents with the right-hand side value.
  paidAmountCents = null,
  // Update paidCurrency with the right-hand side value.
  paidCurrency = null,
  // Contribute this line to the enclosing declaration or statement.
  logPrefix,
  // Contribute this line to the enclosing declaration or statement.
  client,
  // Update recoveryContext with the right-hand side value.
  recoveryContext = null,
// Continue the surrounding logic with this statement.
}) {
  // Create the resolved car id constant.
  const resolvedCarId = reservation.carId?.id || reservation.carId;
  // Create the payment intent id constant.
  const paymentIntentId =
    // Contribute this line to the enclosing declaration or statement.
    stripePaymentIntent || reservation.stripePaymentIntentId || null;

  // Destructure object properties into local variables.
  const { reservation: paidReservation } = await changeStatus({
    // Provide the reservation id field value.
    reservationId: reservation.id,
    // Provide the new status field value.
    newStatus: 'paid',
    // Provide the reason field value.
    reason: 'stripe_payment_received',
    // Provide the actor field value.
    actor: { type: 'system' },
    // Provide the patch field value.
    patch: {
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Clear hold TTL once payment is received.
      holdExpiresAt: new Date(),
      // Call ... to perform this step.
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      // Call ...paidAmountPatch to perform this step.
      ...paidAmountPatch(paidAmountCents, paidCurrency),
    },
    // Contribute this line to the enclosing declaration or statement.
    client,
  });

  // Block the car's calendar for the rental window (availability sync).
  await addRange(resolvedCarId, paidReservation.pickupDate, paidReservation.returnDate, client);

  // Create the order constant.
  const order = await orderSql.createOrderFromReservation(
    // Contribute this line to the enclosing declaration or statement.
    { ...paidReservation, stripeSessionId },
    // Contribute this line to the enclosing declaration or statement.
    resolvedCarId,
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Destructure object properties into local variables.
  const { reservation: updatedReservation } = await changeStatus({
    // Provide the reservation id field value.
    reservationId: paidReservation.id,
    // Provide the new status field value.
    newStatus: 'confirmed',
    // Provide the reason field value.
    reason: 'booking_finalized',
    // Provide the actor field value.
    actor: { type: 'system' },
    // Provide the metadata field value.
    metadata: { orderId: order.id, stripeSessionId },
    // Contribute this line to the enclosing declaration or statement.
    client,
  });

  // Evaluate the condition and enter the branch when it is true.
  if (recoveryContext) {
    // Call logger.warn to perform this step.
    logger.warn(
      {
        // Provide the car id field value.
        carId: String(resolvedCarId),
        // Provide the reservation id field value.
        reservationId: reservation.id.toString(),
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the hold expires at field value.
        holdExpiresAt: recoveryContext.holdExpiresAt,
        // Contribute this line to the enclosing declaration or statement.
        logPrefix,
      },
      // Supply the literal value used by the enclosing expression.
      'Finalized paid reservation after expired hold revalidation'
    );
  // Continue the surrounding logic with this statement.
  } else if (logPrefix) {
    // Call logger.info to perform this step.
    logger.info(
      {
        // Provide the car id field value.
        carId: String(resolvedCarId),
        // Provide the reservation id field value.
        reservationId: reservation.id.toString(),
        // Contribute this line to the enclosing declaration or statement.
        logPrefix,
      },
      // Supply the literal value used by the enclosing expression.
      'Reservation finalized successfully'
    );
  }

  // Wait until the asynchronous operation resolves.
  await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId, client);

  // Call logEvent.info to perform this step.
  logEvent.info('checkout.completed', {
    // Provide the reservation id field value.
    reservationId: reservation.id.toString(),
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Provide the order id field value.
    orderId: order.id,
  });
  // Call logEvent.info to perform this step.
  logEvent.info('reservation.confirmed', {
    // Provide the reservation id field value.
    reservationId: reservation.id.toString(),
    // Provide the order id field value.
    orderId: order.id,
    // Provide the car id field value.
    carId: String(resolvedCarId),
  });
  // Call metrics.incrementCheckoutCompleted to perform this step.
  metrics.incrementCheckoutCompleted();

  // Wait until the asynchronous operation resolves.
  await logSystemAction(
    {
      // Provide the action field value.
      action: 'system.confirmed_reservation_from_stripe',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: reservation.id,
      // Provide the metadata field value.
      metadata: {
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the order id field value.
        orderId: order.id,
        // Provide the car id field value.
        carId: String(resolvedCarId),
      },
    },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Emails must run after the surrounding DB transaction commits (notifications.order_id FK).
  return {
    // Provide the found field value.
    found: true,
    // Provide the finalized field value.
    finalized: true,
    // Provide the reservation field value.
    reservation: updatedReservation,
    // Contribute this line to the enclosing declaration or statement.
    order,
    // Provide the reason field value.
    reason: 'finalized',
    // Provide the car name field value.
    carName: reservation.carId?.name || null,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  isHoldExpired,
  // Contribute this line to the enclosing declaration or statement.
  completeReservationFinalization,
};
