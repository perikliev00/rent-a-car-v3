const { pool } = require('../../helpers/dbTestHarness');
const { ADVISORY_LOCK_NS } = require('../../../src/db/transaction');

async function waitUntilAdvisoryLockWaiter(
  namespace,
  key,
  { timeoutMs = 8000, intervalMs = 25 } = {}
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await pool.query(
      `
      SELECT 1
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND granted = false
        AND classid = $1
        AND objid = $2
        AND objsubid = 2
      LIMIT 1
      `,
      [namespace, key]
    );
    if (result.rowCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for advisory lock waiter ns=${namespace} key=${key}`);
}

module.exports = {
  ADVISORY_LOCK_NS,
  waitUntilAdvisoryLockWaiter,
};
