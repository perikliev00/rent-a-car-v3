/**
 * Background reconcile for stuck refund webhook inbox rows and pending/failed
 * refund operations. Polls Stripe for truth when webhooks were missed or
 * HTTP responses timed out after Stripe recorded the refund.
 */
const refundOpSql = require('../../sql/refundOperationSqlService');
// Require the '../../sql/paymentEventSqlService' module as paymentEventSql.
const paymentEventSql = require('../../sql/paymentEventSqlService');
// Destructure object properties into local variables.
const { retrieveRefund } = require('../stripeRefundService');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('./applyRefundService');
// Destructure object properties into local variables.
const { markRefundFailed, resurrectPending } = require('./refundLedgerService');
// Destructure object properties into local variables.
const { applyRefundFromStripeObject } = require('./refundWebhookService');
// Require the '../../../utils/logger' module as logger.
const logger = require('../../../utils/logger');

/** Inbox outcomes that are safe to mark ignored (not retried forever). */
const IGNORE_REASONS = new Set(['no_matching_operation', 'partial_or_amount_mismatch']);

/**
 * inbox payload object.
 * @param {object} row
 * @returns {*}
 */
function inboxPayloadObject(row) {
  // Create the payload constant.
  const payload = row.payload;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!payload || typeof payload !== 'object') {
    // Return the resulting value to the caller.
    return { object: null, eventType: row.event_type };
  }
  // Return the resulting value to the caller.
  return {
    // Provide the object field value.
    object: payload.data?.object || null,
    // Provide the event type field value.
    eventType: payload.type || row.event_type,
  };
}

/**
 * Replay refund webhook events stuck in received status.
 * @param {{ dryRun?: boolean, olderThanMinutes?: number, limit?: number }} [options]
 */
async function reconcileStuckRefundInbox({ dryRun = false, olderThanMinutes = 5, limit = 50 } = {}) {
  // Create the stuck constant.
  const stuck = await paymentEventSql.listStuckReceivedRefundEvents({
    // Contribute this line to the enclosing declaration or statement.
    olderThanMinutes,
    // Contribute this line to the enclosing declaration or statement.
    limit,
  });
  // Create the results constant.
  const results = [];

  // Iterate using the loop initializer, condition, and step.
  for (const row of stuck) {
    // Create the summary constant.
    const summary = {
      // Provide the payment event id field value.
      paymentEventId: row.id,
      // Provide the event id field value.
      eventId: row.event_id,
      // Provide the event type field value.
      eventType: row.event_type,
      // Provide the action field value.
      action: 'skipped',
      // Provide the reason field value.
      reason: null,
    };

    // Destructure object properties into local variables.
    const { object, eventType } = inboxPayloadObject(row);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!object) {
      // Update summary.reason with the right-hand side value.
      summary.reason = 'missing_payload_object';
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (dryRun) {
      // Update summary.action with the right-hand side value.
      summary.action = 'would_replay';
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Protected block: isolate failure modes.
    try {
      // Create the result constant.
      const result = await applyRefundFromStripeObject(object, { eventType });
      // Create the next status constant.
      const nextStatus =
        // Continue the surrounding logic with this statement.
        result?.handled === false && IGNORE_REASONS.has(result.reason) ? 'ignored' : 'processed';
      // Wait until the asynchronous operation resolves.
      await paymentEventSql.updatePaymentEventStatus(row.id, nextStatus);
      // Update summary.action with the right-hand side value.
      summary.action = nextStatus === 'ignored' ? 'ignored' : 'processed';
      // Update summary.reason with the right-hand side value.
      summary.reason = result?.reason || result?.status || null;
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Leave as received so the next reconcile pass retries.
      logger.error(
        // Contribute this line to the enclosing declaration or statement.
        { err, eventId: row.event_id, paymentEventId: row.id },
        // Supply the literal value used by the enclosing expression.
        'Refund inbox reconcile apply failed; leaving received'
      );
      // Update summary.reason with the right-hand side value.
      summary.reason = `apply_failed:${err.message}`;
    }

    // Call results.push to perform this step.
    results.push(summary);
  }

  // Return the resulting value to the caller.
  return {
    // Provide the dry run field value.
    dryRun: !!dryRun,
    // Provide the processed field value.
    processed: stuck.length,
    // Contribute this line to the enclosing declaration or statement.
    results,
  };
}

/**
 * Sync pending/failed ledger rows with Stripe refund status, then drain stuck inbox.
 * @param {{ dryRun?: boolean, olderThanMinutes?: number, limit?: number }} [options]
 */
async function reconcilePendingRefunds({ dryRun = false, olderThanMinutes = 5, limit = 50 } = {}) {
  // Create the pending constant.
  const pending = await refundOpSql.findPendingOlderThan({ olderThanMinutes, limit });
  // Create the results constant.
  const results = [];

  // Iterate using the loop initializer, condition, and step.
  for (const op of pending) {
    // Create the summary constant.
    const summary = {
      // Provide the refund operation id field value.
      refundOperationId: op.id,
      // Provide the reservation id field value.
      reservationId: op.reservationId,
      // Provide the action field value.
      action: 'skipped',
      // Provide the reason field value.
      reason: null,
    };

    // Stripe / payment-related branch.
    if (!op.stripeRefundId) {
      // Update summary.reason with the right-hand side value.
      summary.reason = 'missing_stripe_refund_id';
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Reserve the refund variable for later assignment.
    let refund;
    // Protected block: isolate failure modes.
    try {
      // Store the awaited result in refund.
      refund = await retrieveRefund(op.stripeRefundId);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Update summary.reason with the right-hand side value.
      summary.reason = `retrieve_failed:${err.message}`;
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (dryRun) {
      // Update summary.action with the right-hand side value.
      summary.action = `would_apply_${refund.status}`;
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Status / lifecycle guard before mutating domain state.
    if (refund.status === 'succeeded') {
      // Wait until the asynchronous operation resolves.
      await applySucceededRefund({
        // Provide the refund operation field value.
        refundOperation: op,
        // Provide the reservation id field value.
        reservationId: op.reservationId,
        // Provide the reason field value.
        reason: 'refund_reconcile',
        // Provide the actor field value.
        actor: { type: 'system' },
        // Provide the stripe refund field value.
        stripeRefund: refund,
      });
      // Update summary.action with the right-hand side value.
      summary.action = 'applied_succeeded';
    // Continue the surrounding logic with this statement.
    } else if (refund.status === 'failed' || refund.status === 'canceled') {
      // Wait until the asynchronous operation resolves.
      await markRefundFailed(op, {
        // Provide the code field value.
        code: refund.status,
        // Provide the message field value.
        message: `Stripe refund ${refund.status}`,
      });
      // Update summary.action with the right-hand side value.
      summary.action = 'marked_failed';
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update summary.action with the right-hand side value.
      summary.action = 'still_pending';
      // Update summary.reason with the right-hand side value.
      summary.reason = refund.status;
    }
    // Call results.push to perform this step.
    results.push(summary);
  }

  // Failed locally but Stripe may still show success/pending (timeout-after-record).
  const failedWithId = await refundOpSql.findFailedWithRefundIdOlderThan({
    // Contribute this line to the enclosing declaration or statement.
    olderThanMinutes,
    // Contribute this line to the enclosing declaration or statement.
    limit,
  });

  // Iterate using the loop initializer, condition, and step.
  for (const op of failedWithId) {
    // Create the summary constant.
    const summary = {
      // Provide the refund operation id field value.
      refundOperationId: op.id,
      // Provide the reservation id field value.
      reservationId: op.reservationId,
      // Provide the action field value.
      action: 'skipped',
      // Provide the reason field value.
      reason: null,
    };

    // Reserve the refund variable for later assignment.
    let refund;
    // Protected block: isolate failure modes.
    try {
      // Store the awaited result in refund.
      refund = await retrieveRefund(op.stripeRefundId);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Update summary.reason with the right-hand side value.
      summary.reason = `retrieve_failed:${err.message}`;
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (dryRun) {
      // Update summary.action with the right-hand side value.
      summary.action = `would_apply_${refund.status}`;
      // Call results.push to perform this step.
      results.push(summary);
      // Continue with the next loop iteration.
      continue;
    }

    // Status / lifecycle guard before mutating domain state.
    if (refund.status === 'succeeded') {
      // Wait until the asynchronous operation resolves.
      await applySucceededRefund({
        // Provide the refund operation field value.
        refundOperation: op,
        // Provide the reservation id field value.
        reservationId: op.reservationId,
        // Provide the reason field value.
        reason: 'refund_reconcile',
        // Provide the actor field value.
        actor: { type: 'system' },
        // Provide the stripe refund field value.
        stripeRefund: refund,
      });
      // Update summary.action with the right-hand side value.
      summary.action = 'applied_succeeded';
    // Continue the surrounding logic with this statement.
    } else if (refund.status === 'pending' || refund.status === 'requires_action') {
      // Wait until the asynchronous operation resolves.
      await resurrectPending(op, {
        // Provide the stripe refund id field value.
        stripeRefundId: refund.id,
        // Provide the stripe raw status field value.
        stripeRawStatus: refund.status,
      });
      // Update summary.action with the right-hand side value.
      summary.action = 'resurrected_pending';
      // Update summary.reason with the right-hand side value.
      summary.reason = refund.status;
    // Continue the surrounding logic with this statement.
    } else if (refund.status === 'failed' || refund.status === 'canceled') {
      // Update summary.action with the right-hand side value.
      summary.action = 'left_failed';
      // Update summary.reason with the right-hand side value.
      summary.reason = refund.status;
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update summary.action with the right-hand side value.
      summary.action = 'left_failed';
      // Update summary.reason with the right-hand side value.
      summary.reason = refund.status;
    }
    // Call results.push to perform this step.
    results.push(summary);
  }

  // Create the inbox constant.
  const inbox = await reconcileStuckRefundInbox({ dryRun, olderThanMinutes, limit });

  // Return the resulting value to the caller.
  return {
    // Provide the dry run field value.
    dryRun: !!dryRun,
    // Provide the processed field value.
    processed: pending.length + failedWithId.length,
    // Contribute this line to the enclosing declaration or statement.
    results,
    // Contribute this line to the enclosing declaration or statement.
    inbox,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  reconcilePendingRefunds,
  // Contribute this line to the enclosing declaration or statement.
  reconcileStuckRefundInbox,
};
