/**
 * Route paid-but-unconfirmable reservations to manual_review.
 * Used when payment succeeded but dates overlap, session is stale, or amount mismatches.
 * Preserves Stripe ids and paid amount for ops/refund handling.
 */
const reservationRepository = require('../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { changeStatus } = require('../reservation/reservationStatusService');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');
// Destructure object properties into local variables.
const { trackPaymentFailure } = require('../../monitoring/track');
// Destructure object properties into local variables.
const { logSystemAction } = require('../admin/adminAuditService');
// Destructure object properties into local variables.
const { paidAmountPatch } = require('../payment/stripeSessionValidation');

/**
 * Optional contact/time fields useful for admin triage of paid conflicts.
 * @param {object} context
 * @returns {string[]}
 */
function collectMissingPaidConflictFields(context) {
  // Create the optional fields constant.
  const optionalFields = [
    // Supply the literal value used by the enclosing expression.
    'email',
    // Supply the literal value used by the enclosing expression.
    'fullName',
    // Supply the literal value used by the enclosing expression.
    'phoneNumber',
    // Supply the literal value used by the enclosing expression.
    'pickupTime',
    // Supply the literal value used by the enclosing expression.
    'returnTime',
    // Supply the literal value used by the enclosing expression.
    'stripePaymentIntent',
  ];
  // Return the resulting value to the caller.
  return optionalFields.filter((field) => context[field] == null || context[field] === '');
}

/**
 * Move reservation to manual_review and emit audit/metrics for ops.
 *
 * @param {object} params
 * @returns {Promise<object>} Finalization-shaped result (finalized: false)
 */
async function markPaidReservationConflict({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  conflictReason,
  // Contribute this line to the enclosing declaration or statement.
  paidAmount,
  // Update paidAmountCents with the right-hand side value.
  paidAmountCents = null,
  // Update paidCurrency with the right-hand side value.
  paidCurrency = null,
  // Contribute this line to the enclosing declaration or statement.
  stripePaymentIntent,
  // Contribute this line to the enclosing declaration or statement.
  logPrefix,
  // Contribute this line to the enclosing declaration or statement.
  client,
  // Update resultReason with the right-hand side value.
  resultReason = 'paid_conflict',
// Continue the surrounding logic with this statement.
}) {
  // Create the resolved car id constant.
  const resolvedCarId = reservation.carId?.id || reservation.carId;

  // Create the target status constant.
  const targetStatus =
    // Update reservation.status with the right-hand side value.
    reservation.status === 'paid' || reservation.status === 'manual_review'
      // Contribute this line to the enclosing declaration or statement.
      ? 'manual_review'
      // Contribute this line to the enclosing declaration or statement.
      : 'manual_review';

  // Initialize the mutable updated reservation variable.
  let updatedReservation = reservation;
  // Protected block: isolate failure modes.
  try {
    // Create the result constant.
    const result = await changeStatus({
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Provide the new status field value.
      newStatus: targetStatus,
      // Provide the reason field value.
      reason: conflictReason || 'overlap_after_payment',
      // Provide the actor field value.
      actor: { type: 'system' },
      // Provide the patch field value.
      patch: {
        // Keep the active linked session when a stale/superseded paid session conflicts.
        ...(!reservation.stripeSessionId ||
        // Call String to perform this step.
        String(reservation.stripeSessionId) === String(stripeSessionId)
          // Contribute this line to the enclosing declaration or statement.
          ? { stripeSessionId }
          // Continue the surrounding logic with this statement.
          : {}),
        // Call ... to perform this step.
        ...(stripePaymentIntent
          // Contribute this line to the enclosing declaration or statement.
          ? { stripePaymentIntentId: stripePaymentIntent }
          // Continue the surrounding logic with this statement.
          : {}),
        // Call ...paidAmountPatch to perform this step.
        ...paidAmountPatch(paidAmountCents, paidCurrency),
      },
      // Provide the metadata field value.
      metadata: {
        // Provide the conflict reason field value.
        conflictReason: conflictReason || 'overlap_after_payment',
        // Contribute this line to the enclosing declaration or statement.
        resultReason,
        // Provide the conflicting stripe session id field value.
        conflictingStripeSessionId: stripeSessionId,
      },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
    // Update updatedReservation with the right-hand side value.
    updatedReservation = result.reservation;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Status / lifecycle guard before mutating domain state.
    if (err.code !== 'INVALID_STATUS_TRANSITION') {
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Store the awaited result in updatedReservation.
    updatedReservation = await reservationRepository.findById(reservation.id, client);
  }

  // Create the context constant.
  const context = {
    // Provide the reservation id field value.
    reservationId: reservation.id?.toString?.(),
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Provide the stripe payment intent field value.
    stripePaymentIntent:
      // Contribute this line to the enclosing declaration or statement.
      stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
    // Provide the car id field value.
    carId: String(resolvedCarId),
    // Provide the pickup date field value.
    pickupDate: reservation.pickupDate,
    // Provide the pickup time field value.
    pickupTime: reservation.pickupTime ?? null,
    // Provide the return date field value.
    returnDate: reservation.returnDate,
    // Provide the return time field value.
    returnTime: reservation.returnTime ?? null,
    // Provide the full name field value.
    fullName: reservation.fullName ?? null,
    // Provide the email field value.
    email: reservation.email ?? null,
    // Provide the phone number field value.
    phoneNumber: reservation.phoneNumber ?? null,
    // Provide the conflict reason field value.
    conflictReason: conflictReason || 'overlap_after_payment',
    // Provide the paid amount field value.
    paidAmount: paidAmount ?? reservation.totalPrice ?? null,
    // Contribute this line to the enclosing declaration or statement.
    logPrefix,
  };

  // Create the missing fields constant.
  const missingFields = collectMissingPaidConflictFields(context);
  // Evaluate the condition and enter the branch when it is true.
  if (missingFields.length) {
    // Call logger.warn to perform this step.
    logger.warn(
      // Contribute this line to the enclosing declaration or statement.
      { ...context, missingFields },
      // Supply the literal value used by the enclosing expression.
      'Paid reservation conflict is missing optional admin metadata fields'
    );
  }

  // Call logger.error to perform this step.
  logger.error(
    // Contribute this line to the enclosing declaration or statement.
    context,
    // Supply the literal value used by the enclosing expression.
    'Paid reservation requires manual review due to availability conflict'
  );

  // Create the track reason constant.
  const trackReason =
    // Update resultReason with the right-hand side value.
    resultReason === 'overlap_after_payment'
      // Contribute this line to the enclosing declaration or statement.
      ? 'overlap_after_payment'
      // Contribute this line to the enclosing declaration or statement.
      : 'paid_reservation_conflict';
  // Call trackPaymentFailure to perform this step.
  trackPaymentFailure(trackReason, context);
  // Call metrics.incrementReservationConflict to perform this step.
  metrics.incrementReservationConflict(context.conflictReason || trackReason);

  // Wait until the asynchronous operation resolves.
  await logSystemAction(
    {
      // Provide the action field value.
      action: 'system.paid_needs_manual_review',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: reservation.id,
      // Provide the metadata field value.
      metadata: {
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the car id field value.
        carId: String(resolvedCarId),
        // Provide the conflict reason field value.
        conflictReason: context.conflictReason,
        // Contribute this line to the enclosing declaration or statement.
        resultReason,
      },
    },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Return the resulting value to the caller.
  return {
    // Provide the found field value.
    found: true,
    // Provide the finalized field value.
    finalized: false,
    // Provide the reservation field value.
    reservation: updatedReservation,
    // Provide the order field value.
    order: null,
    // Provide the reason field value.
    reason: resultReason,
    // Provide the status field value.
    status: resultReason === 'overlap_after_payment' ? 'manual_review' : undefined,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  collectMissingPaidConflictFields,
  // Contribute this line to the enclosing declaration or statement.
  markPaidReservationConflict,
};
