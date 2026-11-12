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
  getReservationById,
// Continue the surrounding logic with this statement.
} = require('./helpers/dbFixtures');
// Destructure object properties into local variables.
const { pool } = require('../helpers/dbTestHarness');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Define the async function signupAgent.
async function signupAgent(app, email, password = 'Customer123!') {
  // Create the agent constant.
  const agent = await createSessionAgent(app);
  // Create the res constant.
  const res = await withCsrf(agent, agent.post('/api/auth/signup')).send({
    // Contribute this line to the enclosing declaration or statement.
    email,
    // Contribute this line to the enclosing declaration or statement.
    password,
  });
  // Assert that the value matches the intended expectation.
  expect(res.status).toBe(201);
  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    agent,
    // Provide the user id field value.
    userId: Number(res.body.data.user.id),
    // Contribute this line to the enclosing declaration or statement.
    email,
  };
}

// Define the async function insertOwnedReservation.
async function insertOwnedReservation({
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  userId,
  // Contribute this line to the enclosing declaration or statement.
  email,
  // Contribute this line to the enclosing declaration or statement.
  status,
  // Update pickupDate with the right-hand side value.
  pickupDate = new Date('2030-09-01T10:00:00.000Z'),
  // Update returnDate with the right-hand side value.
  returnDate = new Date('2030-09-05T10:00:00.000Z'),
// Continue the surrounding logic with this statement.
}) {
  // Create the session id constant.
  const sessionId = `acct-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [carId, sessionId, userId, pickupDate, returnDate, email, status]
  );
  // Return the resulting value to the caller.
  return Number(result.rows[0].id);
}

// Define the async function getPendingCancelRequest.
async function getPendingCancelRequest(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, status, reservation_id
    FROM reservation_cancellation_requests
    WHERE reservation_id = $1 AND status = 'pending'
    ORDER BY id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Call describeIf to perform this step.
describeIf('CUST-006: accountCancellationRules', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Account Cancel Rules Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('second cancel-request while pending is idempotent', async () => {
    // Create the email constant.
    const email = `cancel-idem-${Date.now()}@example.com`;
    // Destructure object properties into local variables.
    const { agent, userId } = await signupAgent(app, email);
    // Create the reservation id constant.
    const reservationId = await insertOwnedReservation({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Provide the status field value.
      status: 'confirmed',
    });

    // Create the first constant.
    const first = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    // Continue the surrounding logic with this statement.
    ).send({ reason: 'first' });
    // Assert that the value matches the intended expectation.
    expect(first.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(first.body.data.immediate).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(first.body.data.cancellationRequest?.id).toBeTruthy();

    // Create the pending constant.
    const pending = await getPendingCancelRequest(reservationId);
    // Assert that the value matches the intended expectation.
    expect(pending).toBeTruthy();

    // Create the second constant.
    const second = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    // Continue the surrounding logic with this statement.
    ).send({ reason: 'second' });
    // Assert that the value matches the intended expectation.
    expect(second.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(second.body.data.immediate).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(Number(second.body.data.cancellationRequest.id)).toBe(Number(pending.id));

    // Create the still one constant.
    const stillOne = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT COUNT(*)::int AS count
      FROM reservation_cancellation_requests
      WHERE reservation_id = $1 AND status = 'pending'
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Assert that the value matches the intended expectation.
    expect(stillOne.rows[0].count).toBe(1);

    // Create the reservation constant.
    const reservation = await getReservationById(reservationId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('confirmed');
  });

  // Define a single test case and its expectations.
  test('late status deny returns 422 without creating a request', async () => {
    // Create the email constant.
    const email = `cancel-late-${Date.now()}@example.com`;
    // Destructure object properties into local variables.
    const { agent, userId } = await signupAgent(app, email);
    // Create the reservation id constant.
    const reservationId = await insertOwnedReservation({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Provide the status field value.
      status: 'picked_up',
    });

    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    // Continue the surrounding logic with this statement.
    ).send({ reason: 'too late' });

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    // Assert that the value matches the intended expectation.
    expect(await getPendingCancelRequest(reservationId)).toBeNull();
    // Create the reservation constant.
    const reservation = await getReservationById(reservationId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('picked_up');
  });

  // Define a single test case and its expectations.
  test('terminal status deny returns 422', async () => {
    // Create the email constant.
    const email = `cancel-terminal-${Date.now()}@example.com`;
    // Destructure object properties into local variables.
    const { agent, userId } = await signupAgent(app, email);
    // Create the reservation id constant.
    const reservationId = await insertOwnedReservation({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Provide the status field value.
      status: 'completed',
    });

    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post(`/api/account/reservations/${reservationId}/cancel-request`)
    // Continue the surrounding logic with this statement.
    ).send({});

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(422);
    // Assert that the value matches the intended expectation.
    expect(await getPendingCancelRequest(reservationId)).toBeNull();
  });
});
