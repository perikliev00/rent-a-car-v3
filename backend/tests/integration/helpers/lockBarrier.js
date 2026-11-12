// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { ADVISORY_LOCK_NS } = require('../../../src/db/transaction');

// Define the async function waitUntilAdvisoryLockWaiter.
async function waitUntilAdvisoryLockWaiter(
  // Contribute this line to the enclosing declaration or statement.
  namespace,
  // Contribute this line to the enclosing declaration or statement.
  key,
  // Continue the surrounding logic with this statement.
  { timeoutMs = 8000, intervalMs = 25 } = {}
// Continue the surrounding logic with this statement.
) {
  // Create the started constant.
  const started = Date.now();
  // Keep looping while the condition remains true.
  while (Date.now() - started < timeoutMs) {
    // Create the result constant.
    const result = await pool.query(
      // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      [namespace, key]
    );
    // Evaluate the condition and enter the branch when it is true.
    if (result.rowCount) {
      // Return control to the caller with the following value.
      return;
    }
    // Wait until the asynchronous operation resolves.
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  // Throw an error to stop the current control flow.
  throw new Error(`Timed out waiting for advisory lock waiter ns=${namespace} key=${key}`);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ADVISORY_LOCK_NS,
  // Contribute this line to the enclosing declaration or statement.
  waitUntilAdvisoryLockWaiter,
};
