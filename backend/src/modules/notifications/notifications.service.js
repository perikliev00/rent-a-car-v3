/**
 * Admin-facing notification list service (paginated inbox of queue rows).
 */

const repo = require('./notifications.repository');

/**
 * @param {{ limit?: number, offset?: number, status?: string|null }} [opts]
 */
async function listForAdmin({ limit = 50, offset = 0, status = null } = {}) {
  // Create the safe limit constant.
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  // Create the safe offset constant.
  const safeOffset = Math.max(Number(offset) || 0, 0);
  // Destructure array values into local variables.
  const [rows, total] = await Promise.all([
    // Call repo.listNotifications to perform this step.
    repo.listNotifications({ limit: safeLimit, offset: safeOffset, status }),
    // Call repo.countNotifications to perform this step.
    repo.countNotifications({ status }),
  ]);
  // Return the resulting value to the caller.
  return { rows, total, limit: safeLimit, offset: safeOffset };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listForAdmin,
};
