const refundOpSql = require('../../sql/refundOperationSqlService');
const paymentEventSql = require('../../sql/paymentEventSqlService');
const { retrieveRefund } = require('../stripeRefundService');
const { applySucceededRefund } = require('./applyRefundService');
const { markRefundFailed, resurrectPending } = require('./refundLedgerService');
const { applyRefundFromStripeObject } = require('./refundWebhookService');
const logger = require('../../../utils/logger');

const IGNORE_REASONS = new Set(['no_matching_operation', 'partial_or_amount_mismatch']);

function inboxPayloadObject(row) {
  const payload = row.payload;
  if (!payload || typeof payload !== 'object') {
    return { object: null, eventType: row.event_type };
  }
  return {
    object: payload.data?.object || null,
    eventType: payload.type || row.event_type,
  };
}

async function reconcileStuckRefundInbox({ dryRun = false, olderThanMinutes = 5, limit = 50 } = {}) {
  const stuck = await paymentEventSql.listStuckReceivedRefundEvents({
    olderThanMinutes,
    limit,
  });
  const results = [];

  for (const row of stuck) {
    const summary = {
      paymentEventId: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      action: 'skipped',
      reason: null,
    };

    const { object, eventType } = inboxPayloadObject(row);
    if (!object) {
      summary.reason = 'missing_payload_object';
      results.push(summary);
      continue;
    }

    if (dryRun) {
      summary.action = 'would_replay';
      results.push(summary);
      continue;
    }

    try {
      const result = await applyRefundFromStripeObject(object, { eventType });
      const nextStatus =
        result?.handled === false && IGNORE_REASONS.has(result.reason) ? 'ignored' : 'processed';
      await paymentEventSql.updatePaymentEventStatus(row.id, nextStatus);
      summary.action = nextStatus === 'ignored' ? 'ignored' : 'processed';
      summary.reason = result?.reason || result?.status || null;
    } catch (err) {
      logger.error(
        { err, eventId: row.event_id, paymentEventId: row.id },
        'Refund inbox reconcile apply failed; leaving received'
      );
      summary.reason = `apply_failed:${err.message}`;
    }

    results.push(summary);
  }

  return {
    dryRun: !!dryRun,
    processed: stuck.length,
    results,
  };
}

async function reconcilePendingRefunds({ dryRun = false, olderThanMinutes = 5, limit = 50 } = {}) {
  const pending = await refundOpSql.findPendingOlderThan({ olderThanMinutes, limit });
  const results = [];

  for (const op of pending) {
    const summary = {
      refundOperationId: op.id,
      reservationId: op.reservationId,
      action: 'skipped',
      reason: null,
    };

    if (!op.stripeRefundId) {
      summary.reason = 'missing_stripe_refund_id';
      results.push(summary);
      continue;
    }

    let refund;
    try {
      refund = await retrieveRefund(op.stripeRefundId);
    } catch (err) {
      summary.reason = `retrieve_failed:${err.message}`;
      results.push(summary);
      continue;
    }

    if (dryRun) {
      summary.action = `would_apply_${refund.status}`;
      results.push(summary);
      continue;
    }

    if (refund.status === 'succeeded') {
      await applySucceededRefund({
        refundOperation: op,
        reservationId: op.reservationId,
        reason: 'refund_reconcile',
        actor: { type: 'system' },
        stripeRefund: refund,
      });
      summary.action = 'applied_succeeded';
    } else if (refund.status === 'failed' || refund.status === 'canceled') {
      await markRefundFailed(op, {
        code: refund.status,
        message: `Stripe refund ${refund.status}`,
      });
      summary.action = 'marked_failed';
    } else {
      summary.action = 'still_pending';
      summary.reason = refund.status;
    }
    results.push(summary);
  }

  const failedWithId = await refundOpSql.findFailedWithRefundIdOlderThan({
    olderThanMinutes,
    limit,
  });

  for (const op of failedWithId) {
    const summary = {
      refundOperationId: op.id,
      reservationId: op.reservationId,
      action: 'skipped',
      reason: null,
    };

    let refund;
    try {
      refund = await retrieveRefund(op.stripeRefundId);
    } catch (err) {
      summary.reason = `retrieve_failed:${err.message}`;
      results.push(summary);
      continue;
    }

    if (dryRun) {
      summary.action = `would_apply_${refund.status}`;
      results.push(summary);
      continue;
    }

    if (refund.status === 'succeeded') {
      await applySucceededRefund({
        refundOperation: op,
        reservationId: op.reservationId,
        reason: 'refund_reconcile',
        actor: { type: 'system' },
        stripeRefund: refund,
      });
      summary.action = 'applied_succeeded';
    } else if (refund.status === 'pending' || refund.status === 'requires_action') {
      await resurrectPending(op, {
        stripeRefundId: refund.id,
        stripeRawStatus: refund.status,
      });
      summary.action = 'resurrected_pending';
      summary.reason = refund.status;
    } else if (refund.status === 'failed' || refund.status === 'canceled') {
      summary.action = 'left_failed';
      summary.reason = refund.status;
    } else {
      summary.action = 'left_failed';
      summary.reason = refund.status;
    }
    results.push(summary);
  }

  const inbox = await reconcileStuckRefundInbox({ dryRun, olderThanMinutes, limit });

  return {
    dryRun: !!dryRun,
    processed: pending.length + failedWithId.length,
    results,
    inbox,
  };
}

module.exports = {
  reconcilePendingRefunds,
  reconcileStuckRefundInbox,
};
