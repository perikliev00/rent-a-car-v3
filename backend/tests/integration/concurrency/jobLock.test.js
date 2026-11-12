// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { withJobLock, ADVISORY_LOCK_NS } = require('../../../src/db/transaction');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('background job advisory lock', () => {
  // Create the job key constant.
  const jobKey = `job.test.${Date.now()}`;

  // Define a single test case and its expectations.
  test('only one concurrent withJobLock holder runs work', async () => {
    // Reserve the release hold variable for later assignment.
    let releaseHold;
    // Create the hold promise constant.
    const holdPromise = new Promise((resolve) => {
      // Update releaseHold with the right-hand side value.
      releaseHold = resolve;
    });

    // Reserve the first outcome promise variable for later assignment.
    let firstOutcomePromise;
    // Create the first started constant.
    const firstStarted = new Promise((resolveStarted) => {
      // Update firstOutcomePromise with the right-hand side value.
      firstOutcomePromise = withJobLock(jobKey, async () => {
        // Call resolveStarted to perform this step.
        resolveStarted();
        // Wait until the asynchronous operation resolves.
        await holdPromise;
        // Return the resulting value to the caller.
        return 'first';
      });
    });

    // Wait until the asynchronous operation resolves.
    await firstStarted;

    // Wait until the asynchronous operation resolves.
    await expect(withJobLock(jobKey, async () => 'second')).resolves.toEqual({ skipped: true });

    // Call releaseHold to perform this step.
    releaseHold();
    // Wait until the asynchronous operation resolves.
    await expect(firstOutcomePromise).resolves.toEqual({ skipped: false, result: 'first' });
    // Wait until the asynchronous operation resolves.
    await expect(withJobLock(jobKey, async () => 'after')).resolves.toEqual({
      // Provide the skipped field value.
      skipped: false,
      // Provide the result field value.
      result: 'after',
    });
  });

  // Define a single test case and its expectations.
  test('JOB namespace lock appears in pg_locks while held', async () => {
    // Create the client constant.
    const client = await pool.connect();
    // Start a try block for operations that may fail.
    try {
      // Create the acquired constant.
      const acquired = await client.query(
        // Continue the surrounding logic with this statement.
        'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
        // Contribute this line to the enclosing declaration or statement.
        [ADVISORY_LOCK_NS.JOB, jobKey]
      );
      // Assert that the value matches the intended expectation.
      expect(
        // Update acquired.rows[0].acquired with the right-hand side value.
        acquired.rows[0].acquired === true || acquired.rows[0].acquired === 't'
      // Continue the surrounding logic with this statement.
      ).toBe(true);

      // Create the locks constant.
      const locks = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        SELECT 1
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND granted = true
          AND classid = $1
          AND objid = hashtext($2)
          AND objsubid = 2
        `,
        // Contribute this line to the enclosing declaration or statement.
        [ADVISORY_LOCK_NS.JOB, jobKey]
      );
      // Assert that the value matches the intended expectation.
      expect(locks.rowCount).toBeGreaterThan(0);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [
        // Contribute this line to the enclosing declaration or statement.
        ADVISORY_LOCK_NS.JOB,
        // Contribute this line to the enclosing declaration or statement.
        jobKey,
      ]);
      // Call client.release to perform this step.
      client.release();
    }
  });
});
