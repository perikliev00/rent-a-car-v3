/**
 * Prompt 1C integration proofs: upgrade-safe schema, lock order, soft-deleted
 * orders, post-commit delivery, token rotation, and real PG claim rollback.
 */
const fs = require('fs');
const path = require('path');
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { createSessionAgent, withCsrf } = require('./helpers/sessionAgentFactory');
const { pool } = require('../helpers/dbTestHarness');
const {
  insertIsolatedTestCar,
  insertLinkedBooking,
  insertTestCustomer,
  deleteTestUser,
  getReservationOwner,
  getOrderOwnerByReservationId,
  getClaimTokenRow,
  countActiveClaimTokens,
  countActiveVerificationTokens,
  softDeleteOrderByReservationId,
  setReservationStatus,
  setOrderOwnerByReservationId,
  cleanupTestCar,
  CUSTOMER_PASSWORD,
} = require('./helpers/dbFixtures');
const { clearMail, latestClaimToken, latestVerificationToken } = require('./helpers/securityMail');
const reservationClaimService = require('../../src/services/account/reservationClaimService');
const emailVerificationService = require('../../src/services/auth/emailVerificationService');
const orderAdminService = require('../../src/services/admin/order');
const securityEmail = require('../../src/services/email/securityEmailService');
const { applySchema } = require('../../sql/applySchema');
const { migrate } = require('../../sql/migrate');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
const { hashToken } = require('../../src/services/auth/tokenUtils');

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describeIf('Integration: Prompt 1C claim/token/deployment invariants', () => {
  jest.setTimeout(180_000);

  let app;
  let carId;
  const createdUserIds = [];

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: `1C Invariant Car ${Date.now()}` });
    loginAttemptService.resetForTests();
    clearMail();
    reservationClaimService.__clearTestHooks();
  });

  afterEach(async () => {
    reservationClaimService.__clearTestHooks();
    jest.restoreAllMocks();
    await cleanupTestCar(carId);
    while (createdUserIds.length > 0) {
      await deleteTestUser(createdUserIds.pop());
    }
  });

  async function verifiedSession(email) {
    const account = await insertTestCustomer({ email, emailVerified: true, password: CUSTOMER_PASSWORD });
    createdUserIds.push(account.userId);
    const agent = await createSessionAgent(app);
    const res = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: account.email, password: CUSTOMER_PASSWORD })
      .expect(200);
    agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
    return { agent, userId: account.userId, email: account.email };
  }

  test('applySchema then migrate cleans pre-030 duplicates and is re-runnable', async () => {
    const customer = await insertTestCustomer({
      email: uniqueEmail('upgrade'),
      emailVerified: false,
    });
    createdUserIds.push(customer.userId);

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-02-01',
      returnDate: '2035-02-04',
      guest: { email: customer.email, fullName: 'Upgrade Guest' },
    });

    await pool.query('DROP INDEX IF EXISTS idx_email_verification_tokens_one_active');
    await pool.query('DROP INDEX IF EXISTS idx_reservation_claim_tokens_one_active');

    const hashA = hashToken(`upgrade-a-${Date.now()}`);
    const hashB = hashToken(`upgrade-b-${Date.now()}`);
    const claimA = hashToken(`claim-a-${Date.now()}`);
    const claimB = hashToken(`claim-b-${Date.now()}`);

    await pool.query(
      `
      INSERT INTO email_verification_tokens (user_id, token_hash, email_hash, expires_at)
      VALUES
        ($1, $2, NULL, NOW() + interval '1 day'),
        ($1, $3, NULL, NOW() + interval '1 day')
      `,
      [customer.userId, hashA, hashB]
    );
    await pool.query(
      `
      INSERT INTO reservation_claim_tokens (reservation_id, token_hash, booking_email, expires_at)
      VALUES
        ($1, $2, $3, NOW() + interval '7 days'),
        ($1, $4, $3, NOW() + interval '7 days')
      `,
      [seeded.reservationId, claimA, customer.email, claimB]
    );

    await applySchema({ endPool: false });
    await migrate({ endPool: false });

    expect(await countActiveVerificationTokens(customer.userId)).toBeLessThanOrEqual(1);
    expect(await countActiveClaimTokens(seeded.reservationId)).toBeLessThanOrEqual(1);

    const unbound = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM email_verification_tokens
      WHERE user_id = $1
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND email_hash IS NULL
      `,
      [customer.userId]
    );
    expect(unbound.rows[0].count).toBe(0);

    const indexes = await pool.query(
      `
      SELECT indexname
      FROM pg_indexes
      WHERE indexname IN (
        'idx_email_verification_tokens_one_active',
        'idx_reservation_claim_tokens_one_active'
      )
      `
    );
    expect(indexes.rows.map((r) => r.indexname).sort()).toEqual([
      'idx_email_verification_tokens_one_active',
      'idx_reservation_claim_tokens_one_active',
    ]);

    await applySchema({ endPool: false });
    await migrate({ endPool: false });
  });

  test('cancelled+deleted unowned booking can be claimed atomically', async () => {
    const bookingEmail = uniqueEmail('cancel-del');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-03-01',
      returnDate: '2035-03-04',
      guest: { email: bookingEmail, fullName: 'Cancel Deleted' },
    });
    await setReservationStatus(seeded.reservationId, 'cancelled');
    await softDeleteOrderByReservationId(seeded.reservationId);

    const { agent, userId } = await verifiedSession(bookingEmail);
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    const res = await withCsrf(
      agent,
      agent.post(`/api/account/reservations/${seeded.reservationId}/claim`)
    )
      .send({ token: issued.rawToken })
      .expect(200);

    expect(res.body.data.claimed).toBe(true);
    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(userId);
  });

  test('cancelled+deleted foreign-owned order conflicts without writes', async () => {
    const bookingEmail = uniqueEmail('cancel-foreign');
    const other = await insertTestCustomer({
      email: uniqueEmail('other-owner'),
      emailVerified: true,
    });
    createdUserIds.push(other.userId);

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-03-10',
      returnDate: '2035-03-13',
      guest: { email: bookingEmail, fullName: 'Foreign Deleted' },
    });
    await setOrderOwnerByReservationId(seeded.reservationId, other.userId);
    await setReservationStatus(seeded.reservationId, 'cancelled');
    await softDeleteOrderByReservationId(seeded.reservationId);

    const { agent } = await verifiedSession(bookingEmail);
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });
    const tokenBefore = await getClaimTokenRow(seeded.reservationId);

    const res = await withCsrf(
      agent,
      agent.post(`/api/account/reservations/${seeded.reservationId}/claim`)
    ).send({ token: issued.rawToken });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(other.userId);
    const tokenAfter = await getClaimTokenRow(seeded.reservationId);
    expect(tokenAfter?.used_at).toBeNull();
    expect(String(tokenAfter?.id)).toBe(String(tokenBefore?.id));
  });

  test('refunded+deleted linked order is still claimed', async () => {
    const bookingEmail = uniqueEmail('refund-del');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-04-01',
      returnDate: '2035-04-04',
      guest: { email: bookingEmail, fullName: 'Refund Deleted' },
    });
    await setReservationStatus(seeded.reservationId, 'refunded');
    await softDeleteOrderByReservationId(seeded.reservationId);

    const { agent, userId } = await verifiedSession(bookingEmail);
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    await withCsrf(agent, agent.post(`/api/account/reservations/${seeded.reservationId}/claim`))
      .send({ token: issued.rawToken })
      .expect(200);

    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(userId);
  });

  test('mid-claim failure rolls back reservation, order, and token in PostgreSQL', async () => {
    const bookingEmail = uniqueEmail('pg-rollback');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-05-01',
      returnDate: '2035-05-04',
      guest: { email: bookingEmail, fullName: 'PG Rollback' },
    });
    const { userId } = await verifiedSession(bookingEmail);
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    reservationClaimService.__setTestHooks({
      afterReservationAssign: async () => {
        throw new Error('forced mid-claim failure');
      },
    });

    await expect(
      reservationClaimService.claimReservation({
        user: { id: userId, email: bookingEmail },
        reservationId: seeded.reservationId,
        rawToken: issued.rawToken,
      })
    ).rejects.toThrow(/forced mid-claim failure/);

    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
    const token = await getClaimTokenRow(seeded.reservationId);
    expect(token?.used_at).toBeNull();
    expect(token?.revoked_at).toBeNull();
  });

  test('admin email update delivers claim mail only after COMMIT and releases row locks', async () => {
    const bookingEmail = uniqueEmail('post-commit');
    const newEmail = uniqueEmail('post-commit-new');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-06-01',
      returnDate: '2035-06-04',
      guest: {
        email: bookingEmail,
        fullName: 'Post Commit',
        phoneNumber: '+359888111222',
        address: 'Street 1',
      },
    });

    let sawUnlockedReservation = false;
    const originalSend = securityEmail.sendReservationClaimEmail.bind(securityEmail);
    jest.spyOn(securityEmail, 'sendReservationClaimEmail').mockImplementation(async (args) => {
      const client = await pool.connect();
      try {
        await client.query('SELECT id FROM reservations WHERE id = $1 FOR UPDATE NOWAIT', [
          seeded.reservationId,
        ]);
        sawUnlockedReservation = true;
      } finally {
        client.release();
      }
      return originalSend(args);
    });

    const order = await pool.query('SELECT * FROM orders WHERE reservation_id = $1', [
      seeded.reservationId,
    ]);
    const orderRow = order.rows[0];

    const result = await orderAdminService.updateOrder(orderRow.id, {
      carId: String(carId),
      pickupDate: '2035-06-01',
      pickupTime: orderRow.pickup_time || '10:00',
      returnDate: '2035-06-04',
      returnTime: orderRow.return_time || '10:00',
      pickupLocation: orderRow.pickup_location || 'office',
      returnLocation: orderRow.return_location || 'office',
      fullName: orderRow.full_name,
      phoneNumber: orderRow.phone_number,
      email: newEmail,
      address: orderRow.address || 'Street 1',
      hotelName: orderRow.hotel_name || '',
    });

    expect(result.success).toBe(true);
    expect(sawUnlockedReservation).toBe(true);
    expect(latestClaimToken(newEmail)).toMatch(/^[0-9a-f]{64}$/i);
    expect(await countActiveClaimTokens(seeded.reservationId)).toBe(1);
  });

  test('claim ‖ admin order email update finish without deadlock', async () => {
    const bookingEmail = uniqueEmail('lock-race');
    const newEmail = uniqueEmail('lock-race-new');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-07-01',
      returnDate: '2035-07-04',
      guest: {
        email: bookingEmail,
        fullName: 'Lock Race',
        phoneNumber: '+359888333444',
        address: 'Street 2',
      },
    });

    const { agent, userId } = await verifiedSession(bookingEmail);
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    const order = await pool.query('SELECT * FROM orders WHERE reservation_id = $1', [
      seeded.reservationId,
    ]);
    const orderRow = order.rows[0];

    const claimPromise = withCsrf(
      agent,
      agent.post(`/api/account/reservations/${seeded.reservationId}/claim`)
    ).send({ token: issued.rawToken });

    const adminPromise = orderAdminService.updateOrder(orderRow.id, {
      carId: String(carId),
      pickupDate: '2035-07-01',
      pickupTime: orderRow.pickup_time || '10:00',
      returnDate: '2035-07-04',
      returnTime: orderRow.return_time || '10:00',
      pickupLocation: orderRow.pickup_location || 'office',
      returnLocation: orderRow.return_location || 'office',
      fullName: orderRow.full_name,
      phoneNumber: orderRow.phone_number,
      email: newEmail,
      address: orderRow.address || 'Street 2',
      hotelName: orderRow.hotel_name || '',
    });

    const [claimRes, adminRes] = await Promise.all([claimPromise, adminPromise]);

    expect(adminRes.success).toBe(true);
    expect([200, 409, 400, 422].includes(claimRes.status) || claimRes.status < 500).toBe(true);
    expect(claimRes.status).not.toBe(500);

    const reservationEmail = (
      await pool.query('SELECT email FROM reservations WHERE id = $1', [seeded.reservationId])
    ).rows[0].email;
    const owner = await getReservationOwner(seeded.reservationId);
    if (owner != null) {
      expect(owner).toBe(userId);
      expect(String(reservationEmail).toLowerCase()).toBe(bookingEmail.toLowerCase());
    } else {
      expect(String(reservationEmail).toLowerCase()).toBe(newEmail.toLowerCase());
    }
  });

  test('concurrent claim-token issue leaves one active and final link works', async () => {
    const bookingEmail = uniqueEmail('rot-claim');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-08-01',
      returnDate: '2035-08-04',
      guest: { email: bookingEmail, fullName: 'Rotate Claim' },
    });

    await Promise.all([
      reservationClaimService.issueAndSendClaimToken({ reservationId: seeded.reservationId }),
      reservationClaimService.issueAndSendClaimToken({ reservationId: seeded.reservationId }),
      reservationClaimService.issueAndSendClaimToken({ reservationId: seeded.reservationId }),
    ]);

    expect(await countActiveClaimTokens(seeded.reservationId)).toBe(1);
    const token = latestClaimToken(bookingEmail);
    expect(token).toMatch(/^[0-9a-f]{64}$/i);

    const { agent, userId } = await verifiedSession(bookingEmail);
    await withCsrf(agent, agent.post(`/api/account/reservations/${seeded.reservationId}/claim`))
      .send({ token })
      .expect(200);
    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
  });

  test('concurrent verification issue leaves one active and final link works', async () => {
    const email = uniqueEmail('rot-verify');
    const account = await insertTestCustomer({ email, emailVerified: false });
    createdUserIds.push(account.userId);
    const user = { id: account.userId, email: account.email, emailVerified: false };

    await Promise.all([
      emailVerificationService.issueAndSendVerification(user),
      emailVerificationService.issueAndSendVerification(user),
      emailVerificationService.issueAndSendVerification(user, { resend: true }),
    ]);

    expect(await countActiveVerificationTokens(account.userId)).toBe(1);
    const token = latestVerificationToken(account.email);
    expect(token).toMatch(/^[0-9a-f]{64}$/i);

    const result = await emailVerificationService.verifyToken(token);
    expect(result.outcome).toBe('verified');
  });

  test('SMTP failure on claim rotation restores prior usable token', async () => {
    const bookingEmail = uniqueEmail('smtp-comp');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-09-01',
      returnDate: '2035-09-04',
      guest: { email: bookingEmail, fullName: 'SMTP Comp' },
    });

    await reservationClaimService.issueAndSendClaimToken({ reservationId: seeded.reservationId });
    const prior = await getClaimTokenRow(seeded.reservationId);
    const priorToken = latestClaimToken(bookingEmail);
    clearMail();

    jest
      .spyOn(securityEmail, 'sendReservationClaimEmail')
      .mockResolvedValue({ sent: false, reason: 'smtp_not_configured' });

    const result = await reservationClaimService.issueAndSendClaimToken({
      reservationId: seeded.reservationId,
    });
    expect(result.sent).toBe(false);

    const active = await pool.query(
      `
      SELECT id, revoked_at, used_at
      FROM reservation_claim_tokens
      WHERE reservation_id = $1
        AND used_at IS NULL
        AND revoked_at IS NULL
      ORDER BY id DESC
      LIMIT 1
      `,
      [seeded.reservationId]
    );
    expect(String(active.rows[0].id)).toBe(String(prior.id));
    expect(active.rows[0].revoked_at).toBeNull();

    const { agent, userId } = await verifiedSession(bookingEmail);
    await withCsrf(agent, agent.post(`/api/account/reservations/${seeded.reservationId}/claim`))
      .send({ token: priorToken })
      .expect(200);
    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
  });

  test('mismatched used_by_user_id is not ALREADY_OWNED', async () => {
    const bookingEmail = uniqueEmail('used-by');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2035-10-01',
      returnDate: '2035-10-04',
      guest: { email: bookingEmail, fullName: 'Used By' },
    });
    const owner = await insertTestCustomer({
      email: bookingEmail,
      emailVerified: true,
    });
    createdUserIds.push(owner.userId);
    const other = await insertTestCustomer({
      email: uniqueEmail('used-by-other'),
      emailVerified: true,
    });
    createdUserIds.push(other.userId);

    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });
    await pool.query(
      `
      UPDATE reservations SET user_id = $2 WHERE id = $1
      `,
      [seeded.reservationId, owner.userId]
    );
    await pool.query(
      `
      UPDATE orders SET user_id = $2 WHERE reservation_id = $1
      `,
      [seeded.reservationId, owner.userId]
    );
    await pool.query(
      `
      UPDATE reservation_claim_tokens
      SET used_at = NOW(), used_by_user_id = $2
      WHERE reservation_id = $1 AND revoked_at IS NULL
      `,
      [seeded.reservationId, other.userId]
    );

    const result = await reservationClaimService.claimReservation({
      user: { id: owner.userId, email: bookingEmail },
      reservationId: seeded.reservationId,
      rawToken: issued.rawToken,
    });
    expect(result.outcome).toBe('invalid_token');
  });
});

describeIf('Integration: compose prod config smoke helper', () => {
  test('smoke script exists and documents required placeholders', () => {
    const scriptPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'scripts',
      'smoke-compose-prod-config.js'
    );
    expect(fs.existsSync(scriptPath)).toBe(true);
    const body = fs.readFileSync(scriptPath, 'utf8');
    expect(body).toContain("compose', '-f', 'docker-compose.prod.yml', 'config'");
    expect(body).toContain('EMAIL_ENABLED');
    expect(body).toContain('SMTP_HOST');
  });
});
