// Require the 'crypto' module as crypto.
const crypto = require('crypto');
// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { createSessionAgent, withCsrf } = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertLinkedBooking,
// Continue the surrounding logic with this statement.
} = require('./helpers/dbFixtures');
// Destructure object properties into local variables.
const { pool } = require('../helpers/dbTestHarness');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  hashEmailVerificationToken,
// Continue the surrounding logic with this statement.
} = require('../../src/services/auth/emailVerificationService');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Create the legacy cleanup sql constant.
const LEGACY_CLEANUP_SQL = fs.readFileSync(
  // Call path.join to perform this step.
  path.join(__dirname, '../../migrations/033_email_verification_legacy_cleanup.sql'),
  // Supply the literal value used by the enclosing expression.
  'utf8'
);

// Define the uniqueEmail function.
function uniqueEmail(prefix) {
  // Return the resulting value to the caller.
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Define the async function getReservationUserId.
async function getReservationUserId(reservationId) {
  // Create the result constant.
  const result = await pool.query(`SELECT user_id FROM reservations WHERE id = $1`, [
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
  ]);
  // Create the value constant.
  const value = result.rows[0]?.user_id;
  // Return the resulting value to the caller.
  return value == null ? null : Number(value);
}

// Define the async function getOrderUserId.
async function getOrderUserId(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT user_id FROM orders
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Create the value constant.
  const value = result.rows[0]?.user_id;
  // Return the resulting value to the caller.
  return value == null ? null : Number(value);
}

// Define the async function assertGuestUnclaimed.
async function assertGuestUnclaimed(reservationId) {
  // Assert that the value matches the intended expectation.
  expect(await getReservationUserId(reservationId)).toBeNull();
  // Assert that the value matches the intended expectation.
  expect(await getOrderUserId(reservationId)).toBeNull();
}

// Define the async function plantVerificationToken.
async function plantVerificationToken(userId) {
  // Create the token constant.
  const token = crypto.randomBytes(32).toString('hex');
  // Create the token hash constant.
  const tokenHash = hashEmailVerificationToken(token);
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `
    UPDATE users
    SET
      email_verification_token_hash = $2,
      email_verification_expires_at = NOW() + INTERVAL '1 day'
    WHERE id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [userId, tokenHash]
  );
  // Return the resulting value to the caller.
  return token;
}

// Call describeIf to perform this step.
describeIf('email verification booking claim', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(60_000);

  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: `Email verify claim ${Date.now()}` });
  });

  // Register cleanup that runs after the tests.
  afterAll(async () => {
    // Evaluate the condition and enter the branch when it is true.
    if (carId) {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('signup does not claim guest bookings until the email is verified', async () => {
    // Create the email constant.
    const email = uniqueEmail('claim-verify');
    // Create the password constant.
    const password = 'Customer123!';
    // Create the seeded constant.
    const seeded = await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the guest field value.
      guest: { email, fullName: 'Claim Guest' },
    });

    // Assert that the value matches the intended expectation.
    expect(await getReservationUserId(seeded.reservationId)).toBeNull();

    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the signup res constant.
    const signupRes = await withCsrf(agent, agent.post('/api/auth/signup')).send({
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Contribute this line to the enclosing declaration or statement.
      password,
    });
    // Assert that the value matches the intended expectation.
    expect(signupRes.status).toBe(201);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = signupRes.body.data?.csrfToken || agent.csrfToken;
    // Create the user id constant.
    const userId = Number(signupRes.body.data.user.id);
    // Assert that the value matches the intended expectation.
    expect(signupRes.body.data.user.emailVerified).toBe(false);

    // Assert that the value matches the intended expectation.
    expect(await getReservationUserId(seeded.reservationId)).toBeNull();

    // Create the token constant.
    const token = await plantVerificationToken(userId);

    // Create the verify res constant.
    const verifyRes = await withCsrf(agent, agent.post('/api/auth/verify-email')).send({
      // Contribute this line to the enclosing declaration or statement.
      token,
    });
    // Assert that the value matches the intended expectation.
    expect(verifyRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(verifyRes.body.data.user.emailVerified).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(await getReservationUserId(seeded.reservationId)).toBe(userId);

    // Create the reuse constant.
    const reuse = await withCsrf(agent, agent.post('/api/auth/verify-email')).send({
      // Contribute this line to the enclosing declaration or statement.
      token,
    });
    // Assert that the value matches the intended expectation.
    expect(reuse.status).toBe(400);
    // Assert that the value matches the intended expectation.
    expect(reuse.body.error.code).toBe('INVALID_TOKEN');
  });

  // Define a single test case and its expectations.
  test('unverified login does not claim; account endpoints stay denied until verify', async () => {
    // Create the email constant.
    const email = uniqueEmail('claim-full');
    // Create the password constant.
    const password = 'Customer123!';
    // Create the seeded constant.
    const seeded = await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: '2031-04-10',
      // Provide the return date field value.
      returnDate: '2031-04-14',
      // Provide the guest field value.
      guest: { email, fullName: 'Full Claim Guest' },
    });
    // Create the reservation id constant.
    const reservationId = seeded.reservationId;
    // Assert that the value matches the intended expectation.
    expect(seeded.orderId).toBeTruthy();
    // Wait until the asynchronous operation resolves.
    await assertGuestUnclaimed(reservationId);

    // Create the signup agent constant.
    const signupAgent = await createSessionAgent(app);
    // Create the signup res constant.
    const signupRes = await withCsrf(signupAgent, signupAgent.post('/api/auth/signup')).send({
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Contribute this line to the enclosing declaration or statement.
      password,
    });
    // Assert that the value matches the intended expectation.
    expect(signupRes.status).toBe(201);
    // Update signupAgent.csrfToken with the right-hand side value.
    signupAgent.csrfToken = signupRes.body.data?.csrfToken || signupAgent.csrfToken;
    // Create the user id constant.
    const userId = Number(signupRes.body.data.user.id);
    // Assert that the value matches the intended expectation.
    expect(signupRes.body.data.user.emailVerified).toBe(false);
    // Wait until the asynchronous operation resolves.
    await assertGuestUnclaimed(reservationId);

    // Wait until the asynchronous operation resolves.
    await withCsrf(signupAgent, signupAgent.post('/api/auth/logout')).expect(200);

    // Create the login agent constant.
    const loginAgent = await createSessionAgent(app);
    // Create the login res constant.
    const loginRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/login')).send({
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Contribute this line to the enclosing declaration or statement.
      password,
    });
    // Assert that the value matches the intended expectation.
    expect(loginRes.status).toBe(200);
    // Update loginAgent.csrfToken with the right-hand side value.
    loginAgent.csrfToken = loginRes.body.data?.csrfToken || loginAgent.csrfToken;
    // Assert that the value matches the intended expectation.
    expect(loginRes.body.data.user.emailVerified).toBe(false);
    // Wait until the asynchronous operation resolves.
    await assertGuestUnclaimed(reservationId);

    // Create the list res constant.
    const listRes = await loginAgent.get('/api/account/reservations').expect(200);
    // Assert that the value matches the intended expectation.
    expect(listRes.body.data.reservations).toEqual([]);

    // Create the detail res constant.
    const detailRes = await loginAgent.get(`/api/account/reservations/${reservationId}`);
    // Assert that the value matches the intended expectation.
    expect(detailRes.status).toBe(404);
    // Assert that the value matches the intended expectation.
    expect(detailRes.body.error.code).toBe('NOT_FOUND');

    // Create the travel res constant.
    const travelRes = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      loginAgent,
      // Call loginAgent.patch to perform this step.
      loginAgent.patch(`/api/account/reservations/${reservationId}/travel`)
    // Continue the surrounding logic with this statement.
    ).send({ flightNumber: 'ZZ999' });
    // Assert that the value matches the intended expectation.
    expect(travelRes.status).toBe(404);
    // Assert that the value matches the intended expectation.
    expect(travelRes.body.error.code).toBe('NOT_FOUND');

    // Create the cancel res constant.
    const cancelRes = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      loginAgent,
      // Call loginAgent.post to perform this step.
      loginAgent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    // Continue the surrounding logic with this statement.
    ).send({ reason: 'attacker cancel' });
    // Assert that the value matches the intended expectation.
    expect(cancelRes.status).toBe(404);
    // Assert that the value matches the intended expectation.
    expect(cancelRes.body.error.code).toBe('NOT_FOUND');

    // Create the pdf res constant.
    const pdfRes = await loginAgent.get(
      // Continue the surrounding logic with this statement.
      `/api/account/reservations/${reservationId}/pdf/invoice`
    );
    // Assert that the value matches the intended expectation.
    expect(pdfRes.status).toBe(404);
    // Assert that the value matches the intended expectation.
    expect(pdfRes.body.error.code).toBe('NOT_FOUND');

    // Create the token constant.
    const token = await plantVerificationToken(userId);
    // Create the verify res constant.
    const verifyRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/verify-email')).send({
      // Contribute this line to the enclosing declaration or statement.
      token,
    });
    // Assert that the value matches the intended expectation.
    expect(verifyRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(verifyRes.body.data.user.emailVerified).toBe(true);

    // Assert that the value matches the intended expectation.
    expect(await getReservationUserId(reservationId)).toBe(userId);
    // Assert that the value matches the intended expectation.
    expect(await getOrderUserId(reservationId)).toBe(userId);

    // Create the claimed detail constant.
    const claimedDetail = await loginAgent
      // Call .get to perform this step.
      .get(`/api/account/reservations/${reservationId}`)
      // Call .expect to perform this step.
      .expect(200);
    // Assert that the value matches the intended expectation.
    expect(claimedDetail.body.data.reservation.id).toBe(String(reservationId));
  });

  // Define a single test case and its expectations.
  test('legacy grandfather cleanup unclaims hijacked bookings until mailbox verify', async () => {
    // Create the email constant.
    const email = uniqueEmail('legacy-hijack');
    // Create the password constant.
    const password = 'Customer123!';
    // Create the seeded constant.
    const seeded = await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: '2031-05-10',
      // Provide the return date field value.
      returnDate: '2031-05-14',
      // Provide the guest field value.
      guest: { email, fullName: 'Legacy Hijack Guest' },
    });
    // Create the reservation id constant.
    const reservationId = seeded.reservationId;
    // Wait until the asynchronous operation resolves.
    await assertGuestUnclaimed(reservationId);

    // Create the password hash constant.
    const passwordHash = await bcrypt.hash(password, 10);
    // Simulate early-029 grandfather: email_verified_at = created_at, plus email claim.
    const userInsert = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO users (email, password, role, created_at, updated_at)
      VALUES ($1, $2, 'user', NOW(), NOW())
      RETURNING id
      `,
      // Contribute this line to the enclosing declaration or statement.
      [email, passwordHash]
    );
    // Create the user id constant.
    const userId = Number(userInsert.rows[0].id);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        UPDATE users
        SET email_verified_at = created_at, updated_at = NOW()
        WHERE id = $1
        `,
        // Contribute this line to the enclosing declaration or statement.
        [userId]
      );
      // Wait until the asynchronous operation resolves.
      await pool.query(`UPDATE reservations SET user_id = $1, updated_at = NOW() WHERE id = $2`, [
        // Contribute this line to the enclosing declaration or statement.
        userId,
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
      ]);
      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `UPDATE orders SET user_id = $1, updated_at = NOW() WHERE reservation_id = $2`,
        // Contribute this line to the enclosing declaration or statement.
        [userId, reservationId]
      );

      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(reservationId)).toBe(userId);
      // Assert that the value matches the intended expectation.
      expect(await getOrderUserId(reservationId)).toBe(userId);

      // Wait until the asynchronous operation resolves.
      await pool.query(LEGACY_CLEANUP_SQL);

      // Create the after cleanup constant.
      const afterCleanup = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT email_verified_at FROM users WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [userId]
      );
      // Assert that the value matches the intended expectation.
      expect(afterCleanup.rows[0].email_verified_at).toBeNull();
      // Wait until the asynchronous operation resolves.
      await assertGuestUnclaimed(reservationId);

      // Create the login agent constant.
      const loginAgent = await createSessionAgent(app);
      // Create the login res constant.
      const loginRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/login')).send({
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Contribute this line to the enclosing declaration or statement.
        password,
      });
      // Assert that the value matches the intended expectation.
      expect(loginRes.status).toBe(200);
      // Update loginAgent.csrfToken with the right-hand side value.
      loginAgent.csrfToken = loginRes.body.data?.csrfToken || loginAgent.csrfToken;
      // Assert that the value matches the intended expectation.
      expect(loginRes.body.data.user.emailVerified).toBe(false);
      // Wait until the asynchronous operation resolves.
      await assertGuestUnclaimed(reservationId);

      // Create the denied constant.
      const denied = await loginAgent.get(`/api/account/reservations/${reservationId}`);
      // Assert that the value matches the intended expectation.
      expect(denied.status).toBe(404);

      // Create the token constant.
      const token = await plantVerificationToken(userId);
      // Create the verify res constant.
      const verifyRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/verify-email')).send({
        // Contribute this line to the enclosing declaration or statement.
        token,
      });
      // Assert that the value matches the intended expectation.
      expect(verifyRes.status).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(verifyRes.body.data.user.emailVerified).toBe(true);
      // Assert that the value matches the intended expectation.
      expect(await getReservationUserId(reservationId)).toBe(userId);
      // Assert that the value matches the intended expectation.
      expect(await getOrderUserId(reservationId)).toBe(userId);

      // Wait until the asynchronous operation resolves.
      await loginAgent.get(`/api/account/reservations/${reservationId}`).expect(200);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await pool.query('UPDATE reservations SET user_id = NULL WHERE user_id = $1', [userId]);
      // Wait until the asynchronous operation resolves.
      await pool.query('UPDATE orders SET user_id = NULL WHERE user_id = $1', [userId]);
      // Wait until the asynchronous operation resolves.
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });
});
