const repo = require('./notifications.repository');

async function listForAdmin({ limit = 50, offset = 0, status = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [rows, total] = await Promise.all([
    repo.listNotifications({ limit: safeLimit, offset: safeOffset, status }),
    repo.countNotifications({ status }),
  ]);
  return { rows, total, limit: safeLimit, offset: safeOffset };
}

module.exports = {
  listForAdmin,
};
