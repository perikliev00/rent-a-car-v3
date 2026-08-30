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

async function auditSucceededRefund(req, { reservation, applied, stripeRefund, amountCents }) {
  if (!req) {
    return;
  }
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

async function finishWithStripeRefund(
  req,
  { op, reservation, stripeRefund, reason, requestedByUserId, amountCents }
) {
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

  if (stripeRefund.status === 'failed' || stripeRefund.status === 'canceled') {
    await markRefundFailed(op, {
      code: stripeRefund.status,
      message: `Stripe refund ${stripeRefund.status}`,
    });
    throw refundError('REFUND_FAILED', `Stripe refund ${stripeRefund.status}.`);
  }

  const pendingOp = await persistPendingFromStripe(op, stripeRefund);
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

async function createRefundForOperation(op, { paymentIntentId, amountCents }) {
  try {
    return await createRefund({
      paymentIntentId,
      amountCents,
      idempotencyKey: op.idempotencyKey,
    });
  } catch (err) {
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

async function retrieveExistingRefund(op, stripeCtx) {
  let existingRefund;
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

async function driveStripeForOperation(op, stripeCtx) {
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
