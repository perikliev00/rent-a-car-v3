/**
 * H4: confirmation email must be claimed atomically before SMTP and recover
 * from transient transport failures with bounded retries.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { pool } = require('../helpers/dbTestHarness');
const { enqueue } = require('../../src/modules/notifications/notifications.enqueue');
const {
  processDueNotifications,
  sendNowIfEnqueued,
} = require('../../src/modules/notifications/notifications.worker');
const { setTestSendMail } = require('../../src/services/email/emailService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describeIf('H4: notification send concurrency and retry', () => {
  const keys = [];

  beforeAll(() => {
    createIntegrationTestApp();
  });

  afterEach(() => {
    setTestSendMail(null);
  });

  afterAll(async () => {
    setTestSendMail(null);
    if (keys.length) {
      await pool.query(`DELETE FROM notifications WHERE idempotency_key = ANY($1::text[])`, [
        keys,
      ]);
    }
  });

  test('concurrent sendNow and worker deliver exactly once for one row', async () => {
    const idempotencyKey = `h4-once-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recipientEmail = `h4-once-${Date.now()}@example.com`;
    keys.push(idempotencyKey);

    let gateResolve;
    const gate = new Promise((resolve) => {
      gateResolve = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;
    let sendCount = 0;

    // Count only this recipient — worker may also drain unrelated pending rows.
    setTestSendMail(async ({ to }) => {
      if (to !== recipientEmail) {
        return { sent: true };
      }
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      sendCount += 1;
      await gate;
      inFlight -= 1;
      return { sent: true };
    });

    const row = await enqueue({
      type: 'reservation_confirmation',
      recipientEmail,
      payload: { orderId: 880001, fullName: 'H4 Once' },
      idempotencyKey,
    });
    expect(row).toBeTruthy();

    const sendNowPromise = sendNowIfEnqueued(row);
    const workerPromise = processDueNotifications({ limit: 20 });

    await delay(50);
    gateResolve();
    await Promise.all([sendNowPromise, workerPromise]);

    expect(sendCount).toBe(1);
    expect(maxInFlight).toBe(1);

    const after = await pool.query(
      `SELECT status, attempts FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    expect(after.rows[0].status).toBe('sent');
  });

  test('transient SMTP failure requeues and reaches sent with correct attempts', async () => {
    const idempotencyKey = `h4-retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recipientEmail = `h4-retry-${Date.now()}@example.com`;
    keys.push(idempotencyKey);

    let calls = 0;
    setTestSendMail(async ({ to }) => {
      if (to !== recipientEmail) {
        return { sent: true };
      }
      calls += 1;
      if (calls === 1) {
        const err = new Error('SMTP temporary failure');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return { sent: true };
    });

    const row = await enqueue({
      type: 'reservation_confirmation',
      recipientEmail,
      payload: { orderId: 880002, fullName: 'H4 Retry' },
      idempotencyKey,
      scheduledAt: new Date(Date.now() - 1000),
    });
    expect(row).toBeTruthy();

    // Keep draining until this row has been attempted (other pending rows may be ahead).
    let sawAttempt = false;
    for (let i = 0; i < 10 && !sawAttempt; i += 1) {
      await processDueNotifications({ limit: 20 });
      const mid = await pool.query(
        `SELECT status, attempts, last_error FROM notifications WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (Number(mid.rows[0].attempts) >= 1) {
        sawAttempt = true;
        expect(mid.rows[0].status).toBe('pending');
        expect(String(mid.rows[0].last_error || '')).toMatch(/temporary|ETIMEDOUT|SMTP/i);
      }
    }
    expect(sawAttempt).toBe(true);

    // Advance schedule if backoff was applied.
    await pool.query(
      `UPDATE notifications SET scheduled_at = NOW() - INTERVAL '1 second' WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    let reachedSent = false;
    for (let i = 0; i < 10 && !reachedSent; i += 1) {
      await processDueNotifications({ limit: 20 });
      const after = await pool.query(
        `SELECT status, attempts FROM notifications WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (after.rows[0].status === 'sent') {
        reachedSent = true;
        expect(Number(after.rows[0].attempts)).toBe(2);
      }
    }
    expect(reachedSent).toBe(true);
    expect(calls).toBe(2);
  });
});
