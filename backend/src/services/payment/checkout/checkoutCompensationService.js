const { changeStatus } = require('../../reservation/reservationStatusService');

async function compensateReservationAfterStripeFailure(
  reservationDoc,
  createdReservationThisStep = true
) {
  if (!reservationDoc) {
    return;
  }

  // Only cancel holds created in this checkout step so retries keep an existing order hold.
  if (!createdReservationThisStep) {
    return;
  }

  try {
    await changeStatus({
      reservationId: reservationDoc.id,
      newStatus: 'cancelled',
      reason: 'stripe_checkout_failed',
      actor: { type: 'system' },
      patch: { holdExpiresAt: new Date() },
    });
  } catch (err) {
    if (err.code === 'INVALID_STATUS_TRANSITION' || err.code === 'NOT_FOUND') {
      return;
    }
    throw err;
  }
}

module.exports = {
  compensateReservationAfterStripeFailure,
};
