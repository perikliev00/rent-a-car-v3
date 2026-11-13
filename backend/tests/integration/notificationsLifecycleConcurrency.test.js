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
    keys.push(idempotencyKey);

    let gateResolve;
    const gate = new Promise((resolve) => {
      gateResolve = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;
    let sendCount = 0;

    setTestSendMail(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      sendCount += 1;
      await gate;
      inFlight -= 1;
      return { sent: true };
    });

    const row = await enqueue({
      type: 'reservation_confirmation',
      recipientEmail: `h4-once-${Date.now()}@example.com`,
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
    keys.push(idempotencyKey);

    let calls = 0;
    setTestSendMail(async () => {
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
      recipientEmail: `h4-retry-${Date.now()}@example.com`,
      payload: { orderId: 880002, fullName: 'H4 Retry' },
      idempotencyKey,
      scheduledAt: new Date(Date.now() - 1000),
    });
    expect(row).toBeTruthy();

    const first = await processDueNotifications({ limit: 20 });
    expect(first.processed).toBeGreaterThanOrEqual(1);

    const mid = await pool.query(
      `SELECT status, attempts, scheduled_at, last_error FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    // After transient failure the row must be eligible again (pending) — not stuck failed forever.
    expect(mid.rows[0].status).toBe('pending');
    expect(Number(mid.rows[0].attempts)).toBeGreaterThanOrEqual(1);
    expect(String(mid.rows[0].last_error || '')).toMatch(/temporary|ETIMEDOUT|SMTP/i);

    // Advance schedule if backoff was applied.
    await pool.query(
      `UPDATE notifications SET scheduled_at = NOW() - INTERVAL '1 second' WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    const second = await processDueNotifications({ limit: 20 });
    expect(second.sent).toBeGreaterThanOrEqual(1);

    const after = await pool.query(
      `SELECT status, attempts FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    expect(after.rows[0].status).toBe('sent');
    expect(Number(after.rows[0].attempts)).toBe(2);
    expect(calls).toBe(2);
  });
});
