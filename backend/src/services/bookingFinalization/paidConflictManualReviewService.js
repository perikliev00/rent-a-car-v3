/**
 * Route paid-but-unconfirmable reservations to manual_review.
 * Used when payment succeeded but dates overlap, session is stale, or amount mismatches.
 * Preserves Stripe ids and paid amount for ops/refund handling.
 */
const reservationRepository = require('../../repositories/reservationRepository');
const { changeStatus } = require('../reservation/reservationStatusService');
const logger = require('../../utils/logger');
const metrics = require('../../monitoring/metrics');
const { trackPaymentFailure } = require('../../monitoring/track');
const { logSystemAction } = require('../admin/adminAuditService');
const { paidAmountPatch } = require('../payment/stripeSessionValidation');

/**
 * Optional contact/time fields useful for admin triage of paid conflicts.
 * @param {object} context
 * @returns {string[]}
 */
function collectMissingPaidConflictFields(context) {
  const optionalFields = [
    'email',
    'fullName',
    'phoneNumber',
    'pickupTime',
    'returnTime',
    'stripePaymentIntent',
  ];
  return optionalFields.filter((field) => context[field] == null || context[field] === '');
}

/**
 * Move reservation to manual_review and emit audit/metrics for ops.
 *
 * @param {object} params
 * @returns {Promise<object>} Finalization-shaped result (finalized: false)
 */
async function markPaidReservationConflict({
  reservation,
  stripeSessionId,
  conflictReason,
  paidAmount,
  paidAmountCents = null,
  paidCurrency = null,
  stripePaymentIntent,
  logPrefix,
  client,
  resultReason = 'paid_conflict',
}) {
  const resolvedCarId = reservation.carId?.id || reservation.carId;

  const targetStatus =
    reservation.status === 'paid' || reservation.status === 'manual_review'
      ? 'manual_review'
      : 'manual_review';

  let updatedReservation = reservation;
  // Protected block: isolate failure modes.
  try {
    const result = await changeStatus({
      reservationId: reservation.id,
      newStatus: targetStatus,
      reason: conflictReason || 'overlap_after_payment',
      actor: { type: 'system' },
      patch: {
        // Keep the active linked session when a stale/superseded paid session conflicts.
        ...(!reservation.stripeSessionId ||
        String(reservation.stripeSessionId) === String(stripeSessionId)
          ? { stripeSessionId }
          : {}),
        ...(stripePaymentIntent
          ? { stripePaymentIntentId: stripePaymentIntent }
          : {}),
        ...paidAmountPatch(paidAmountCents, paidCurrency),
      },
      metadata: {
        conflictReason: conflictReason || 'overlap_after_payment',
        resultReason,
        conflictingStripeSessionId: stripeSessionId,
      },
      client,
    });
    updatedReservation = result.reservation;
  } catch (err) {
    // Status / lifecycle guard before mutating domain state.
    if (err.code !== 'INVALID_STATUS_TRANSITION') {
      throw err;
    }
    updatedReservation = await reservationRepository.findById(reservation.id, client);
  }

  const context = {
    reservationId: reservation.id?.toString?.(),
    stripeSessionId,
    stripePaymentIntent:
      stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
    carId: String(resolvedCarId),
    pickupDate: reservation.pickupDate,
    pickupTime: reservation.pickupTime ?? null,
    returnDate: reservation.returnDate,
    returnTime: reservation.returnTime ?? null,
    fullName: reservation.fullName ?? null,
    email: reservation.email ?? null,
    phoneNumber: reservation.phoneNumber ?? null,
    conflictReason: conflictReason || 'overlap_after_payment',
    paidAmount: paidAmount ?? reservation.totalPrice ?? null,
    logPrefix,
  };

  const missingFields = collectMissingPaidConflictFields(context);
  if (missingFields.length) {
    logger.warn(
      { ...context, missingFields },
      'Paid reservation conflict is missing optional admin metadata fields'
    );
  }

  logger.error(
    context,
    'Paid reservation requires manual review due to availability conflict'
  );

  const trackReason =
    resultReason === 'overlap_after_payment'
      ? 'overlap_after_payment'
      : 'paid_reservation_conflict';
  trackPaymentFailure(trackReason, context);
  metrics.incrementReservationConflict(context.conflictReason || trackReason);

  await logSystemAction(
    {
      action: 'system.paid_needs_manual_review',
      entityType: 'reservation',
      entityId: reservation.id,
      metadata: {
        stripeSessionId,
        carId: String(resolvedCarId),
        conflictReason: context.conflictReason,
        resultReason,
      },
    },
    client
  );

  return {
    found: true,
    finalized: false,
    reservation: updatedReservation,
    order: null,
    reason: resultReason,
    status: resultReason === 'overlap_after_payment' ? 'manual_review' : undefined,
  };
}

module.exports = {
  collectMissingPaidConflictFields,
  markPaidReservationConflict,
};
