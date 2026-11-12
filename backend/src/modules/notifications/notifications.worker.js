/**
 * Notification delivery worker.
 *
 * Claims due pending rows under SKIP LOCKED, sends via email channel, then
 * marks sent/failed. Used by cron and the admin run-scheduler endpoint.
 */

const repo = require('./notifications.repository');
// Destructure object properties into local variables.
const { sendNotificationEmail } = require('./notifications.sender');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { runWithTransaction } = require('../../db/transaction');

/**
 * Claim and process up to `limit` due notifications.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
async function processDueNotifications({ limit = 50 } = {}) {
  // Step 1: claim a batch inside a transaction (SKIP LOCKED via repository).
  let claimed = [];
  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in claimed.
    claimed = await runWithTransaction(async (client) =>
      // Call repo.claimDueNotifications to perform this step.
      repo.claimDueNotifications({ limit }, client)
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Claim failed — abort this tick rather than send without ownership.
    logger.error({ err, context: 'notifications.claim' }, 'Failed to claim notifications');
    // Return the resulting value to the caller.
    return { processed: 0, sent: 0, failed: 0 };
  }

  // Initialize the mutable sent variable.
  let sent = 0;
  // Initialize the mutable failed variable.
  let failed = 0;

  // Step 2: deliver each claimed row outside the claim TX so sends do not hold locks.
  for (const notification of claimed) {
    // Start a try block for operations that may fail.
    try {
      // Create the result constant.
      const result = await sendNotificationEmail(notification);
      // Evaluate the condition and enter the branch when it is true.
      if (result.sent) {
        // Channel accepted — mark row sent so it will not be reclaimed.
        await repo.markSent(notification.id);
        // Update sent with the right-hand side value.
        sent += 1;
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Soft failure from sender (e.g. missing recipient) — persist reason.
        await repo.markFailed(notification.id, result.reason || 'send_failed');
        // Update failed with the right-hand side value.
        failed += 1;
      }
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Hard send error — count as failed and best-effort mark the row.
      failed += 1;
      // Call logger.error to perform this step.
      logger.error(
        // Contribute this line to the enclosing declaration or statement.
        { err, notificationId: notification.id, type: notification.type },
        // Supply the literal value used by the enclosing expression.
        'Notification send error'
      );
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await repo.markFailed(notification.id, err.message);
      // Continue the surrounding logic with this statement.
      } catch (markErr) {
        // Call logger.error to perform this step.
        logger.error({ err: markErr, notificationId: notification.id }, 'Failed to mark notification failed');
      }
    }
  }

  // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await sendNotificationEmail(insertedRow);
    // Evaluate the condition and enter the branch when it is true.
    if (result.sent) {
      // Wait until the asynchronous operation resolves.
      await repo.markSent(insertedRow.id);
      // Return the resulting value to the caller.
      return { sent: true, skipped: false };
    }
    // Wait until the asynchronous operation resolves.
    await repo.markFailed(insertedRow.id, result.reason || 'send_failed');
    // Return the resulting value to the caller.
    return { sent: false, skipped: false, reason: result.reason };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Persist failure then rethrow so callers can surface the error.
    await repo.markFailed(insertedRow.id, err.message);
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  processDueNotifications,
  // Contribute this line to the enclosing declaration or statement.
  sendNowIfEnqueued,
};
