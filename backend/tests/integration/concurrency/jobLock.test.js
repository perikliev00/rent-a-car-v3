const { pool } = require('../../helpers/dbTestHarness');
const { withJobLock, ADVISORY_LOCK_NS } = require('../../../src/db/transaction');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('background job advisory lock', () => {
  const jobKey = `job.test.${Date.now()}`;

  test('only one concurrent withJobLock holder runs work', async () => {
    let releaseHold;
    const holdPromise = new Promise((resolve) => {
      releaseHold = resolve;
    });

    let firstOutcomePromise;
    const firstStarted = new Promise((resolveStarted) => {
      firstOutcomePromise = withJobLock(jobKey, async () => {
        resolveStarted();
        await holdPromise;
        return 'first';
      });
    });

    await firstStarted;

    await expect(withJobLock(jobKey, async () => 'second')).resolves.toEqual({ skipped: true });

    releaseHold();
    await expect(firstOutcomePromise).resolves.toEqual({ skipped: false, result: 'first' });
    await expect(withJobLock(jobKey, async () => 'after')).resolves.toEqual({
      skipped: false,
      result: 'after',
    });
  });

  test('JOB namespace lock appears in pg_locks while held', async () => {
    const client = await pool.connect();
    try {
      const acquired = await client.query(
        'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
        [ADVISORY_LOCK_NS.JOB, jobKey]
      );
      expect(
        acquired.rows[0].acquired === true || acquired.rows[0].acquired === 't'
      ).toBe(true);

      const locks = await pool.query(
        `
        SELECT 1
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND granted = true
          AND classid = $1
          AND objid = hashtext($2)
          AND objsubid = 2
        `,
        [ADVISORY_LOCK_NS.JOB, jobKey]
      );
      expect(locks.rowCount).toBeGreaterThan(0);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [
        ADVISORY_LOCK_NS.JOB,
        jobKey,
      ]);
      client.release();
    }
  });
});
