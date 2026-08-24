const paymentEventSql = require('../../sql/paymentEventSqlService');
const { isUniqueViolation } = require('../../../db/transaction');
const { applyRefundFromStripeObject } = require('./refundWebhookService');
const logger = require('../../../utils/logger');
const { trackWebhookFailure } = require('../../../monitoring/track');

const IGNORE_REASONS = new Set(['no_matching_operation', 'partial_or_amount_mismatch']);
const TERMINAL_INBOX_STATUSES = new Set(['processed', 'ignored']);

function buildRefundInboxPayload(event, obj) {
  return {
    id: event.id,
    type: event.type,
    data: { object: obj || null },
  };
}

function trackApplyFailure(req, event, err) {
  trackWebhookFailure('refund_apply_failed', {
    requestId: req?.requestId,
    eventId: event.id,
    eventType: event.type,
    message: err.message,
  });
}

async function claimRefundInbox(event, obj) {
  const payload = buildRefundInboxPayload(event, obj);
  try {
    const row = await paymentEventSql.insertPaymentEvent({
      eventId: event.id,
      eventType: event.type,
      stripeSessionId: obj?.id || null,
      reservationId: obj?.metadata?.reservationId || null,
      status: 'received',
      payload,
    });
    return { row, duplicate: false };
  } catch (err) {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const existing = await paymentEventSql.findByEventId(event.id);
    if (!existing) {
      throw err;
    }
    return { row: existing, duplicate: true };
  }
}

async function markInboxStatus(row, status) {
  return paymentEventSql.updatePaymentEventStatus(row.id, status);
}

async function handleRefundWebhookEvent(event, req) {
  const obj = event.data?.object;

  if (!event?.id) {
    return { statusCode: 500, body: { received: false } };
  }

  let claimed;
  try {
    claimed = await claimRefundInbox(event, obj);
  } catch (err) {
    logger.error(
      { err, eventId: event.id, eventType: event.type, requestId: req?.requestId },
      'Failed to persist refund webhook inbox'
    );
    trackApplyFailure(req, event, err);
    return { statusCode: 500, body: { received: false } };
  }

  if (claimed.duplicate && TERMINAL_INBOX_STATUSES.has(claimed.row.status)) {
    return { statusCode: 200, body: { received: true } };
  }

  if (!obj) {
    try {
      await markInboxStatus(claimed.row, 'ignored');
    } catch (err) {
      logger.error(
        { err, eventId: event.id, requestId: req?.requestId },
        'Failed to mark refund webhook ignored (missing object)'
      );
      trackApplyFailure(req, event, err);
      return { statusCode: 500, body: { received: false } };
    }
    return { statusCode: 200, body: { received: true } };
  }

  try {
    const result = await applyRefundFromStripeObject(obj, { eventType: event.type });
    const nextStatus =
      result?.handled === false && IGNORE_REASONS.has(result.reason) ? 'ignored' : 'processed';
    try {
      await markInboxStatus(claimed.row, nextStatus);
    } catch (err) {
      logger.error(
        { err, eventId: event.id, eventType: event.type, requestId: req?.requestId },
        'Failed to update refund webhook inbox status after apply'
      );
      trackApplyFailure(req, event, err);
      return { statusCode: 500, body: { received: false } };
    }
    return { statusCode: 200, body: { received: true } };
  } catch (err) {
    logger.error(
      { err, eventId: event.id, eventType: event.type, requestId: req?.requestId },
      'Failed to apply Stripe refund webhook'
    );
    trackApplyFailure(req, event, err);
    return { statusCode: 500, body: { received: false } };
  }
}

module.exports = {
  IGNORE_REASONS,
  buildRefundInboxPayload,
  claimRefundInbox,
  handleRefundWebhookEvent,
};
