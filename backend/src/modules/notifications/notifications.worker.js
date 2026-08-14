const repo = require('./notifications.repository');
const { sendNotificationEmail } = require('./notifications.sender');
const logger = require('../../utils/logger');
const { runWithTransaction } = require('../../db/transaction');

async function processDueNotifications({ limit = 50 } = {}) {
  let claimed = [];
  try {
    claimed = await runWithTransaction(async (client) =>
      repo.claimDueNotifications({ limit }, client)
    );
  } catch (err) {
    // Fallback without FOR UPDATE if run outside TX unexpectedly
    logger.error({ err, context: 'notifications.claim' }, 'Failed to claim notifications');
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of claimed) {
    try {
      const result = await sendNotificationEmail(notification);
      if (result.sent) {
        await repo.markSent(notification.id);
        sent += 1;
      } else {
        await repo.markFailed(notification.id, result.reason || 'send_failed');
        failed += 1;
      }
    } catch (err) {
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
 */
async function sendNowIfEnqueued(insertedRow) {
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
    await repo.markFailed(insertedRow.id, err.message);
    throw err;
  }
}

module.exports = {
  processDueNotifications,
  sendNowIfEnqueued,
};
