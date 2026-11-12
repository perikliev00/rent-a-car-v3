/**
 * Persist Stripe refund webhook events into the payment-event inbox before apply.
 * Deduplicates by event id; returns 500 only when persistence/apply fails so
 * Stripe retries; returns 200 for duplicates already processed/ignored.
 */
const paymentEventSql = require('../../sql/paymentEventSqlService');
// Destructure object properties into local variables.
const { isUniqueViolation } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { applyRefundFromStripeObject } = require('./refundWebhookService');
// Require the '../../../utils/logger' module as logger.
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
const { trackWebhookFailure } = require('../../../monitoring/track');

// Create the ignore reasons constant.
const IGNORE_REASONS = new Set(['no_matching_operation', 'partial_or_amount_mismatch']);
// Create the terminal inbox statuses constant.
const TERMINAL_INBOX_STATUSES = new Set(['processed', 'ignored']);

/**
 * Transform helper: build refund inbox payload.
 * @param {*} event
 * @param {*} obj
 * @returns {*}
 */
function buildRefundInboxPayload(event, obj) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: event.id,
    // Provide the type field value.
    type: event.type,
    // Provide the data field value.
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
  // Call trackWebhookFailure to perform this step.
  trackWebhookFailure('refund_apply_failed', {
    // Provide the request id field value.
    requestId: req?.requestId,
    // Provide the event id field value.
    eventId: event.id,
    // Provide the event type field value.
    eventType: event.type,
    // Provide the message field value.
    message: err.message,
  });
}

/**
 * Insert inbox row or return existing row on unique event_id conflict.
 * @returns {Promise<{ row: object, duplicate: boolean }>}
 */
async function claimRefundInbox(event, obj) {
  // Create the payload constant.
  const payload = buildRefundInboxPayload(event, obj);
  // Protected block: isolate failure modes.
  try {
    // Create the row constant.
    const row = await paymentEventSql.insertPaymentEvent({
      // Provide the event id field value.
      eventId: event.id,
      // Provide the event type field value.
      eventType: event.type,
      // Provide the stripe session id field value.
      stripeSessionId: obj?.id || null,
      // Provide the reservation id field value.
      reservationId: obj?.metadata?.reservationId || null,
      // Provide the status field value.
      status: 'received',
      // Contribute this line to the enclosing declaration or statement.
      payload,
    });
    // Return the resulting value to the caller.
    return { row, duplicate: false };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!isUniqueViolation(err)) {
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Create the existing constant.
    const existing = await paymentEventSql.findByEventId(event.id);
    // Idempotency guard: return early when work was already applied.
    if (!existing) {
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
  return paymentEventSql.updatePaymentEventStatus(row.id, status);
}

/**
 * Handle refund.* / charge.refunded webhook after signature verification.
 * @param {object} event - Stripe event
 * @param {import('express').Request} req
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function handleRefundWebhookEvent(event, req) {
  // Create the obj constant.
  const obj = event.data?.object;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!event?.id) {
    // Return the resulting value to the caller.
    return { statusCode: 500, body: { received: false } };
  }

  // Reserve the claimed variable for later assignment.
  let claimed;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in claimed.
    claimed = await claimRefundInbox(event, obj);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error(
      // Contribute this line to the enclosing declaration or statement.
      { err, eventId: event.id, eventType: event.type, requestId: req?.requestId },
      // Supply the literal value used by the enclosing expression.
      'Failed to persist refund webhook inbox'
    );
    // Call trackApplyFailure to perform this step.
    trackApplyFailure(req, event, err);
    // Return the resulting value to the caller.
    return { statusCode: 500, body: { received: false } };
  }

  // Idempotent delivery: already finished this event.
  if (claimed.duplicate && TERMINAL_INBOX_STATUSES.has(claimed.row.status)) {
    // Return the resulting value to the caller.
    return { statusCode: 200, body: { received: true } };
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!obj) {
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await markInboxStatus(claimed.row, 'ignored');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.error to perform this step.
      logger.error(
        // Contribute this line to the enclosing declaration or statement.
        { err, eventId: event.id, requestId: req?.requestId },
        // Continue the surrounding logic with this statement.
        'Failed to mark refund webhook ignored (missing object)'
      );
      // Call trackApplyFailure to perform this step.
      trackApplyFailure(req, event, err);
      // Return the resulting value to the caller.
      return { statusCode: 500, body: { received: false } };
    }
    // Return the resulting value to the caller.
    return { statusCode: 200, body: { received: true } };
  }

  // Protected block: isolate failure modes.
  try {
    // Create the result constant.
    const result = await applyRefundFromStripeObject(obj, { eventType: event.type });
    // Create the next status constant.
    const nextStatus =
      // Continue the surrounding logic with this statement.
      result?.handled === false && IGNORE_REASONS.has(result.reason) ? 'ignored' : 'processed';
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await markInboxStatus(claimed.row, nextStatus);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.error to perform this step.
      logger.error(
        // Contribute this line to the enclosing declaration or statement.
        { err, eventId: event.id, eventType: event.type, requestId: req?.requestId },
        // Supply the literal value used by the enclosing expression.
        'Failed to update refund webhook inbox status after apply'
      );
      // Call trackApplyFailure to perform this step.
      trackApplyFailure(req, event, err);
      // Return the resulting value to the caller.
      return { statusCode: 500, body: { received: false } };
    }
    // Return the resulting value to the caller.
    return { statusCode: 200, body: { received: true } };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error(
      // Contribute this line to the enclosing declaration or statement.
      { err, eventId: event.id, eventType: event.type, requestId: req?.requestId },
      // Supply the literal value used by the enclosing expression.
      'Failed to apply Stripe refund webhook'
    );
    // Call trackApplyFailure to perform this step.
    trackApplyFailure(req, event, err);
    // 500 so Stripe retries; inbox stays received for reconcile.
    return { statusCode: 500, body: { received: false } };
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  IGNORE_REASONS,
  // Contribute this line to the enclosing declaration or statement.
  buildRefundInboxPayload,
  // Contribute this line to the enclosing declaration or statement.
  claimRefundInbox,
  // Contribute this line to the enclosing declaration or statement.
  handleRefundWebhookEvent,
};
