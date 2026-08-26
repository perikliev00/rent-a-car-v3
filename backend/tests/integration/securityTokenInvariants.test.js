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
  getEmailVerifiedAt,
  getClaimTokenRow,
  countUsedClaimTokens,
  countActiveClaimTokens,
  countActiveVerificationTokens,
  setOrderOwnerByReservationId,
  setReservationEmail,
  cleanupTestCar,
  getRoleBySlug,
} = require('./helpers/dbFixtures');
const { clearMail } = require('./helpers/securityMail');
const reservationClaimService = require('../../src/services/account/reservationClaimService');
const emailVerificationService = require('../../src/services/auth/emailVerificationService');
const userAdminService = require('../../src/services/admin/userAdminService');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;
const PASSWORD = 'ClaimOwner123!';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describeIf('Integration: security token invariants', () => {
  jest.setTimeout(120_000);

  let app;
  let carId;
  const createdUserIds = [];

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: `Token Invariant Car ${Date.now()}` });
    loginAttemptService.resetForTests();
    clearMail();
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    while (createdUserIds.length > 0) {
      await deleteTestUser(createdUserIds.pop());
    }
  });

  async function verifiedSession(email) {
    const account = await insertTestCustomer({ email, emailVerified: true, password: PASSWORD });
    createdUserIds.push(account.userId);
    const agent = await createSessionAgent(app);
    const res = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: account.email, password: PASSWORD })
      .expect(200);
    agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
    return { agent, userId: account.userId, email: account.email };
  }

  function claim(agent, reservationId, token) {
    return withCsrf(agent, agent.post(`/api/account/reservations/${reservationId}/claim`)).send({
      token,
    });
  }

  test('order belonging to another user is not claimed and nothing changes', async () => {
    const bookingEmail = uniqueEmail('foreign-order');
    const other = await insertTestCustomer({
      email: uniqueEmail('other-owner'),
      emailVerified: true,
    });
    createdUserIds.push(other.userId);

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2034-01-01',
      returnDate: '2034-01-04',
      guest: { email: bookingEmail, fullName: 'Foreign Order' },
    });
    await setOrderOwnerByReservationId(seeded.reservationId, other.userId);

    const { agent } = await verifiedSession(bookingEmail);
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });
    const tokenRowBefore = await getClaimTokenRow(seeded.reservationId);

    const res = await claim(agent, seeded.reservationId, issued.rawToken);

    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('CLAIM_CONFLICT');
    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(other.userId);
    expect(await countUsedClaimTokens(seeded.reservationId)).toBe(0);
    const tokenRowAfter = await getClaimTokenRow(seeded.reservationId);
    expect(tokenRowAfter.used_at).toBeNull();
    expect(String(tokenRowAfter.id)).toBe(String(tokenRowBefore.id));
  });

  test('a token email that differs from the current reservation email cannot change ownership', async () => {
    const bookingEmail = uniqueEmail('token-email');
    const { agent } = await verifiedSession(bookingEmail);
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2034-02-01',
      returnDate: '2034-02-04',
      guest: { email: bookingEmail, fullName: 'Email Drift' },
    });
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });
    await setReservationEmail(seeded.reservationId, uniqueEmail('changed-booking'));

    const res = await claim(agent, seeded.reservationId, issued.rawToken);

    expect(res.status).toBe(400);
    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
  });

  test('changing the reservation email after issuance invalidates the old token', async () => {
    const bookingEmail = uniqueEmail('before-change');
    const { agent } = await verifiedSession(bookingEmail);
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2034-03-01',
      returnDate: '2034-03-04',
      guest: { email: bookingEmail, fullName: 'Before Change' },
    });
    const stale = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    await setReservationEmail(seeded.reservationId, uniqueEmail('after-change'));
    await reservationClaimService.onBookingEmailChanged(seeded.reservationId);

    const staleRes = await claim(agent, seeded.reservationId, stale.rawToken);
    expect(staleRes.status).toBe(400);
    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await countUsedClaimTokens(seeded.reservationId)).toBe(0);
  });

  test('stale session verification state cannot authorize a claim', async () => {
    const bookingEmail = uniqueEmail('stale-session');
    const { agent, userId } = await verifiedSession(bookingEmail);
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2034-04-01',
      returnDate: '2034-04-04',
      guest: { email: bookingEmail, fullName: 'Stale Session' },
    });
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    await pool.query('UPDATE users SET email_verified_at = NULL WHERE id = $1', [userId]);

    const res = await claim(agent, seeded.reservationId, issued.rawToken);

    expect(res.status).toBe(400);
    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await getEmailVerifiedAt(userId)).toBeNull();
  });

  test('a verification token for email A cannot verify email B after mutation', async () => {
    const emailA = uniqueEmail('verify-a');
    const emailB = uniqueEmail('verify-b');
    const account = await insertTestCustomer({ email: emailA, emailVerified: false });
    createdUserIds.push(account.userId);

    const issued = await emailVerificationService.issueToken({
      id: String(account.userId),
      email: emailA,
      emailVerified: false,
    });

    await pool.query('UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1', [
      account.userId,
      emailB,
    ]);

    const agent = await createSessionAgent(app);
    const csrf = await agent.get('/api/auth/csrf');
    agent.csrfToken = csrf.body.data?.csrfToken;
    const res = await withCsrf(agent, agent.post('/api/auth/verify-email')).send({
      token: issued.rawToken,
    });

    expect(res.status).toBe(400);
    expect(await getEmailVerifiedAt(account.userId)).toBeNull();
  });

  test('parallel verification-token issuance leaves exactly one active token', async () => {
    const email = uniqueEmail('verify-parallel');
    const account = await insertTestCustomer({ email, emailVerified: false });
    createdUserIds.push(account.userId);
    const user = { id: String(account.userId), email, emailVerified: false };

    await Promise.all([
      emailVerificationService.issueToken(user),
      emailVerificationService.issueToken(user),
      emailVerificationService.issueToken(user),
    ]);

    expect(await countActiveVerificationTokens(account.userId)).toBe(1);
  });

  test('new staff are created verified', async () => {
    const role = await getRoleBySlug('driver');
    expect(role).toBeTruthy();
    const email = uniqueEmail('new-staff');

    const staff = await userAdminService.createStaffUser({
      email,
      password: 'StaffCreate123!',
      roleIds: [role.id],
    });
    createdUserIds.push(Number(staff.id));

    expect(await getEmailVerifiedAt(staff.id)).toBeTruthy();
  });

  test('updateStaffUser cannot mutate a customer account', async () => {
    const customer = await insertTestCustomer({
      email: uniqueEmail('customer-mutate'),
      emailVerified: true,
    });
    createdUserIds.push(customer.userId);

    await expect(
      userAdminService.updateStaffUser(customer.userId, {
        email: uniqueEmail('hijacked-staff'),
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    const row = await pool.query('SELECT email, role FROM users WHERE id = $1', [customer.userId]);
    expect(row.rows[0].role).toBe('user');
    expect(row.rows[0].email).toBe(customer.email);
  });

  test('a hold without an order can be claimed', async () => {
    const bookingEmail = uniqueEmail('hold-no-order');
    const { agent, userId } = await verifiedSession(bookingEmail);
    const seeded = await insertLinkedBooking({
      carId,
      status: 'pending_payment',
      withOrder: false,
      withBlock: false,
      pickupDate: '2034-05-01',
      returnDate: '2034-05-04',
      guest: { email: bookingEmail, fullName: 'Hold Guest' },
    });
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    const res = await claim(agent, seeded.reservationId, issued.rawToken);

    expect(res.status).toBe(200);
    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeUndefined();
  });

  test('a confirmed reservation missing its order fails closed', async () => {
    const bookingEmail = uniqueEmail('confirmed-no-order');
    const { agent } = await verifiedSession(bookingEmail);
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      withOrder: false,
      withBlock: false,
      pickupDate: '2034-06-01',
      returnDate: '2034-06-04',
      guest: { email: bookingEmail, fullName: 'Broken Confirmed' },
    });
    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    const res = await claim(agent, seeded.reservationId, issued.rawToken);

    expect(res.status).toBe(500);
    expect(res.body.error?.code || res.body.code).toBe('CLAIM_INTEGRITY_ERROR');
    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await countUsedClaimTokens(seeded.reservationId)).toBe(0);
    expect(await countActiveClaimTokens(seeded.reservationId)).toBe(1);
  });
});
