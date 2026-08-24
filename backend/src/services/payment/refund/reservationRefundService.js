const reservationRepository = require('../../../repositories/reservationRepository');
const reservationSql = require('../../sql/reservationSqlService');
const orderSql = require('../../sql/orderSqlService');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { runWithTransaction } = require('../../../db/transaction');
const { createRefund, retrieveRefund } = require('../stripeRefundService');
const { resolvePaymentIntentForReservation } = require('./resolvePaymentIntent');
const { refundError } = require('./refundErrors');
const { logAdminAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  parseAttemptFromIdempotencyKey,
  isIndeterminateStripeError,
  assertRefundableStatus,
  requireSucceededLedgerForRefunded,
  amountCentsFromReservation,
} = require('./refundPolicy');
const {
  persistPaymentIntentIfNeeded,
  resolveUpdatedRefundOperation,
  markRefundFailed,
  resurrectPending,
  createPendingOperation,
} = require('./refundLedgerService');
const { applySucceededRefund } = require('./applyRefundService');
const { applyRefundFromStripeObject } = require('./refundWebhookService');
const { reconcilePendingRefunds } = require('./refundReconcileService');

function succeededResponse(reserved) {
  return {
    status: reserved.status,
    refundOperation: reserved.refundOperation,
    reservation: reserved.reservation,
    idempotent: reserved.idempotent,
  };
}

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

async function lockAndCreateAttempt({
  reservationId,
  paymentIntentId,
  amountCents,
  currency,
  order,
  reason,
  requestedByUserId,
  attempt,
}) {
  return runWithTransaction(async (tx) => {
    const locked = await reservationSql.findByIdForUpdate(reservationId, tx);
    if (!locked) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    if (locked.status === 'refunded') {
      const existing = await refundOpSql.findActiveByReservationId(locked.id, tx);
      requireSucceededLedgerForRefunded(locked, existing);
      return {
        done: true,
        status: 'succeeded',
        refundOperation: existing,
        reservation: locked,
        idempotent: true,
      };
    }

    assertRefundableStatus(locked.status);
    await persistPaymentIntentIfNeeded(locked, paymentIntentId, tx);

    const active = await refundOpSql.findActiveByReservationId(locked.id, tx);
    if (active?.status === 'succeeded') {
      return {
        done: true,
        status: 'succeeded',
        refundOperation: active,
        reservation: locked,
        idempotent: true,
      };
    }
    if (active) {
      return { done: false, reservation: locked, op: active };
    }

    const op = await createPendingOperation({
      reservation: locked,
      order,
      paymentIntentId,
      amountCents,
      currency,
      reason,
      requestedByUserId,
      attempt,
      client: tx,
    });
    return { done: false, reservation: locked, op };
  });
}

async function requestReservationRefund(req, { reservationId, reason = null }) {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) {
    throw refundError('NOT_FOUND', 'Reservation not found.', 404);
  }

  if (reservation.status === 'refunded') {
    const existing = await refundOpSql.findActiveByReservationId(reservation.id);
    requireSucceededLedgerForRefunded(reservation, existing);
    return {
      status: 'succeeded',
      refundOperation: existing,
      reservation,
      idempotent: true,
    };
  }

  const resolved = await resolvePaymentIntentForReservation(reservation);
  const paymentIntentId = resolved.paymentIntentId;
  const amountCents = amountCentsFromReservation(reservation, resolved);
  const currency = resolved.currency || 'eur';
  const order = await orderSql.findOrderByReservationId(reservation.id);
  const requestedByUserId = req?.session?.user?.id ?? null;
  const stripeCtx = {
    req,
    reservation,
    reason,
    requestedByUserId,
    amountCents,
    paymentIntentId,
    currency,
    order,
  };

  const reserved = await runWithTransaction(async (tx) => {
    const locked = await reservationSql.findByIdForUpdate(reservationId, tx);
    if (!locked) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    if (locked.status === 'refunded') {
      const existing = await refundOpSql.findActiveByReservationId(locked.id, tx);
      requireSucceededLedgerForRefunded(locked, existing);
      return {
        done: true,
        status: 'succeeded',
        refundOperation: existing,
        reservation: locked,
        idempotent: true,
      };
    }

    assertRefundableStatus(locked.status);
    await persistPaymentIntentIfNeeded(locked, paymentIntentId, tx);

    let op = await refundOpSql.findActiveByReservationId(locked.id, tx);
    if (op?.status === 'succeeded') {
      return {
        done: true,
        status: 'succeeded',
        refundOperation: op,
        reservation: locked,
        idempotent: true,
      };
    }

    if (!op) {
      const latest = await refundOpSql.findLatestByReservationId(locked.id, tx);
      if (!latest) {
        op = await createPendingOperation({
          reservation: locked,
          order,
          paymentIntentId,
          amountCents,
          currency,
          reason,
          requestedByUserId,
          attempt: 1,
          client: tx,
        });
      } else if (latest.status === 'failed' && latest.stripeRefundId) {
        op = latest;
      } else if (latest.status === 'failed') {
        const nextAttempt = parseAttemptFromIdempotencyKey(latest.idempotencyKey) + 1;
        if (nextAttempt > 5) {
          throw refundError('REFUND_FAILED', 'Stripe refund failed after maximum attempts.');
        }
        op = await createPendingOperation({
          reservation: locked,
          order,
          paymentIntentId,
          amountCents,
          currency,
          reason,
          requestedByUserId,
          attempt: nextAttempt,
          client: tx,
        });
      } else {
        op = await createPendingOperation({
          reservation: locked,
          order,
          paymentIntentId,
          amountCents,
          currency,
          reason,
          requestedByUserId,
          attempt: 1,
          client: tx,
        });
      }
    }

    return { done: false, reservation: locked, op };
  });

  if (reserved.done) {
    return succeededResponse(reserved);
  }

  return driveStripeForOperation(reserved.op, stripeCtx);
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
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  requestReservationRefund,
  applySucceededRefund,
  applyRefundFromStripeObject,
  reconcilePendingRefunds,
};
