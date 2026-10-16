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

/**
 * Claim and process up to `limit` due notifications.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
async function processDueNotifications({ limit = 50 } = {}) {
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
        // Soft failure from sender (e.g. missing recipient) — persist reason.
        await repo.markFailed(notification.id, result.reason || 'send_failed');
        failed += 1;
      }
    } catch (err) {
      // Hard send error — count as failed and best-effort mark the row.
      failed += 1;
      logger.error(
        { err, notificationId: notification.id, type: notification.type },
        'Notification send error'
      );
      try {
        await repo.markFailed(notification.id, err.message);
      } catch (markErr) {
        logger.error({ err: markErr, notificationId: notification.id }, 'Failed to mark notification failed');
      }
    }
  }

  return { processed: claimed.length, sent, failed };
}

/**
 * Enqueue + immediately process a single notification if newly inserted.
 * Used for time-critical paths that should not wait for the next cron tick.
 * @param {object|null|undefined} insertedRow Row returned from enqueue insert
 * @returns {Promise<{ sent: boolean, skipped?: boolean, reason?: string }>}
 */
async function sendNowIfEnqueued(insertedRow) {
  // Nothing inserted (duplicate / skipped enqueue) — treat as no-op.
  if (!insertedRow) return { sent: false, skipped: true };
  try {
    const result = await sendNotificationEmail(insertedRow);
    if (result.sent) {
      await repo.markSent(insertedRow.id);
      return { sent: true, skipped: false };
    }
    await repo.markFailed(insertedRow.id, result.reason || 'send_failed');
    return { sent: false, skipped: false, reason: result.reason };
  } catch (err) {
    // Persist failure then rethrow so callers can surface the error.
    await repo.markFailed(insertedRow.id, err.message);
    throw err;
  }
}

module.exports = {
  processDueNotifications,
  sendNowIfEnqueued,
};
