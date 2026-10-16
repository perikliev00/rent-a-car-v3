/**
 * Drive Stripe refund API for a pending ledger operation: create or retrieve,
 * apply success, mark failure, or leave pending. Retries with a new attempt
 * only after Stripe confirms the previous refund failed/canceled.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { createRefund, retrieveRefund } = require('../stripeRefundService');
const { refundError } = require('./refundErrors');
const { logAdminAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const {
  parseAttemptFromIdempotencyKey,
  isIndeterminateStripeError,
} = require('./refundPolicy');
const {
  resolveUpdatedRefundOperation,
  markRefundFailed,
  resurrectPending,
} = require('./refundLedgerService');
const { applySucceededRefund } = require('./applyRefundService');
const { succeededResponse, lockAndCreateAttempt } = require('./refundAttemptLock');

/**
 * persist pending from stripe.
 * @param {*} op
 * @param {*} stripeRefund
 * @returns {Promise<*>}
 */
async function persistPendingFromStripe(op, stripeRefund) {
  const updated = await refundOpSql.updateRefundOperation(op.id, {
    stripeRefundId: stripeRefund.id,
    stripeRawStatus: stripeRefund.status || 'pending',
    status: 'pending',
    failureCode: null,
    failureMessage: null,
  });
  return resolveUpdatedRefundOperation(op, updated);
}

/**
 * audit succeeded refund.
 * @param {*} req
 * @param {object} { reservation
 * @param {*} applied
 * @param {*} stripeRefund
 * @param {number} amountCents }
 * @returns {Promise<*>}
 */
async function auditSucceededRefund(req, { reservation, applied, stripeRefund, amountCents }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!req) {
    return;
  }
  // Protected block: isolate failure modes.
  try {
    await logAdminAction(req, {
      action: 'admin.refunded_reservation',
      entityType: 'reservation',
      entityId: reservation.id,
      metadata: {
        refundOperationId: applied.refundOperation?.id,
        stripeRefundId: stripeRefund.id,
        amountCents,
      },
    });
  } catch (err) {
    logger.error({ err, context: 'requestReservationRefund.audit' }, 'Refund audit failed');
  }
}

/**
 * Map a Stripe refund object onto local ledger + domain (succeeded / failed / pending).
 */
async function finishWithStripeRefund(
  req,
  { op, reservation, stripeRefund, reason, requestedByUserId, amountCents }
) {
  // Status / lifecycle guard before mutating domain state.
  if (stripeRefund.status === 'succeeded') {
    const applied = await applySucceededRefund({
      refundOperation: op,
      reservationId: reservation.id,
      reason: reason || 'admin_stripe_refund',
      actor: {
        type: 'admin',
        req,
        userId: requestedByUserId,
      },
      stripeRefund,
    });
    await auditSucceededRefund(req, { reservation, applied, stripeRefund, amountCents });
    return applied;
  }

  // Status / lifecycle guard before mutating domain state.
  if (stripeRefund.status === 'failed' || stripeRefund.status === 'canceled') {
    await markRefundFailed(op, {
      code: stripeRefund.status,
      message: `Stripe refund ${stripeRefund.status}`,
    });
    throw refundError('REFUND_FAILED', `Stripe refund ${stripeRefund.status}.`);
  }

  const pendingOp = await persistPendingFromStripe(op, stripeRefund);
  // Status / lifecycle guard before mutating domain state.
  if (pendingOp.status === 'succeeded') {
    return applySucceededRefund({
      refundOperation: pendingOp,
      reservationId: reservation.id,
      reason: reason || 'admin_stripe_refund',
      actor: {
        type: 'admin',
        req,
        userId: requestedByUserId,
      },
      stripeRefund,
    });
  }

  return {
    status: 'pending',
    refundOperation: pendingOp,
    reservation: await reservationRepository.findById(reservation.id),
  };
}

/**
 * Call Stripe createRefund using the op's idempotency key.
 * Indeterminate errors leave the op usable for retry (do not mark failed).
 */
async function createRefundForOperation(op, { paymentIntentId, amountCents }) {
  // Protected block: isolate failure modes.
  try {
    return await createRefund({
      paymentIntentId,
      amountCents,
      idempotencyKey: op.idempotencyKey,
    });
  } catch (err) {
    // Stripe / payment-related branch.
    if (isIndeterminateStripeError(err)) {
      throw refundError(
        'REFUND_INDETERMINATE',
        err.message || 'Stripe refund result is indeterminate. Retry with the same operation.',
        503
      );
    }
    await markRefundFailed(op, err);
    throw refundError('REFUND_FAILED', err.message || 'Stripe refund failed.');
  }
}

/** After confirmed Stripe failure, open a new attempt with a bumped idempotency key. */
async function startNextAttemptAfterConfirmedFailure(failedOp, stripeCtx) {
  const nextAttempt = parseAttemptFromIdempotencyKey(failedOp.idempotencyKey) + 1;
  if (nextAttempt > 5) {
    throw refundError('REFUND_FAILED', 'Stripe refund failed after maximum attempts.');
  }

  const reserved = await lockAndCreateAttempt({
    reservationId: stripeCtx.reservation.id,
    paymentIntentId: stripeCtx.paymentIntentId,
    amountCents: stripeCtx.amountCents,
    currency: stripeCtx.currency,
    order: stripeCtx.order,
    reason: stripeCtx.reason,
    requestedByUserId: stripeCtx.requestedByUserId,
    attempt: nextAttempt,
  });

  if (reserved.done) {
    return succeededResponse(reserved);
  }

  return driveStripeForOperation(reserved.op, stripeCtx);
}

/**
 * Resume when the ledger already has a stripeRefundId (retrieve rather than create).
 */
async function retrieveExistingRefund(op, stripeCtx) {
  let existingRefund;
  // Protected block: isolate failure modes.
  try {
    existingRefund = await retrieveRefund(op.stripeRefundId);
  } catch (err) {
    if (err.code === 'REFUND_FAILED' || err.code === 'REFUND_INDETERMINATE') {
      throw err;
    }
    logger.warn(
      { err, refundId: op.stripeRefundId, reservationId: stripeCtx.reservation.id },
      'Failed to retrieve existing Stripe refund'
    );
    throw refundError(
      'REFUND_INDETERMINATE',
      err.message || 'Unable to determine Stripe refund status. Retry later.',
      503
    );
  }

  // Idempotency guard: return early when work was already applied.
  if (existingRefund.status === 'succeeded') {
    return applySucceededRefund({
      refundOperation: op,
      reservationId: stripeCtx.reservation.id,
      reason: stripeCtx.reason || 'stripe_refund_retrieved',
      actor: {
        type: 'admin',
        req: stripeCtx.req,
        userId: stripeCtx.requestedByUserId,
      },
      stripeRefund: existingRefund,
    });
  }

  // Idempotency guard: return early when work was already applied.
  if (existingRefund.status === 'failed' || existingRefund.status === 'canceled') {
    await markRefundFailed(op, {
      code: existingRefund.status,
      message: `Stripe refund ${existingRefund.status}`,
    });
    return startNextAttemptAfterConfirmedFailure(op, stripeCtx);
  }

  const pendingOp = await resurrectPending(op, {
    stripeRefundId: existingRefund.id,
    stripeRawStatus: existingRefund.status,
  });
  return {
    status: 'pending',
    refundOperation: pendingOp,
    reservation: await reservationRepository.findById(stripeCtx.reservation.id),
  };
}

/**
 * Entry for a locked pending op: retrieve if Stripe id known, else create.
 * @param {object} op - Refund operation ledger row
 * @param {object} stripeCtx - Reservation, PI, amount, actor context
 */
async function driveStripeForOperation(op, stripeCtx) {
  // Stripe / payment-related branch.
  if (op.stripeRefundId) {
    return retrieveExistingRefund(op, stripeCtx);
  }

  const stripeRefund = await createRefundForOperation(op, {
    paymentIntentId: stripeCtx.paymentIntentId,
    amountCents: stripeCtx.amountCents,
  });
  return finishWithStripeRefund(stripeCtx.req, {
    op,
    reservation: stripeCtx.reservation,
    stripeRefund,
    reason: stripeCtx.reason,
    requestedByUserId: stripeCtx.requestedByUserId,
    amountCents: stripeCtx.amountCents,
  });
}

module.exports = {
  driveStripeForOperation,
};
