const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const { createSessionAgent, withCsrf } = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertLinkedBooking,
  insertTestCustomer,
  deleteTestUser,
  getReservationOwner,
  getOrderOwnerByReservationId,
  countUsedClaimTokens,
  cleanupTestCar,
  CUSTOMER_PASSWORD,
} = require('../helpers/dbFixtures');
const reservationClaimService = require('../../../src/services/account/reservationClaimService');
const claimTokenSql = require('../../../src/services/sql/reservationClaimTokenSqlService');
const { generateRawToken, hashToken } = require('../../../src/services/auth/tokenUtils');
const loginAttemptService = require('../../../src/services/auth/loginAttemptService');

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describeIf('Concurrency integration: claimRace', () => {
  jest.setTimeout(120_000);

  let app;
  let carId;
  const createdUserIds = [];

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: `Claim Race Car ${Date.now()}` });
    loginAttemptService.resetForTests();
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    while (createdUserIds.length > 0) {
      await deleteTestUser(createdUserIds.pop());
    }
  });

  async function verifiedAgent(email) {
    const account = await insertTestCustomer({ email, emailVerified: true });
    createdUserIds.push(account.userId);

    const agent = await createSessionAgent(app);
    const res = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: account.email, password: CUSTOMER_PASSWORD })
      .expect(200);
    agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;

    return { agent, userId: account.userId, email: account.email };
  }

  function postClaim(agent, reservationId, token) {
    return withCsrf(agent, agent.post(`/api/account/reservations/${reservationId}/claim`)).send({
      token,
    });
  }

  test('two accounts racing distinct tokens leave exactly one owner', async () => {
    const emailA = uniqueEmail('race-a');
    const emailB = uniqueEmail('race-b');

    const a = await verifiedAgent(emailA);
    const b = await verifiedAgent(emailB);

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2033-01-01',
      returnDate: '2033-01-04',
      guest: { email: emailA, fullName: 'Race Guest' },
    });

    // Issuing through the service would revoke the first token, so both are inserted
    // directly: the point of this test is the reservation-level race, with every other
    // check already satisfied for both callers.
    const rawA = generateRawToken();
    const rawB = generateRawToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await claimTokenSql.insertToken({
      reservationId: seeded.reservationId,
      tokenHash: hashToken(rawA),
      bookingEmail: emailA,
      expiresAt,
    });
    await claimTokenSql.insertToken({
      reservationId: seeded.reservationId,
      tokenHash: hashToken(rawB),
      bookingEmail: emailB,
      expiresAt,
    });

    const [resA, resB] = await Promise.all([
      postClaim(a.agent, seeded.reservationId, rawA),
      postClaim(b.agent, seeded.reservationId, rawB),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winnerIsA = resA.status === 200;
    const loser = winnerIsA ? resB : resA;
    expect(loser.body.error.code).toBe('CLAIM_CONFLICT');

    const owner = await getReservationOwner(seeded.reservationId);
    expect(owner).toBe(winnerIsA ? a.userId : b.userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(owner);
    expect(await countUsedClaimTokens(seeded.reservationId)).toBe(1);
  });

  test('the same token submitted twice in parallel is consumed once', async () => {
    const email = uniqueEmail('race-same-token');
    const { userId } = await verifiedAgent(email);

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2033-02-01',
      returnDate: '2033-02-04',
      guest: { email, fullName: 'Race Same Token' },
    });

    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
      bookingEmail: email,
    });

    // Two independent sessions for the same account, so both requests are legitimate and
    // the serialization has to come from the token lock rather than from the session.
    const first = await createSessionAgent(app);
    const firstLogin = await withCsrf(first, first.post('/api/auth/login'))
      .send({ email, password: CUSTOMER_PASSWORD })
      .expect(200);
    first.csrfToken = firstLogin.body.data?.csrfToken || first.csrfToken;

    const second = await createSessionAgent(app);
    const secondLogin = await withCsrf(second, second.post('/api/auth/login'))
      .send({ email, password: CUSTOMER_PASSWORD })
      .expect(200);
    second.csrfToken = secondLogin.body.data?.csrfToken || second.csrfToken;

    const results = await Promise.all([
      postClaim(first, seeded.reservationId, issued.rawToken),
      postClaim(second, seeded.reservationId, issued.rawToken),
    ]);

    // Both are the rightful owner, so both succeed; the token is still burned only once.
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(userId);
    expect(await countUsedClaimTokens(seeded.reservationId)).toBe(1);
  });
});
