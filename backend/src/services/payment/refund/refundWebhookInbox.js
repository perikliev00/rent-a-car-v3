/**
 * Persist Stripe refund webhook events into the payment-event inbox before apply.
 * Deduplicates by event id; returns 500 only when persistence/apply fails so
 * Stripe retries; returns 200 for duplicates already processed/ignored.
 */
const paymentEventSql = require('../../sql/paymentEventSqlService');
const { isUniqueViolation } = require('../../../db/transaction');
const { applyRefundFromStripeObject } = require('./refundWebhookService');
const logger = require('../../../utils/logger');
const { trackWebhookFailure } = require('../../../monitoring/track');

const IGNORE_REASONS = new Set(['no_matching_operation', 'partial_or_amount_mismatch']);
const TERMINAL_INBOX_STATUSES = new Set(['processed', 'ignored']);

/**
 * Transform helper: build refund inbox payload.
 * @param {*} event
 * @param {*} obj
 * @returns {*}
 */
function buildRefundInboxPayload(event, obj) {
  return {
    id: event.id,
    type: event.type,
    data: { object: obj || null },
  };
}

/**
 * track apply failure.
 * @param {*} req
 * @param {*} event
 * @param {*} err
 * @returns {*}
 */
function trackApplyFailure(req, event, err) {
  trackWebhookFailure('refund_apply_failed', {
    requestId: req?.requestId,
    eventId: event.id,
    eventType: event.type,
    message: err.message,
  });
}

/**
 * Insert inbox row or return existing row on unique event_id conflict.
 * @returns {Promise<{ row: object, duplicate: boolean }>}
 */
async function claimRefundInbox(event, obj) {
  const payload = buildRefundInboxPayload(event, obj);
  // Protected block: isolate failure modes.
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
    // Guard: early-return or throw when required input is missing/invalid.
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const existing = await paymentEventSql.findByEventId(event.id);
    // Idempotency guard: return early when work was already applied.
    if (!existing) {
      throw err;
    }
    return { row: existing, duplicate: true };
  }
}

/**
 * mark inbox status — mutates persisted state when applicable.
 * @param {object} row
 * @param {string} status
 * @returns {Promise<*>}
 */
async function markInboxStatus(row, status) {
  return paymentEventSql.updatePaymentEventStatus(row.id, status);
}

/**
 * Handle refund.* / charge.refunded webhook after signature verification.
 * @param {object} event - Stripe event
 * @param {import('express').Request} req
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function handleRefundWebhookEvent(event, req) {
  const obj = event.data?.object;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!event?.id) {
    return { statusCode: 500, body: { received: false } };
  }

  let claimed;
  // Protected block: isolate failure modes.
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

  // Idempotent delivery: already finished this event.
  if (claimed.duplicate && TERMINAL_INBOX_STATUSES.has(claimed.row.status)) {
    return { statusCode: 200, body: { received: true } };
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!obj) {
    // Protected block: isolate failure modes.
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

  // Protected block: isolate failure modes.
  try {
    const result = await applyRefundFromStripeObject(obj, { eventType: event.type });
    const nextStatus =
      result?.handled === false && IGNORE_REASONS.has(result.reason) ? 'ignored' : 'processed';
    // Protected block: isolate failure modes.
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
    // 500 so Stripe retries; inbox stays received for reconcile.
    return { statusCode: 500, body: { received: false } };
  }
}

module.exports = {
  IGNORE_REASONS,
  buildRefundInboxPayload,
  claimRefundInbox,
  handleRefundWebhookEvent,
};
