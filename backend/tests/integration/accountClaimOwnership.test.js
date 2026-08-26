const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { createSessionAgent, loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  DEFAULT_ADMIN,
  insertIsolatedTestCar,
  insertLinkedBooking,
  insertTestAdmin,
  insertTestCustomer,
  deleteTestUser,
  getReservationOwner,
  getOrderOwnerByReservationId,
  getEmailVerifiedAt,
  getClaimTokenRow,
  countUsedClaimTokens,
  countUsedVerificationTokens,
  expireClaimTokens,
  ageVerificationTokens,
  cleanupTestCar,
} = require('./helpers/dbFixtures');
const {
  latestVerificationToken,
  latestClaimToken,
  clearMail,
} = require('./helpers/securityMail');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
const reservationClaimService = require('../../src/services/account/reservationClaimService');

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

const PASSWORD = 'Customer123!';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describeIf('P0-01/AUTH-01: guest booking ownership requires a claim token', () => {
  jest.setTimeout(120_000);

  let app;
  let carId;
  const createdUserIds = [];

  beforeAll(async () => {
    app = createIntegrationTestApp();
    carId = await insertIsolatedTestCar({ name: `Claim Ownership Car ${Date.now()}` });
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await deleteTestUser(userId);
    }
    await cleanupTestCar(carId);
  });

  beforeEach(() => {
    clearMail();
    loginAttemptService.resetForTests();
  });

  /**
   * Seeds an unowned guest booking (reservation + order, user_id NULL). Date blocks are
   * skipped so many bookings can share one car without tripping the availability
   * exclusion constraint; ownership is independent of availability.
   */
  async function seedGuestBooking(email, overrides = {}) {
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: false,
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      guest: { email, fullName: 'Guest Booker' },
      ...overrides,
    });

    expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();

    return seeded;
  }

  async function signup(email, password = PASSWORD) {
    const agent = await createSessionAgent(app);
    const res = await withCsrf(agent, agent.post('/api/auth/signup')).send({ email, password });
    expect(res.status).toBe(201);
    agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
    createdUserIds.push(Number(res.body.data.user.id));
    return { agent, body: res.body.data, userId: Number(res.body.data.user.id) };
  }

  async function login(email, password = PASSWORD) {
    const agent = await createSessionAgent(app);
    const res = await withCsrf(agent, agent.post('/api/auth/login')).send({ email, password });
    expect(res.status).toBe(200);
    agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
    return { agent, body: res.body.data };
  }

  async function verifyEmail(agent, token) {
    return withCsrf(agent, agent.post('/api/auth/verify-email')).send({ token });
  }

  async function claim(agent, reservationId, token) {
    return withCsrf(agent, agent.post(`/api/account/reservations/${reservationId}/claim`)).send({
      token,
    });
  }

  /** Signs up, verifies via the mailed token, and returns a fully verified session. */
  async function signupVerified(email) {
    const { agent, userId } = await signup(email);
    const token = latestVerificationToken(email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const verified = await verifyEmail(agent, token);
    expect(verified.status).toBe(200);
    expect(verified.body.data.emailVerified).toBe(true);
    return { agent, userId };
  }

  describe('signup and login claim nothing', () => {
    test('attacker signing up with the booking email gets no ownership', async () => {
      const bookingEmail = uniqueEmail('victim-booking');
      const seeded = await seedGuestBooking(bookingEmail);

      const { userId } = await signup(bookingEmail);

      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
      expect(await getEmailVerifiedAt(userId)).toBeNull();
    });

    test('logging in again claims nothing, even repeatedly', async () => {
      const bookingEmail = uniqueEmail('login-noclaim');
      const seeded = await seedGuestBooking(bookingEmail);

      const { userId } = await signup(bookingEmail);
      await login(bookingEmail);
      await login(bookingEmail);

      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
      expect(await getEmailVerifiedAt(userId)).toBeNull();
    });

    test('verifying the email alone still claims nothing', async () => {
      const bookingEmail = uniqueEmail('verified-noclaim');
      const seeded = await seedGuestBooking(bookingEmail);

      await signupVerified(bookingEmail);

      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
    });

    test('a different-case booking email is not claimed by signup either', async () => {
      const bookingEmail = uniqueEmail('Mixed-Case-Booking');
      const seeded = await seedGuestBooking(bookingEmail.toUpperCase());

      await signup(bookingEmail.toLowerCase());

      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
    });
  });

  describe('the account portal is fail-closed for unverified sessions', () => {
    let agent;
    let reservationId;

    beforeAll(async () => {
      const bookingEmail = uniqueEmail('portal-unverified');
      const seeded = await insertLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: false,
        pickupDate: '2031-08-01',
        returnDate: '2031-08-04',
        guest: { email: bookingEmail, fullName: 'Portal Guest' },
      });
      reservationId = seeded.reservationId;

      const created = await createSessionAgent(app);
      const res = await withCsrf(created, created.post('/api/auth/signup')).send({
        email: bookingEmail,
        password: PASSWORD,
      });
      expect(res.status).toBe(201);
      created.csrfToken = res.body.data?.csrfToken || created.csrfToken;
      createdUserIds.push(Number(res.body.data.user.id));
      agent = created;
    });

    test.each([
      ['dashboard', '/api/account/dashboard'],
      ['reservation list', '/api/account/reservations'],
      ['reservation detail', () => `/api/account/reservations/${reservationId}`],
      ['reservation pdf', () => `/api/account/reservations/${reservationId}/pdf/contract`],
      ['document list', '/api/account/documents'],
    ])('%s returns 403 EMAIL_VERIFICATION_REQUIRED', async (_label, path) => {
      const url = typeof path === 'function' ? path() : path;
      const res = await agent.get(url);

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    test('the claim endpoint itself is refused before verification', async () => {
      const issued = await reservationClaimService.issueClaimToken({
        reservationId,
        bookingEmail: uniqueEmail('unused'),
      });

      const res = await claim(agent, reservationId, issued.rawToken);

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(await getReservationOwner(reservationId)).toBeNull();
    });

    test('signup reports verificationRequired and /me keeps reporting it', async () => {
      const me = await agent.get('/api/auth/me');

      expect(me.status).toBe(200);
      expect(me.body.data.verificationRequired).toBe(true);
      expect(me.body.data.user.emailVerified).toBe(false);
    });
  });

  describe('verify, then claim with the mailed token', () => {
    test('links exactly the reservation and its order, and burns the token', async () => {
      const bookingEmail = uniqueEmail('happy-claim');
      const seeded = await seedGuestBooking(bookingEmail);
      const other = await seedGuestBooking(uniqueEmail('bystander'), {
        pickupDate: '2031-09-01',
        returnDate: '2031-09-04',
      });

      const { agent, userId } = await signupVerified(bookingEmail);
      await reservationClaimService.issueAndSendClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });
      const claimToken = latestClaimToken(bookingEmail);
      expect(claimToken).toMatch(/^[0-9a-f]{64}$/);

      const res = await claim(agent, seeded.reservationId, claimToken);

      expect(res.status).toBe(200);
      expect(res.body.data.claimed).toBe(true);
      expect(res.body.data.alreadyOwned).toBe(false);
      expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(userId);

      // Nothing else moved.
      expect(await getReservationOwner(other.reservationId)).toBeNull();
      expect(await getOrderOwnerByReservationId(other.reservationId)).toBeNull();

      const tokenRow = await getClaimTokenRow(seeded.reservationId);
      expect(tokenRow.used_at).not.toBeNull();
      expect(Number(tokenRow.used_by_user_id)).toBe(userId);
      // Only the hash is stored.
      expect(tokenRow.token_hash).not.toBe(claimToken);
      expect(tokenRow.token_hash).toHaveLength(64);

      const listed = await agent.get('/api/account/reservations');
      expect(listed.status).toBe(200);
      expect(
        listed.body.data.reservations.some(
          (r) => String(r.id) === String(seeded.reservationId)
        )
      ).toBe(true);
    });

    test('replaying the same token is idempotent for the owner', async () => {
      const bookingEmail = uniqueEmail('idempotent-claim');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2031-10-01',
        returnDate: '2031-10-04',
      });

      const { agent, userId } = await signupVerified(bookingEmail);
      await reservationClaimService.issueAndSendClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });
      const claimToken = latestClaimToken(bookingEmail);

      const first = await claim(agent, seeded.reservationId, claimToken);
      expect(first.status).toBe(200);

      const second = await claim(agent, seeded.reservationId, claimToken);
      expect(second.status).toBe(200);
      expect(second.body.data.alreadyOwned).toBe(true);

      expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
      expect(await countUsedClaimTokens(seeded.reservationId)).toBe(1);
    });

    test('booking email case and whitespace are normalized on both sides', async () => {
      const base = uniqueEmail('case-claim');
      const seeded = await seedGuestBooking(`  ${base.toUpperCase()} `, {
        pickupDate: '2031-11-01',
        returnDate: '2031-11-04',
      });

      const { agent, userId } = await signupVerified(base.toLowerCase());
      await reservationClaimService.issueAndSendClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail: `${base.toUpperCase()}  `,
      });
      const claimToken = latestClaimToken(base.toLowerCase());
      expect(claimToken).toBeTruthy();

      const res = await claim(agent, seeded.reservationId, claimToken);

      expect(res.status).toBe(200);
      expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    });
  });

  describe('claim rejection matrix', () => {
    test('a token minted for another booking email is refused', async () => {
      const bookingEmail = uniqueEmail('mismatch-booking');
      const attackerEmail = uniqueEmail('mismatch-attacker');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-01-01',
        returnDate: '2032-01-04',
      });

      const { agent } = await signupVerified(attackerEmail);
      const issued = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });

      const res = await claim(agent, seeded.reservationId, issued.rawToken);

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('CLAIM_TOKEN_INVALID');
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBeNull();
    });

    test('a token is bound to one reservation and cannot be replayed on another', async () => {
      const bookingEmail = uniqueEmail('bound-token');
      const owned = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-02-01',
        returnDate: '2032-02-04',
      });
      const target = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-03-01',
        returnDate: '2032-03-04',
      });

      const { agent } = await signupVerified(bookingEmail);
      const issued = await reservationClaimService.issueClaimToken({
        reservationId: owned.reservationId,
        bookingEmail,
      });

      const res = await claim(agent, target.reservationId, issued.rawToken);

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('CLAIM_TOKEN_INVALID');
      expect(await getReservationOwner(target.reservationId)).toBeNull();
      expect(await getReservationOwner(owned.reservationId)).toBeNull();
    });

    test('an expired token is refused', async () => {
      const bookingEmail = uniqueEmail('expired-token');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-04-01',
        returnDate: '2032-04-04',
      });

      const { agent } = await signupVerified(bookingEmail);
      const issued = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });
      await expireClaimTokens(seeded.reservationId);

      const res = await claim(agent, seeded.reservationId, issued.rawToken);

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('CLAIM_TOKEN_INVALID');
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    });

    test('issuing a new token revokes the previous one', async () => {
      const bookingEmail = uniqueEmail('revoked-token');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-05-01',
        returnDate: '2032-05-04',
      });

      const { agent, userId } = await signupVerified(bookingEmail);
      const stale = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });
      const fresh = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });

      const staleRes = await claim(agent, seeded.reservationId, stale.rawToken);
      expect(staleRes.status).toBe(400);
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();

      const freshRes = await claim(agent, seeded.reservationId, fresh.rawToken);
      expect(freshRes.status).toBe(200);
      expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    });

    test('a booking owned by someone else is never transferred', async () => {
      const ownerAccount = await insertTestCustomer({
        email: uniqueEmail('rightful-owner'),
        emailVerified: true,
      });
      createdUserIds.push(ownerAccount.userId);

      const seeded = await insertLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: false,
        pickupDate: '2032-06-01',
        returnDate: '2032-06-04',
        userId: ownerAccount.userId,
        guest: { email: ownerAccount.email, fullName: 'Rightful Owner' },
      });

      // Token is derived from the reservation email (owner), so a different verified
      // account cannot satisfy the triple-email check — and ownership is never moved.
      const attackerEmail = uniqueEmail('transfer-attacker');
      const { agent } = await signupVerified(attackerEmail);
      const issued = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
      });

      const res = await claim(agent, seeded.reservationId, issued.rawToken);

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('CLAIM_TOKEN_INVALID');
      expect(await getReservationOwner(seeded.reservationId)).toBe(ownerAccount.userId);
      expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(ownerAccount.userId);
    });

    test('a malformed token is rejected by validation', async () => {
      const bookingEmail = uniqueEmail('malformed-token');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-07-01',
        returnDate: '2032-07-04',
      });

      const { agent } = await signupVerified(bookingEmail);

      const res = await claim(agent, seeded.reservationId, 'not-a-token');

      expect([400, 422]).toContain(res.status);
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    });

    test('CSRF is still enforced on the claim endpoint', async () => {
      const bookingEmail = uniqueEmail('csrf-claim');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-08-01',
        returnDate: '2032-08-04',
      });

      const { agent } = await signupVerified(bookingEmail);
      const issued = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });

      const res = await agent
        .post(`/api/account/reservations/${seeded.reservationId}/claim`)
        .send({ token: issued.rawToken });

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('CSRF_INVALID');
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    });

    test('an anonymous caller cannot reach the claim endpoint', async () => {
      const bookingEmail = uniqueEmail('anon-claim');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-09-01',
        returnDate: '2032-09-04',
      });
      const issued = await reservationClaimService.issueClaimToken({
        reservationId: seeded.reservationId,
        bookingEmail,
      });

      const anon = await createSessionAgent(app);
      const res = await claim(anon, seeded.reservationId, issued.rawToken);

      expect(res.status).toBe(401);
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    });
  });

  describe('self-service claim link request', () => {
    test('mails a working link only to the booking email on the booking', async () => {
      const bookingEmail = uniqueEmail('request-link');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-10-01',
        returnDate: '2032-10-04',
      });

      const { agent, userId } = await signupVerified(bookingEmail);
      const requested = await withCsrf(
        agent,
        agent.post('/api/account/reservations/claim-request')
      ).send({ reservationId: String(seeded.reservationId), bookingEmail });

      expect(requested.status).toBe(200);
      expect(requested.body.data.requested).toBe(true);

      const token = latestClaimToken(bookingEmail);
      expect(token).toMatch(/^[0-9a-f]{64}$/);

      const claimed = await claim(agent, seeded.reservationId, token);
      expect(claimed.status).toBe(200);
      expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    });

    test('requesting a link for a booking with another email mails nothing', async () => {
      const bookingEmail = uniqueEmail('victim-request');
      const attackerEmail = uniqueEmail('attacker-request');
      const seeded = await seedGuestBooking(bookingEmail, {
        pickupDate: '2032-11-01',
        returnDate: '2032-11-04',
      });

      const { agent } = await signupVerified(attackerEmail);
      clearMail();

      const requested = await withCsrf(
        agent,
        agent.post('/api/account/reservations/claim-request')
      ).send({ reservationId: String(seeded.reservationId), bookingEmail });

      // Uniform success response, but nothing was issued or mailed.
      expect(requested.status).toBe(200);
      expect(requested.body.data.requested).toBe(true);
      expect(latestClaimToken(bookingEmail)).toBeNull();
      expect(latestClaimToken(attackerEmail)).toBeNull();
      expect(await getClaimTokenRow(seeded.reservationId)).toBeNull();
      expect(await getReservationOwner(seeded.reservationId)).toBeNull();
    });
  });

  describe('email verification lifecycle', () => {
    test('an unverified legacy login is mailed a fresh link that works', async () => {
      const email = uniqueEmail('legacy-login');
      const account = await insertTestCustomer({ email, emailVerified: false });
      createdUserIds.push(account.userId);
      clearMail();

      const { agent, body } = await login(email);
      expect(body.verificationRequired).toBe(true);

      const token = latestVerificationToken(email);
      expect(token).toMatch(/^[0-9a-f]{64}$/);

      const verified = await verifyEmail(agent, token);
      expect(verified.status).toBe(200);
      expect(await getEmailVerifiedAt(account.userId)).not.toBeNull();

      // The live session is upgraded without a re-login.
      const dashboard = await agent.get('/api/account/dashboard');
      expect(dashboard.status).toBe(200);
    });

    test('a verification token is consumed once and replaying it changes nothing', async () => {
      const email = uniqueEmail('single-use-verify');
      const { agent, userId } = await signup(email);
      const token = latestVerificationToken(email);

      const first = await verifyEmail(agent, token);
      expect(first.status).toBe(200);
      expect(first.body.data.alreadyVerified).toBe(false);

      // Replay is a deliberate no-op success for the owner rather than an error, but the
      // token itself is burned exactly once.
      const replay = await verifyEmail(agent, token);
      expect(replay.status).toBe(200);
      expect(replay.body.data.alreadyVerified).toBe(true);
      expect(await countUsedVerificationTokens(userId)).toBe(1);
    });

    test('a used token cannot verify a different account', async () => {
      const victimEmail = uniqueEmail('victim-verify');
      const attackerEmail = uniqueEmail('attacker-verify');

      const { agent: victim } = await signup(victimEmail);
      const victimToken = latestVerificationToken(victimEmail);
      expect((await verifyEmail(victim, victimToken)).status).toBe(200);

      const { agent: attacker, userId: attackerId } = await signup(attackerEmail);
      const replay = await verifyEmail(attacker, victimToken);

      // The response is the same no-op success, but it belongs to the victim's account and
      // must not upgrade the attacker's session or account.
      expect(replay.status).toBe(200);
      expect(await getEmailVerifiedAt(attackerId)).toBeNull();
      expect((await attacker.get('/api/account/dashboard')).status).toBe(403);
    });

    test('resend is throttled immediately after signup', async () => {
      const email = uniqueEmail('resend-throttled');
      const { agent } = await signup(email);
      clearMail();

      const resend = await withCsrf(agent, agent.post('/api/auth/verify-email/resend')).send({});

      // Generic success, but the cooldown means nothing new was mailed.
      expect(resend.status).toBe(200);
      expect(resend.body.data.requested).toBe(true);
      expect(latestVerificationToken(email)).toBeNull();
    });

    test('resending after the cooldown invalidates the previous link', async () => {
      const email = uniqueEmail('resend-verify');
      const { agent, userId } = await signup(email);
      const stale = latestVerificationToken(email);
      await ageVerificationTokens(userId, 600);
      clearMail();

      const resend = await withCsrf(agent, agent.post('/api/auth/verify-email/resend')).send({});
      expect(resend.status).toBe(200);

      const fresh = latestVerificationToken(email);
      expect(fresh).toMatch(/^[0-9a-f]{64}$/);
      expect(fresh).not.toBe(stale);

      const staleRes = await verifyEmail(agent, stale);
      expect(staleRes.status).toBe(400);
      expect(staleRes.body.error?.code || staleRes.body.code).toBe(
        'VERIFICATION_TOKEN_INVALID'
      );
      expect(await getEmailVerifiedAt(userId)).toBeNull();

      const freshRes = await verifyEmail(agent, fresh);
      expect(freshRes.status).toBe(200);
      expect(await getEmailVerifiedAt(userId)).not.toBeNull();
    });

    test('an unknown token is refused without revealing anything', async () => {
      const agent = await createSessionAgent(app);
      const res = await verifyEmail(agent, 'a'.repeat(64));

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('VERIFICATION_TOKEN_INVALID');
    });

    test('staff logins are unaffected and stay verified', async () => {
      // CI DBs are migrate-only; other suites seed admin in beforeEach — this one must too.
      await insertTestAdmin();
      const admin = await loginAsAdmin(app);
      const me = await admin.get('/api/auth/me');

      expect(me.status).toBe(200);
      expect(me.body.data.user.emailVerified).toBe(true);
      expect(me.body.data.verificationRequired).toBe(false);
      expect(me.body.data.user.email).toBe(DEFAULT_ADMIN.email);
    });
  });
});
