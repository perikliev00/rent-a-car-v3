const crypto = require('crypto');
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
});
