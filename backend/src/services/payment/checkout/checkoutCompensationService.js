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
  // Contribute this line to the enclosing declaration or statement.
  reservationDoc,
  // Update createdReservationThisStep with the right-hand side value.
  createdReservationThisStep = true
// Continue the surrounding logic with this statement.
) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservationDoc) {
    // Return control to the caller with the following value.
    return;
  }

  // Only cancel holds created in this checkout step so retries keep an existing order hold.
  if (!createdReservationThisStep) {
    // Return control to the caller with the following value.
    return;
  }

  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await changeStatus({
      // Provide the reservation id field value.
      reservationId: reservationDoc.id,
      // Provide the new status field value.
      newStatus: 'cancelled',
      // Provide the reason field value.
      reason: 'stripe_checkout_failed',
      // Provide the actor field value.
      actor: { type: 'system' },
      // Expire the hold immediately so availability opens up.
      patch: { holdExpiresAt: new Date() },
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Race: status already changed or reservation gone — compensation is best-effort.
    if (err.code === 'INVALID_STATUS_TRANSITION' || err.code === 'NOT_FOUND') {
      // Return control to the caller with the following value.
      return;
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  compensateReservationAfterStripeFailure,
};
