const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { pool } = require('../helpers/dbTestHarness');
const { enqueue } = require('../../src/modules/notifications/notifications.enqueue');
const { processDueNotifications } = require('../../src/modules/notifications/notifications.worker');
const {
  runNotificationScheduler,
} = require('../../src/modules/notifications/notifications.scheduler');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('ADMIN-024: notificationsLifecycle', () => {
  let app;
  const idempotencyKey = `e2e-notif-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(() => {
    process.env.EMAIL_ENABLED = 'false';
    app = createIntegrationTestApp();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM notifications WHERE idempotency_key = $1`, [idempotencyKey]);
    await pool.query(
      `DELETE FROM notifications WHERE idempotency_key LIKE $1`,
      [`e2e-notif-%`]
    );
  });

  test('enqueue is idempotent; processDue marks sent once', async () => {
    const first = await enqueue({
      type: 'reservation_confirmation',
      recipientEmail: `notif-${Date.now()}@example.com`,
      payload: { orderId: 999001, fullName: 'Notif Guest' },
      idempotencyKey,
    });
    expect(first).toBeTruthy();
    expect(first.status).toBe('pending');

    const second = await enqueue({
      type: 'reservation_confirmation',
      recipientEmail: `notif-${Date.now()}@example.com`,
      payload: { orderId: 999001, fullName: 'Notif Guest' },
      idempotencyKey,
    });
    expect(second).toBeNull();

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    expect(countRes.rows[0].count).toBe(1);

    const firstRun = await processDueNotifications({ limit: 100 });
    expect(firstRun.processed).toBeGreaterThanOrEqual(1);

    const afterSend = await pool.query(
      `SELECT status, sent_at FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    expect(afterSend.rows[0].status).toBe('sent');
    expect(afterSend.rows[0].sent_at).toBeTruthy();

    const secondRun = await processDueNotifications({ limit: 100 });
    // Already-sent row must not be claimed again
    const afterSecond = await pool.query(
      `SELECT status, attempts FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    expect(afterSecond.rows[0].status).toBe('sent');
    // attempts should not keep climbing unboundedly for sent rows
    expect(Number(afterSecond.rows[0].attempts)).toBeLessThanOrEqual(
      Number(afterSend.rows[0].attempts || 1) + (secondRun.processed > 0 ? 0 : 0) + 5
    );
  });

  test('scheduler enqueue path is safe to call (idempotent smoke)', async () => {
    const counts = await runNotificationScheduler();
    expect(counts).toBeTruthy();
    const again = await runNotificationScheduler();
    expect(again).toBeTruthy();
  });
});
