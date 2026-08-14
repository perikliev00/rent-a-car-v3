const logger = require('../utils/logger');
const { captureException, captureMessage } = require('../config/sentry');
const metrics = require('./metrics');
const paymentFailureSql = require('../services/sql/paymentFailureSqlService');

function resolveRequestId(context = {}) {
  return context.requestId || context.correlationId || null;
}

function persistPaymentFailure(reason, context = {}) {
  const requestId = resolveRequestId(context);

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
