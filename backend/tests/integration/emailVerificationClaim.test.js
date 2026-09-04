const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { createSessionAgent, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  insertLinkedBooking,
} = require('./helpers/dbFixtures');
const { pool } = require('../helpers/dbTestHarness');
const {
  hashEmailVerificationToken,
} = require('../../src/services/auth/emailVerificationService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

const LEGACY_CLEANUP_SQL = fs.readFileSync(
  path.join(__dirname, '../../migrations/033_email_verification_legacy_cleanup.sql'),
  'utf8'
);

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function getReservationUserId(reservationId) {
  const result = await pool.query(`SELECT user_id FROM reservations WHERE id = $1`, [
    reservationId,
  ]);
  const value = result.rows[0]?.user_id;
  return value == null ? null : Number(value);
}

async function getOrderUserId(reservationId) {
  const result = await pool.query(
    `
    SELECT user_id FROM orders
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [reservationId]
  );
  const value = result.rows[0]?.user_id;
  return value == null ? null : Number(value);
}

async function assertGuestUnclaimed(reservationId) {
  expect(await getReservationUserId(reservationId)).toBeNull();
  expect(await getOrderUserId(reservationId)).toBeNull();
}

async function plantVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashEmailVerificationToken(token);
  await pool.query(
    `
    UPDATE users
    SET
      email_verification_token_hash = $2,
      email_verification_expires_at = NOW() + INTERVAL '1 day'
    WHERE id = $1
    `,
    [userId, tokenHash]
  );
  return token;
}

describeIf('email verification booking claim', () => {
  jest.setTimeout(60_000);

  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    carId = await insertIsolatedTestCar({ name: `Email verify claim ${Date.now()}` });
  });

  afterAll(async () => {
    if (carId) {
      await cleanupTestCar(carId);
    }
  });

  test('signup does not claim guest bookings until the email is verified', async () => {
    const email = uniqueEmail('claim-verify');
    const password = 'Customer123!';
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      guest: { email, fullName: 'Claim Guest' },
    });

    expect(await getReservationUserId(seeded.reservationId)).toBeNull();

    const agent = await createSessionAgent(app);
    const signupRes = await withCsrf(agent, agent.post('/api/auth/signup')).send({
      email,
      password,
    });
    expect(signupRes.status).toBe(201);
    agent.csrfToken = signupRes.body.data?.csrfToken || agent.csrfToken;
    const userId = Number(signupRes.body.data.user.id);
    expect(signupRes.body.data.user.emailVerified).toBe(false);

    expect(await getReservationUserId(seeded.reservationId)).toBeNull();

    const token = await plantVerificationToken(userId);

    const verifyRes = await withCsrf(agent, agent.post('/api/auth/verify-email')).send({
      token,
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.emailVerified).toBe(true);
    expect(await getReservationUserId(seeded.reservationId)).toBe(userId);

    const reuse = await withCsrf(agent, agent.post('/api/auth/verify-email')).send({
      token,
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_TOKEN');
  });

  test('unverified login does not claim; account endpoints stay denied until verify', async () => {
    const email = uniqueEmail('claim-full');
    const password = 'Customer123!';
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2031-04-10',
      returnDate: '2031-04-14',
      guest: { email, fullName: 'Full Claim Guest' },
    });
    const reservationId = seeded.reservationId;
    expect(seeded.orderId).toBeTruthy();
    await assertGuestUnclaimed(reservationId);

    const signupAgent = await createSessionAgent(app);
    const signupRes = await withCsrf(signupAgent, signupAgent.post('/api/auth/signup')).send({
      email,
      password,
    });
    expect(signupRes.status).toBe(201);
    signupAgent.csrfToken = signupRes.body.data?.csrfToken || signupAgent.csrfToken;
    const userId = Number(signupRes.body.data.user.id);
    expect(signupRes.body.data.user.emailVerified).toBe(false);
    await assertGuestUnclaimed(reservationId);

    await withCsrf(signupAgent, signupAgent.post('/api/auth/logout')).expect(200);

    const loginAgent = await createSessionAgent(app);
    const loginRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/login')).send({
      email,
      password,
    });
    expect(loginRes.status).toBe(200);
    loginAgent.csrfToken = loginRes.body.data?.csrfToken || loginAgent.csrfToken;
    expect(loginRes.body.data.user.emailVerified).toBe(false);
    await assertGuestUnclaimed(reservationId);

    const listRes = await loginAgent.get('/api/account/reservations').expect(200);
    expect(listRes.body.data.reservations).toEqual([]);

    const detailRes = await loginAgent.get(`/api/account/reservations/${reservationId}`);
    expect(detailRes.status).toBe(404);
    expect(detailRes.body.error.code).toBe('NOT_FOUND');

    const travelRes = await withCsrf(
      loginAgent,
      loginAgent.patch(`/api/account/reservations/${reservationId}/travel`)
    ).send({ flightNumber: 'ZZ999' });
    expect(travelRes.status).toBe(404);
    expect(travelRes.body.error.code).toBe('NOT_FOUND');

    const cancelRes = await withCsrf(
      loginAgent,
      loginAgent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    ).send({ reason: 'attacker cancel' });
    expect(cancelRes.status).toBe(404);
    expect(cancelRes.body.error.code).toBe('NOT_FOUND');

    const pdfRes = await loginAgent.get(
      `/api/account/reservations/${reservationId}/pdf/invoice`
    );
    expect(pdfRes.status).toBe(404);
    expect(pdfRes.body.error.code).toBe('NOT_FOUND');

    const token = await plantVerificationToken(userId);
    const verifyRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/verify-email')).send({
      token,
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.emailVerified).toBe(true);

    expect(await getReservationUserId(reservationId)).toBe(userId);
    expect(await getOrderUserId(reservationId)).toBe(userId);

    const claimedDetail = await loginAgent
      .get(`/api/account/reservations/${reservationId}`)
      .expect(200);
    expect(claimedDetail.body.data.reservation.id).toBe(String(reservationId));
  });

  test('legacy grandfather cleanup unclaims hijacked bookings until mailbox verify', async () => {
    const email = uniqueEmail('legacy-hijack');
    const password = 'Customer123!';
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2031-05-10',
      returnDate: '2031-05-14',
      guest: { email, fullName: 'Legacy Hijack Guest' },
    });
    const reservationId = seeded.reservationId;
    await assertGuestUnclaimed(reservationId);

    const passwordHash = await bcrypt.hash(password, 10);
    // Simulate early-029 grandfather: email_verified_at = created_at, plus email claim.
    const userInsert = await pool.query(
      `
      INSERT INTO users (email, password, role, created_at, updated_at)
      VALUES ($1, $2, 'user', NOW(), NOW())
      RETURNING id
      `,
      [email, passwordHash]
    );
    const userId = Number(userInsert.rows[0].id);

    try {
      await pool.query(
        `
        UPDATE users
        SET email_verified_at = created_at, updated_at = NOW()
        WHERE id = $1
        `,
        [userId]
      );
      await pool.query(`UPDATE reservations SET user_id = $1, updated_at = NOW() WHERE id = $2`, [
        userId,
        reservationId,
      ]);
      await pool.query(
        `UPDATE orders SET user_id = $1, updated_at = NOW() WHERE reservation_id = $2`,
        [userId, reservationId]
      );

      expect(await getReservationUserId(reservationId)).toBe(userId);
      expect(await getOrderUserId(reservationId)).toBe(userId);

      await pool.query(LEGACY_CLEANUP_SQL);

      const afterCleanup = await pool.query(
        `SELECT email_verified_at FROM users WHERE id = $1`,
        [userId]
      );
      expect(afterCleanup.rows[0].email_verified_at).toBeNull();
      await assertGuestUnclaimed(reservationId);

      const loginAgent = await createSessionAgent(app);
      const loginRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/login')).send({
        email,
        password,
      });
      expect(loginRes.status).toBe(200);
      loginAgent.csrfToken = loginRes.body.data?.csrfToken || loginAgent.csrfToken;
      expect(loginRes.body.data.user.emailVerified).toBe(false);
      await assertGuestUnclaimed(reservationId);

      const denied = await loginAgent.get(`/api/account/reservations/${reservationId}`);
      expect(denied.status).toBe(404);

      const token = await plantVerificationToken(userId);
      const verifyRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/verify-email')).send({
        token,
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.user.emailVerified).toBe(true);
      expect(await getReservationUserId(reservationId)).toBe(userId);
      expect(await getOrderUserId(reservationId)).toBe(userId);

      await loginAgent.get(`/api/account/reservations/${reservationId}`).expect(200);
    } finally {
      await pool.query('UPDATE reservations SET user_id = NULL WHERE user_id = $1', [userId]);
      await pool.query('UPDATE orders SET user_id = NULL WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });
});
