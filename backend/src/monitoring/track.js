/**
 * High-level failure tracking: metrics, logs, Sentry, and payment_failure persistence.
 */

const logger = require('../utils/logger');
const { captureException, captureMessage } = require('../config/sentry');
const metrics = require('./metrics');
const paymentFailureSql = require('../services/sql/paymentFailureSqlService');

/**
 * Resolve a correlation id from explicit context fields.
 *
 * @param {Record<string, unknown>} [context={}]
 * @returns {string | null}
 * @throws {never}
 */
function resolveRequestId(context = {}) {
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
  const requestId = resolveRequestId(context);

  // Insert the ops row, then best-effort notify + live publish.
  paymentFailureSql
    .insertPaymentFailure({
      reason,
      correlationId: requestId,
      stripeSessionId: context.stripeSessionId || null,
      reservationId: context.reservationId || null,
      eventId: context.eventId || null,
      context,
    })
    .then(async (row) => {
      try {
        const { enqueuePaymentFailed } = require('../modules/notifications/notifications.enqueue');
        // Prefer email from context; else look it up from the reservation row.
        let email =
          context.email ||
          context.customerEmail ||
          (context.context && context.context.email) ||
          null;

        if (!email && context.reservationId) {
          const pool = require('../db/pool');
          const res = await pool.query(
            `SELECT email FROM reservations WHERE id = $1 AND email IS NOT NULL LIMIT 1`,
            [Number(context.reservationId)]
          );
          email = res.rows[0]?.email || null;
        }

        if (email) {
          await enqueuePaymentFailed({
            reservationId: context.reservationId || null,
            email,
            reason,
            stripeSessionId: context.stripeSessionId || null,
            failureId: row?.id || null,
          });
        }

        // Live admin event is optional; failures must not block persistence.
        try {
          const { publishPaymentFailed } = require('../modules/realtime/realtime.publisher');
          publishPaymentFailed({
            reservationId: context.reservationId || null,
            reason,
            stripeSessionId: context.stripeSessionId || null,
            failureId: row?.id || null,
            customerName: context.fullName || context.customerName || null,
            meta: { requestId },
          });
        } catch (liveErr) {
          logger.error({ err: liveErr, reason }, 'Payment failure live event hook error');
        }
      } catch (err) {
        logger.error({ err, reason }, 'Payment failure notification hook error');
      }
    })
    .catch((err) => {
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
  metrics.incrementPaymentFailures();

  const requestId = resolveRequestId(context);
  const payload = { event: 'payment_failure', reason, requestId, ...context };

  logger.warn(payload, `Payment failure: ${reason}`);

  captureMessage(`Payment failure: ${reason}`, 'warning', {
    tags: { domain: 'payment' },
    extra: payload,
  });

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
  metrics.incrementWebhookFailures(reason);

  const requestId = resolveRequestId(context);
  const payload = { event: 'webhook_failure', reason, requestId, ...context };

  logger.warn(payload, `Webhook failure: ${reason}`);

  captureMessage(`Webhook failure: ${reason}`, 'warning', {
    tags: { domain: 'webhook' },
    extra: payload,
  });

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
  metrics.incrementErrors();

  const requestId = resolveRequestId(context);

  logger.error(
    {
      err: error,
      requestId,
      ...context,
    },
    error?.message || 'Unhandled error'
  );

  captureException(error, context);
}

module.exports = {
  trackPaymentFailure,
  trackWebhookFailure,
  trackError,
};
