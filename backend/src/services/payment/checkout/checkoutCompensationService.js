/**
 * Compensating actions when Stripe Checkout session creation fails after a
 * new reservation hold was created in the same checkout step.
 * Avoids leaving orphan pending holds that block the car for other guests.
 */
const { changeStatus } = require('../../reservation/reservationStatusService');

/**
 * Cancel a reservation hold created in this checkout step after Stripe failure.
 * Does nothing if the hold already existed (retry of an in-progress checkout).
 *
 * @param {object|null|undefined} reservationDoc
 * @param {boolean} [createdReservationThisStep=true] - Only cancel holds created now
 * @returns {Promise<void>}
 */
async function compensateReservationAfterStripeFailure(
  reservationDoc,
  createdReservationThisStep = true
) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservationDoc) {
    return;
  }

  // Only cancel holds created in this checkout step so retries keep an existing order hold.
  if (!createdReservationThisStep) {
    return;
  }

  // Protected block: isolate failure modes.
  try {
    await changeStatus({
      reservationId: reservationDoc.id,
      newStatus: 'cancelled',
      reason: 'stripe_checkout_failed',
      actor: { type: 'system' },
      // Expire the hold immediately so availability opens up.
      patch: { holdExpiresAt: new Date() },
    });
  } catch (err) {
    // Race: status already changed or reservation gone — compensation is best-effort.
    if (err.code === 'INVALID_STATUS_TRANSITION' || err.code === 'NOT_FOUND') {
      return;
    }
    throw err;
  }
}

module.exports = {
  compensateReservationAfterStripeFailure,
};
