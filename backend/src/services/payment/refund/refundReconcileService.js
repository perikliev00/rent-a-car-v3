const refundOpSql = require('../../sql/refundOperationSqlService');
const { retrieveRefund } = require('../stripeRefundService');
const { applySucceededRefund } = require('./applyRefundService');
const { markRefundFailed } = require('./refundLedgerService');

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

  return {
    dryRun: !!dryRun,
    processed: pending.length,
    results,
  };
}

module.exports = {
  reconcilePendingRefunds,
};
