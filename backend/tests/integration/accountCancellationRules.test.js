const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { createSessionAgent, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  getReservationById,
} = require('./helpers/dbFixtures');
const { pool } = require('../helpers/dbTestHarness');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

async function signupAgent(app, email, password = 'Customer123!') {
  const agent = await createSessionAgent(app);
  const res = await withCsrf(agent, agent.post('/api/auth/signup')).send({
    email,
    password,
  });
  expect(res.status).toBe(201);
  agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
  return {
    agent,
    userId: Number(res.body.data.user.id),
    email,
  };
}

async function insertOwnedReservation({
  carId,
  userId,
  email,
  status,
  pickupDate = new Date('2030-09-01T10:00:00.000Z'),
  returnDate = new Date('2030-09-05T10:00:00.000Z'),
}) {
  const sessionId = `acct-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await pool.query(
    `
    INSERT INTO reservations (
      car_id, session_id, user_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price,
      full_name, phone_number, email, address, hotel_name,
      status, hold_expires_at, price_snapshot
    )
    VALUES (
      $1, $2, $3,
      $4, '10:00', $5, '10:00',
      'office', 'office',
      4, 0, 0, 200,
      'Cancel Rules Guest', '+359888000111', $6, 'Addr', 'Hotel',
      $7, NOW() + INTERVAL '1 hour', '{}'::jsonb
    )
    RETURNING id
    `,
    [carId, sessionId, userId, pickupDate, returnDate, email, status]
  );
  return Number(result.rows[0].id);
}

async function getPendingCancelRequest(reservationId) {
  const result = await pool.query(
    `
    SELECT id, status, reservation_id
    FROM reservation_cancellation_requests
    WHERE reservation_id = $1 AND status = 'pending'
    ORDER BY id DESC
    LIMIT 1
    `,
    [reservationId]
  );
  return result.rows[0] || null;
}

describeIf('CUST-006: accountCancellationRules', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Account Cancel Rules Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('second cancel-request while pending is idempotent', async () => {
    const email = `cancel-idem-${Date.now()}@example.com`;
    const { agent, userId } = await signupAgent(app, email);
    const reservationId = await insertOwnedReservation({
      carId,
      userId,
      email,
      status: 'confirmed',
    });

    const first = await withCsrf(
      agent,
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    ).send({ reason: 'first' });
    expect(first.status).toBe(200);
    expect(first.body.data.immediate).toBe(false);
    expect(first.body.data.cancellationRequest?.id).toBeTruthy();

    const pending = await getPendingCancelRequest(reservationId);
    expect(pending).toBeTruthy();

    const second = await withCsrf(
      agent,
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    ).send({ reason: 'second' });
    expect(second.status).toBe(200);
    expect(second.body.data.immediate).toBe(false);
    expect(Number(second.body.data.cancellationRequest.id)).toBe(Number(pending.id));

    const stillOne = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM reservation_cancellation_requests
      WHERE reservation_id = $1 AND status = 'pending'
      `,
      [reservationId]
    );
    expect(stillOne.rows[0].count).toBe(1);

    const reservation = await getReservationById(reservationId);
    expect(reservation.status).toBe('confirmed');
  });

  test('late status deny returns 422 without creating a request', async () => {
    const email = `cancel-late-${Date.now()}@example.com`;
    const { agent, userId } = await signupAgent(app, email);
    const reservationId = await insertOwnedReservation({
      carId,
      userId,
      email,
      status: 'picked_up',
    });

    const response = await withCsrf(
      agent,
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    ).send({ reason: 'too late' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    expect(await getPendingCancelRequest(reservationId)).toBeNull();
    const reservation = await getReservationById(reservationId);
    expect(reservation.status).toBe('picked_up');
  });

  test('terminal status deny returns 422', async () => {
    const email = `cancel-terminal-${Date.now()}@example.com`;
    const { agent, userId } = await signupAgent(app, email);
    const reservationId = await insertOwnedReservation({
      carId,
      userId,
      email,
      status: 'completed',
    });

    const response = await withCsrf(
      agent,
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    ).send({});

    expect(response.status).toBe(422);
    expect(await getPendingCancelRequest(reservationId)).toBeNull();
  });
});
