/**
 * Drive Stripe refund API for a pending ledger operation: create or retrieve,
 * apply success, mark failure, or leave pending. Retries with a new attempt
 * only after Stripe confirms the previous refund failed/canceled.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
// Require the '../../sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { createRefund, retrieveRefund } = require('../stripeRefundService');
// Destructure object properties into local variables.
const { refundError } = require('./refundErrors');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../admin/adminAuditService');
// Require the '../../../utils/logger' module as logger.
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseAttemptFromIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  isIndeterminateStripeError,
// Continue the surrounding logic with this statement.
} = require('./refundPolicy');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  resolveUpdatedRefundOperation,
  // Contribute this line to the enclosing declaration or statement.
  markRefundFailed,
  // Contribute this line to the enclosing declaration or statement.
  resurrectPending,
// Continue the surrounding logic with this statement.
} = require('./refundLedgerService');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('./applyRefundService');
// Destructure object properties into local variables.
const { succeededResponse, lockAndCreateAttempt } = require('./refundAttemptLock');

/**
 * persist pending from stripe.
 * @param {*} op
 * @param {*} stripeRefund
 * @returns {Promise<*>}
 */
async function persistPendingFromStripe(op, stripeRefund) {
  // Create the updated constant.
  const updated = await refundOpSql.updateRefundOperation(op.id, {
    // Provide the stripe refund id field value.
    stripeRefundId: stripeRefund.id,
    // Provide the stripe raw status field value.
    stripeRawStatus: stripeRefund.status || 'pending',
    // Provide the status field value.
    status: 'pending',
    // Provide the failure code field value.
    failureCode: null,
    // Provide the failure message field value.
    failureMessage: null,
  });
  // Return the resulting value to the caller.
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
    // Return control to the caller with the following value.
    return;
  }
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.refunded_reservation',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: reservation.id,
      // Provide the metadata field value.
      metadata: {
        // Provide the refund operation id field value.
        refundOperationId: applied.refundOperation?.id,
        // Provide the stripe refund id field value.
        stripeRefundId: stripeRefund.id,
        // Contribute this line to the enclosing declaration or statement.
        amountCents,
      },
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'requestReservationRefund.audit' }, 'Refund audit failed');
  }
}

/**
 * Map a Stripe refund object onto local ledger + domain (succeeded / failed / pending).
 */
async function finishWithStripeRefund(
  // Contribute this line to the enclosing declaration or statement.
  req,
  // Contribute this line to the enclosing declaration or statement.
  { op, reservation, stripeRefund, reason, requestedByUserId, amountCents }
// Continue the surrounding logic with this statement.
) {
  // Status / lifecycle guard before mutating domain state.
  if (stripeRefund.status === 'succeeded') {
    // Create the applied constant.
    const applied = await applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: op,
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Provide the reason field value.
      reason: reason || 'admin_stripe_refund',
      // Provide the actor field value.
      actor: {
        // Provide the type field value.
        type: 'admin',
        // Contribute this line to the enclosing declaration or statement.
        req,
        // Provide the user id field value.
        userId: requestedByUserId,
      },
      // Contribute this line to the enclosing declaration or statement.
      stripeRefund,
    });
    // Wait until the asynchronous operation resolves.
    await auditSucceededRefund(req, { reservation, applied, stripeRefund, amountCents });
    // Return the resulting value to the caller.
    return applied;
  }

  // Status / lifecycle guard before mutating domain state.
  if (stripeRefund.status === 'failed' || stripeRefund.status === 'canceled') {
    // Wait until the asynchronous operation resolves.
    await markRefundFailed(op, {
      // Provide the code field value.
      code: stripeRefund.status,
      // Provide the message field value.
      message: `Stripe refund ${stripeRefund.status}`,
    });
    // Throw an error to stop the current control flow.
    throw refundError('REFUND_FAILED', `Stripe refund ${stripeRefund.status}.`);
  }

  // Create the pending op constant.
  const pendingOp = await persistPendingFromStripe(op, stripeRefund);
  // Status / lifecycle guard before mutating domain state.
  if (pendingOp.status === 'succeeded') {
    // Return the resulting value to the caller.
    return applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: pendingOp,
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Provide the reason field value.
      reason: reason || 'admin_stripe_refund',
      // Provide the actor field value.
      actor: {
        // Provide the type field value.
        type: 'admin',
        // Contribute this line to the enclosing declaration or statement.
        req,
        // Provide the user id field value.
        userId: requestedByUserId,
      },
      // Contribute this line to the enclosing declaration or statement.
      stripeRefund,
    });
  }

  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: 'pending',
    // Provide the refund operation field value.
    refundOperation: pendingOp,
    // Provide the reservation field value.
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
    // Return the resulting value to the caller.
    return await createRefund({
      // Contribute this line to the enclosing declaration or statement.
      paymentIntentId,
      // Contribute this line to the enclosing declaration or statement.
      amountCents,
      // Provide the idempotency key field value.
      idempotencyKey: op.idempotencyKey,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Stripe / payment-related branch.
    if (isIndeterminateStripeError(err)) {
      // Throw an error to stop the current control flow.
      throw refundError(
        // Supply the literal value used by the enclosing expression.
        'REFUND_INDETERMINATE',
        // Contribute this line to the enclosing declaration or statement.
        err.message || 'Stripe refund result is indeterminate. Retry with the same operation.',
        // Supply the literal value used by the enclosing expression.
        503
      );
    }
    // Wait until the asynchronous operation resolves.
    await markRefundFailed(op, err);
    // Throw an error to stop the current control flow.
    throw refundError('REFUND_FAILED', err.message || 'Stripe refund failed.');
  }
}

/** After confirmed Stripe failure, open a new attempt with a bumped idempotency key. */
async function startNextAttemptAfterConfirmedFailure(failedOp, stripeCtx) {
  // Create the next attempt constant.
  const nextAttempt = parseAttemptFromIdempotencyKey(failedOp.idempotencyKey) + 1;
  // Evaluate the condition and enter the branch when it is true.
  if (nextAttempt > 5) {
    // Throw an error to stop the current control flow.
    throw refundError('REFUND_FAILED', 'Stripe refund failed after maximum attempts.');
  }

  // Create the reserved constant.
  const reserved = await lockAndCreateAttempt({
    // Provide the reservation id field value.
    reservationId: stripeCtx.reservation.id,
    // Provide the payment intent id field value.
    paymentIntentId: stripeCtx.paymentIntentId,
    // Provide the amount cents field value.
    amountCents: stripeCtx.amountCents,
    // Provide the currency field value.
    currency: stripeCtx.currency,
    // Provide the order field value.
    order: stripeCtx.order,
    // Provide the reason field value.
    reason: stripeCtx.reason,
    // Provide the requested by user id field value.
    requestedByUserId: stripeCtx.requestedByUserId,
    // Provide the attempt field value.
    attempt: nextAttempt,
  });

  // Evaluate the condition and enter the branch when it is true.
  if (reserved.done) {
    // Return the resulting value to the caller.
    return succeededResponse(reserved);
  }

  // Return the resulting value to the caller.
  return driveStripeForOperation(reserved.op, stripeCtx);
}

/**
 * Resume when the ledger already has a stripeRefundId (retrieve rather than create).
 */
async function retrieveExistingRefund(op, stripeCtx) {
  // Reserve the existing refund variable for later assignment.
  let existingRefund;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in existingRefund.
    existingRefund = await retrieveRefund(op.stripeRefundId);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_FAILED' || err.code === 'REFUND_INDETERMINATE') {
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Call logger.warn to perform this step.
    logger.warn(
      // Contribute this line to the enclosing declaration or statement.
      { err, refundId: op.stripeRefundId, reservationId: stripeCtx.reservation.id },
      // Supply the literal value used by the enclosing expression.
      'Failed to retrieve existing Stripe refund'
    );
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_INDETERMINATE',
      // Contribute this line to the enclosing declaration or statement.
      err.message || 'Unable to determine Stripe refund status. Retry later.',
      // Supply the literal value used by the enclosing expression.
      503
    );
  }

  // Idempotency guard: return early when work was already applied.
  if (existingRefund.status === 'succeeded') {
    // Return the resulting value to the caller.
    return applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: op,
      // Provide the reservation id field value.
      reservationId: stripeCtx.reservation.id,
      // Provide the reason field value.
      reason: stripeCtx.reason || 'stripe_refund_retrieved',
      // Provide the actor field value.
      actor: {
        // Provide the type field value.
        type: 'admin',
        // Provide the req field value.
        req: stripeCtx.req,
        // Provide the user id field value.
        userId: stripeCtx.requestedByUserId,
      },
      // Provide the stripe refund field value.
      stripeRefund: existingRefund,
    });
  }

  // Idempotency guard: return early when work was already applied.
  if (existingRefund.status === 'failed' || existingRefund.status === 'canceled') {
    // Wait until the asynchronous operation resolves.
    await markRefundFailed(op, {
      // Provide the code field value.
      code: existingRefund.status,
      // Provide the message field value.
      message: `Stripe refund ${existingRefund.status}`,
    });
    // Return the resulting value to the caller.
    return startNextAttemptAfterConfirmedFailure(op, stripeCtx);
  }

  // Create the pending op constant.
  const pendingOp = await resurrectPending(op, {
    // Provide the stripe refund id field value.
    stripeRefundId: existingRefund.id,
    // Provide the stripe raw status field value.
    stripeRawStatus: existingRefund.status,
  });
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: 'pending',
    // Provide the refund operation field value.
    refundOperation: pendingOp,
    // Provide the reservation field value.
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
    // Return the resulting value to the caller.
    return retrieveExistingRefund(op, stripeCtx);
  }

  // Create the stripe refund constant.
  const stripeRefund = await createRefundForOperation(op, {
    // Provide the payment intent id field value.
    paymentIntentId: stripeCtx.paymentIntentId,
    // Provide the amount cents field value.
    amountCents: stripeCtx.amountCents,
  });
  // Return the resulting value to the caller.
  return finishWithStripeRefund(stripeCtx.req, {
    // Contribute this line to the enclosing declaration or statement.
    op,
    // Provide the reservation field value.
    reservation: stripeCtx.reservation,
    // Contribute this line to the enclosing declaration or statement.
    stripeRefund,
    // Provide the reason field value.
    reason: stripeCtx.reason,
    // Provide the requested by user id field value.
    requestedByUserId: stripeCtx.requestedByUserId,
    // Provide the amount cents field value.
    amountCents: stripeCtx.amountCents,
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  driveStripeForOperation,
};
