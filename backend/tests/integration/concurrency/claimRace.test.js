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
  countActiveClaimTokens,
  cleanupTestCar,
  CUSTOMER_PASSWORD,
} = require('../helpers/dbFixtures');
const reservationClaimService = require('../../../src/services/account/reservationClaimService');
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

  test('a wrong-email account can never win a claim race', async () => {
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

    const issued = await reservationClaimService.issueClaimToken({
      reservationId: seeded.reservationId,
    });

    const [resA, resB] = await Promise.all([
      postClaim(a.agent, seeded.reservationId, issued.rawToken),
      postClaim(b.agent, seeded.reservationId, issued.rawToken),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(400);
    expect(resB.body.error.code).toBe('CLAIM_TOKEN_INVALID');

    expect(await getReservationOwner(seeded.reservationId)).toBe(a.userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(a.userId);
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
    });

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

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await getReservationOwner(seeded.reservationId)).toBe(userId);
    expect(await getOrderOwnerByReservationId(seeded.reservationId)).toBe(userId);
    expect(await countUsedClaimTokens(seeded.reservationId)).toBe(1);
  });

  test('parallel claim-token issuance leaves exactly one active token', async () => {
    const email = uniqueEmail('race-issue');
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2033-03-01',
      returnDate: '2033-03-04',
      guest: { email, fullName: 'Race Issue' },
    });

    await Promise.all([
      reservationClaimService.issueClaimToken({ reservationId: seeded.reservationId }),
      reservationClaimService.issueClaimToken({ reservationId: seeded.reservationId }),
      reservationClaimService.issueClaimToken({ reservationId: seeded.reservationId }),
    ]);

    expect(await countActiveClaimTokens(seeded.reservationId)).toBe(1);
  });
});
