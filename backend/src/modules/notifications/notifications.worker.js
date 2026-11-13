/**
 * Notification delivery worker.
 *
 * Claims due pending rows under SKIP LOCKED, sends via email channel, then
 * marks sent/failed. Used by cron and the admin run-scheduler endpoint.
 */

const repo = require('./notifications.repository');
const { sendNotificationEmail } = require('./notifications.sender');
const logger = require('../../utils/logger');
const { runWithTransaction } = require('../../db/transaction');

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;

function isTransientSendError(err) {
  const code = String(err?.code || '').toUpperCase();
  const message = String(err?.message || '').toLowerCase();
  if (['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKETTIMEDOUT', 'EAI_AGAIN'].includes(code)) {
    return true;
  }
  return (
    message.includes('temporary') ||
    message.includes('timeout') ||
    message.includes('try again') ||
    message.includes('rate limit')
  );
}

function backoffMsForAttempt(attempts) {
  const exp = Math.max(0, Number(attempts) - 1);
  return BASE_BACKOFF_MS * 2 ** Math.min(exp, 4);
}

/**
 * Persist a send failure: requeue with backoff while attempts remain, else mark failed.
 * @param {object} notification
 * @param {string} errorMessage
 * @param {{ transient?: boolean }} [opts]
 */
async function handleSendFailure(notification, errorMessage, { transient = true } = {}) {
  const attempts = Number(notification.attempts || 0);
  if (transient && attempts < MAX_ATTEMPTS) {
    const delayMs = backoffMsForAttempt(attempts);
    await repo.requeuePending(notification.id, null, {
      delayMs,
      lastError: errorMessage,
    });
    return { terminal: false, requeued: true };
  }

  await repo.markFailed(notification.id, errorMessage);
  return { terminal: true, requeued: false };
}

/**
 * Claim and process up to `limit` due notifications.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
async function processDueNotifications({ limit = 50 } = {}) {
  // Reclaim abandoned processing rows before claiming a fresh batch.
  try {
    await repo.requeueStuckProcessing({ olderThanMs: 5 * 60 * 1000 });
  } catch (err) {
    logger.warn({ err, context: 'notifications.requeueStuck' }, 'Failed to requeue stuck notifications');
  }

  // Step 1: claim a batch inside a transaction (SKIP LOCKED via repository).
  let claimed = [];
  try {
    claimed = await runWithTransaction(async (client) =>
      repo.claimDueNotifications({ limit }, client)
    );
  } catch (err) {
    // Claim failed — abort this tick rather than send without ownership.
    logger.error({ err, context: 'notifications.claim' }, 'Failed to claim notifications');
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Step 2: deliver each claimed row outside the claim TX so sends do not hold locks.
  for (const notification of claimed) {
    try {
      const result = await sendNotificationEmail(notification);
      if (result.sent) {
        // Channel accepted — mark row sent so it will not be reclaimed.
        await repo.markSent(notification.id);
        sent += 1;
      } else {
        const outcome = await handleSendFailure(
          notification,
          result.reason || 'send_failed',
          { transient: true }
        );
        if (outcome.terminal) failed += 1;
      }
    } catch (err) {
      logger.error(
        { err, notificationId: notification.id, type: notification.type },
        'Notification send error'
      );
      const outcome = await handleSendFailure(notification, err.message, {
        transient: isTransientSendError(err),
      });
      if (outcome.terminal) failed += 1;
    }
  }

  return { processed: claimed.length, sent, failed };
}

/**
 * Enqueue + immediately process a single notification if newly inserted.
 * Claims the row before SMTP so a concurrent worker cannot double-send.
 * @param {object|null|undefined} insertedRow Row returned from enqueue insert
 * @returns {Promise<{ sent: boolean, skipped?: boolean, reason?: string }>}
 */
async function sendNowIfEnqueued(insertedRow) {
  // Nothing inserted (duplicate / skipped enqueue) — treat as no-op.
  if (!insertedRow) return { sent: false, skipped: true };

  let claimed = null;
  try {
    claimed = await runWithTransaction(async (client) =>
      repo.claimNotificationById(insertedRow.id, client)
    );
  } catch (err) {
    logger.error(
      { err, notificationId: insertedRow.id, context: 'notifications.claimOne' },
      'Failed to claim notification for immediate send'
    );
    return { sent: false, skipped: true, reason: 'claim_failed' };
  }

  if (!claimed) {
    // Another worker already owns or completed this row.
    return { sent: false, skipped: true, reason: 'already_claimed' };
  }

  try {
    const result = await sendNotificationEmail(claimed);
    if (result.sent) {
      await repo.markSent(claimed.id);
      return { sent: true, skipped: false };
    }
    await handleSendFailure(claimed, result.reason || 'send_failed', { transient: true });
    return { sent: false, skipped: false, reason: result.reason };
  } catch (err) {
    await handleSendFailure(claimed, err.message, { transient: isTransientSendError(err) });
    throw err;
  }
}

module.exports = {
  processDueNotifications,
  sendNowIfEnqueued,
  MAX_ATTEMPTS,
};
