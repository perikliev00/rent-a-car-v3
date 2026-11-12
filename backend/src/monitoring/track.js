/**
 * High-level failure tracking: metrics, logs, Sentry, and payment_failure persistence.
 */

const logger = require('../utils/logger');
// Destructure object properties into local variables.
const { captureException, captureMessage } = require('../config/sentry');
// Require the './metrics' module as metrics.
const metrics = require('./metrics');
// Require the '../services/sql/paymentFailureSqlService' module as paymentFailureSql.
const paymentFailureSql = require('../services/sql/paymentFailureSqlService');

/**
 * Resolve a correlation id from explicit context fields.
 *
 * @param {Record<string, unknown>} [context={}]
 * @returns {string | null}
 * @throws {never}
 */
function resolveRequestId(context = {}) {
  // Return the resulting value to the caller.
  return context.requestId || context.correlationId || null;
}

/**
 * Persist a payment failure row and best-effort enqueue notifications / live events.
 * Fire-and-forget: persistence / notify failures are logged, not thrown to callers.
 *
 * @param {string} reason - Short machine-readable failure reason
 * @param {Record<string, unknown>} [context={}] - reservationId, stripeSessionId, email, …
 * @returns {void}
 * @throws {never}
 */
function persistPaymentFailure(reason, context = {}) {
  // Create the request id constant.
  const requestId = resolveRequestId(context);

  // Insert the ops row, then best-effort notify + live publish.
  paymentFailureSql
    // Call .insertPaymentFailure to perform this step.
    .insertPaymentFailure({
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Provide the correlation id field value.
      correlationId: requestId,
      // Provide the stripe session id field value.
      stripeSessionId: context.stripeSessionId || null,
      // Provide the reservation id field value.
      reservationId: context.reservationId || null,
      // Provide the event id field value.
      eventId: context.eventId || null,
      // Contribute this line to the enclosing declaration or statement.
      context,
    })
    // Call .then to perform this step.
    .then(async (row) => {
      // Start a try block for operations that may fail.
      try {
        // Destructure object properties into local variables.
        const { enqueuePaymentFailed } = require('../modules/notifications/notifications.enqueue');
        // Prefer email from context; else look it up from the reservation row.
        let email =
          // Contribute this line to the enclosing declaration or statement.
          context.email ||
          // Contribute this line to the enclosing declaration or statement.
          context.customerEmail ||
          // Continue the surrounding logic with this statement.
          (context.context && context.context.email) ||
          // Supply the literal value used by the enclosing expression.
          null;

        // Evaluate the condition and enter the branch when it is true.
        if (!email && context.reservationId) {
          // Require the '../db/pool' module as pool.
          const pool = require('../db/pool');
          // Create the res constant.
          const res = await pool.query(
            // Continue the surrounding logic with this statement.
            `SELECT email FROM reservations WHERE id = $1 AND email IS NOT NULL LIMIT 1`,
            // Continue the surrounding logic with this statement.
            [Number(context.reservationId)]
          );
          // Update email with the right-hand side value.
          email = res.rows[0]?.email || null;
        }

        // Evaluate the condition and enter the branch when it is true.
        if (email) {
          // Wait until the asynchronous operation resolves.
          await enqueuePaymentFailed({
            // Provide the reservation id field value.
            reservationId: context.reservationId || null,
            // Contribute this line to the enclosing declaration or statement.
            email,
            // Contribute this line to the enclosing declaration or statement.
            reason,
            // Provide the stripe session id field value.
            stripeSessionId: context.stripeSessionId || null,
            // Provide the failure id field value.
            failureId: row?.id || null,
          });
        }

        // Live admin event is optional; failures must not block persistence.
        try {
          // Destructure object properties into local variables.
          const { publishPaymentFailed } = require('../modules/realtime/realtime.publisher');
          // Call publishPaymentFailed to perform this step.
          publishPaymentFailed({
            // Provide the reservation id field value.
            reservationId: context.reservationId || null,
            // Contribute this line to the enclosing declaration or statement.
            reason,
            // Provide the stripe session id field value.
            stripeSessionId: context.stripeSessionId || null,
            // Provide the failure id field value.
            failureId: row?.id || null,
            // Provide the customer name field value.
            customerName: context.fullName || context.customerName || null,
            // Provide the meta field value.
            meta: { requestId },
          });
        // Continue the surrounding logic with this statement.
        } catch (liveErr) {
          // Call logger.error to perform this step.
          logger.error({ err: liveErr, reason }, 'Payment failure live event hook error');
        }
      // Continue the surrounding logic with this statement.
      } catch (err) {
        // Call logger.error to perform this step.
        logger.error({ err, reason }, 'Payment failure notification hook error');
      }
    })
    // Call .catch to perform this step.
    .catch((err) => {
      // Call logger.error to perform this step.
      logger.error({ err, reason, requestId }, 'Failed to persist payment failure record');
    });
}

/**
 * Record a payment failure (metrics, warn log, Sentry, DB row).
 *
 * @param {string} reason
 * @param {Record<string, unknown>} [context={}]
 * @returns {void}
 * @throws {never}
 */
function trackPaymentFailure(reason, context = {}) {
  // Call metrics.incrementPaymentFailures to perform this step.
  metrics.incrementPaymentFailures();

  // Create the request id constant.
  const requestId = resolveRequestId(context);
  // Create the payload constant.
  const payload = { event: 'payment_failure', reason, requestId, ...context };

  // Call logger.warn to perform this step.
  logger.warn(payload, `Payment failure: ${reason}`);

  // Call captureMessage to perform this step.
  captureMessage(`Payment failure: ${reason}`, 'warning', {
    // Provide the tags field value.
    tags: { domain: 'payment' },
    // Provide the extra field value.
    extra: payload,
  });

  // Call persistPaymentFailure to perform this step.
  persistPaymentFailure(reason, context);
}

/**
 * Record a Stripe webhook failure (also persists a payment_failure row for ops).
 *
 * @param {string} reason
 * @param {Record<string, unknown>} [context={}]
 * @returns {void}
 * @throws {never}
 */
function trackWebhookFailure(reason, context = {}) {
  // Call metrics.incrementWebhookFailures to perform this step.
  metrics.incrementWebhookFailures(reason);

  // Create the request id constant.
  const requestId = resolveRequestId(context);
  // Create the payload constant.
  const payload = { event: 'webhook_failure', reason, requestId, ...context };

  // Call logger.warn to perform this step.
  logger.warn(payload, `Webhook failure: ${reason}`);

  // Call captureMessage to perform this step.
  captureMessage(`Webhook failure: ${reason}`, 'warning', {
    // Provide the tags field value.
    tags: { domain: 'webhook' },
    // Provide the extra field value.
    extra: payload,
  });

  // Call persistPaymentFailure to perform this step.
  persistPaymentFailure(reason, context);
}

/**
 * Record an unexpected error (metrics, error log, Sentry exception).
 *
 * @param {Error} error
 * @param {Record<string, unknown>} [context={}]
 * @returns {void}
 * @throws {never}
 */
function trackError(error, context = {}) {
  // Call metrics.incrementErrors to perform this step.
  metrics.incrementErrors();

  // Create the request id constant.
  const requestId = resolveRequestId(context);

  // Call logger.error to perform this step.
  logger.error(
    {
      // Provide the err field value.
      err: error,
      // Contribute this line to the enclosing declaration or statement.
      requestId,
      // Spread context into the surrounding structure.
      ...context,
    },
    // Contribute this line to the enclosing declaration or statement.
    error?.message || 'Unhandled error'
  );

  // Call captureException to perform this step.
  captureException(error, context);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  trackPaymentFailure,
  // Contribute this line to the enclosing declaration or statement.
  trackWebhookFailure,
  // Contribute this line to the enclosing declaration or statement.
  trackError,
};
