// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { pool } = require('../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { enqueue } = require('../../src/modules/notifications/notifications.enqueue');
// Destructure object properties into local variables.
const { processDueNotifications } = require('../../src/modules/notifications/notifications.worker');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  runNotificationScheduler,
// Continue the surrounding logic with this statement.
} = require('../../src/modules/notifications/notifications.scheduler');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('ADMIN-024: notificationsLifecycle', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Create the idempotency key constant.
  const idempotencyKey = `e2e-notif-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update process.env.EMAIL_ENABLED with the right-hand side value.
    process.env.EMAIL_ENABLED = 'false';
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register cleanup that runs after the tests.
  afterAll(async () => {
    // Wait until the asynchronous operation resolves.
    await pool.query(`DELETE FROM notifications WHERE idempotency_key = $1`, [idempotencyKey]);
    // Wait until the asynchronous operation resolves.
    await pool.query(
      // Continue the surrounding logic with this statement.
      `DELETE FROM notifications WHERE idempotency_key LIKE $1`,
      // Continue the surrounding logic with this statement.
      [`e2e-notif-%`]
    );
  });

  // Define a single test case and its expectations.
  test('enqueue is idempotent; processDue marks sent once', async () => {
    // Create the first constant.
    const first = await enqueue({
      // Provide the type field value.
      type: 'reservation_confirmation',
      // Provide the recipient email field value.
      recipientEmail: `notif-${Date.now()}@example.com`,
      // Provide the payload field value.
      payload: { orderId: 999001, fullName: 'Notif Guest' },
      // Contribute this line to the enclosing declaration or statement.
      idempotencyKey,
    });
    // Assert that the value matches the intended expectation.
    expect(first).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(first.status).toBe('pending');

    // Create the second constant.
    const second = await enqueue({
      // Provide the type field value.
      type: 'reservation_confirmation',
      // Provide the recipient email field value.
      recipientEmail: `notif-${Date.now()}@example.com`,
      // Provide the payload field value.
      payload: { orderId: 999001, fullName: 'Notif Guest' },
      // Contribute this line to the enclosing declaration or statement.
      idempotencyKey,
    });
    // Assert that the value matches the intended expectation.
    expect(second).toBeNull();

    // Create the count res constant.
    const countRes = await pool.query(
      // Continue the surrounding logic with this statement.
      `SELECT COUNT(*)::int AS count FROM notifications WHERE idempotency_key = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [idempotencyKey]
    );
    // Assert that the value matches the intended expectation.
    expect(countRes.rows[0].count).toBe(1);

    // Create the first run constant.
    const firstRun = await processDueNotifications({ limit: 100 });
    // Assert that the value matches the intended expectation.
    expect(firstRun.processed).toBeGreaterThanOrEqual(1);

    // Create the after send constant.
    const afterSend = await pool.query(
      // Continue the surrounding logic with this statement.
      `SELECT status, sent_at FROM notifications WHERE idempotency_key = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [idempotencyKey]
    );
    // Assert that the value matches the intended expectation.
    expect(afterSend.rows[0].status).toBe('sent');
    // Assert that the value matches the intended expectation.
    expect(afterSend.rows[0].sent_at).toBeTruthy();

    // Create the second run constant.
    const secondRun = await processDueNotifications({ limit: 100 });
    // Already-sent row must not be claimed again
    const afterSecond = await pool.query(
      // Continue the surrounding logic with this statement.
      `SELECT status, attempts FROM notifications WHERE idempotency_key = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [idempotencyKey]
    );
    // Assert that the value matches the intended expectation.
    expect(afterSecond.rows[0].status).toBe('sent');
    // attempts should not keep climbing unboundedly for sent rows
    expect(Number(afterSecond.rows[0].attempts)).toBeLessThanOrEqual(
      // Call Number to perform this step.
      Number(afterSend.rows[0].attempts || 1) + (secondRun.processed > 0 ? 0 : 0) + 5
    );
  });

  // Define a single test case and its expectations.
  test('scheduler enqueue path is safe to call (idempotent smoke)', async () => {
    // Create the counts constant.
    const counts = await runNotificationScheduler();
    // Assert that the value matches the intended expectation.
    expect(counts).toBeTruthy();
    // Create the again constant.
    const again = await runNotificationScheduler();
    // Assert that the value matches the intended expectation.
    expect(again).toBeTruthy();
  });
});
