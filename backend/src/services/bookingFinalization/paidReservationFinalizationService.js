const orderSql = require('../sql/orderSqlService');
const paymentFailureSql = require('../sql/paymentFailureSqlService');
const { addRange } = require('../sql/bookingSyncSqlService');
const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');
const { changeStatus } = require('../reservation/reservationStatusService');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');
const { logSystemAction } = require('../admin/adminAuditService');
const { paidAmountPatch } = require('../payment/stripeSessionValidation');

function isHoldExpired(reservation, now = new Date()) {
  const holdExpiresAt = reservation.holdExpiresAt ? new Date(reservation.holdExpiresAt) : null;
  return (
    ACTIVE_RESERVATION_STATUSES.includes(reservation.status) &&
    holdExpiresAt &&
    holdExpiresAt <= now
  );
}

async function completeReservationFinalization({
  reservation,
  stripeSessionId,
  stripePaymentIntent = null,
  paidAmountCents = null,
  paidCurrency = null,
  logPrefix,
  client,
  recoveryContext = null,
}) {
  const resolvedCarId = reservation.carId?.id || reservation.carId;
  const paymentIntentId =
    stripePaymentIntent || reservation.stripePaymentIntentId || null;

  const { reservation: paidReservation } = await changeStatus({
    reservationId: reservation.id,
    newStatus: 'paid',
    reason: 'stripe_payment_received',
    actor: { type: 'system' },
    patch: {
      stripeSessionId,
      holdExpiresAt: new Date(),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      ...paidAmountPatch(paidAmountCents, paidCurrency),
    },
    client,
  });

  await addRange(resolvedCarId, paidReservation.pickupDate, paidReservation.returnDate, client);

  const order = await orderSql.createOrderFromReservation(
    { ...paidReservation, stripeSessionId },
    resolvedCarId,
    client
  );

  const { reservation: updatedReservation } = await changeStatus({
    reservationId: paidReservation.id,
    newStatus: 'confirmed',
    reason: 'booking_finalized',
    actor: { type: 'system' },
    metadata: { orderId: order.id, stripeSessionId },
    client,
  });

  if (recoveryContext) {
    logger.warn(
      {
        carId: String(resolvedCarId),
        reservationId: reservation.id.toString(),
        stripeSessionId,
        holdExpiresAt: recoveryContext.holdExpiresAt,
        logPrefix,
      },
      'Finalized paid reservation after expired hold revalidation'
    );
  } else if (logPrefix) {
    logger.info(
      {
        carId: String(resolvedCarId),
        reservationId: reservation.id.toString(),
        logPrefix,
      },
      'Reservation finalized successfully'
    );
  }

  await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId, client);

  logEvent.info('checkout.completed', {
    reservationId: reservation.id.toString(),
    stripeSessionId,
    orderId: order.id,
  });
  logEvent.info('reservation.confirmed', {
    reservationId: reservation.id.toString(),
    orderId: order.id,
    carId: String(resolvedCarId),
  });
  metrics.incrementCheckoutCompleted();

  await logSystemAction(
    {
      action: 'system.confirmed_reservation_from_stripe',
      entityType: 'reservation',
      entityId: reservation.id,
      metadata: {
        stripeSessionId,
        orderId: order.id,
        carId: String(resolvedCarId),
      },
    },
    client
  );

  // Emails must run after the surrounding DB transaction commits (notifications.order_id FK).
  return {
    found: true,
    finalized: true,
    reservation: updatedReservation,
    order,
    reason: 'finalized',
    carName: reservation.carId?.name || null,
  };
}

module.exports = {
  isHoldExpired,
  completeReservationFinalization,
};
