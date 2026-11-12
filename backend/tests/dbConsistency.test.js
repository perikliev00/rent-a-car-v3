/**
 * Opt-in DB integration tests.
 * Run: RUN_DB_TESTS=1 DATABASE_URL=postgres://... npm run test:db
 */
const pool = require('../src/db/pool');
// Require the '../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../src/services/sql/reservationSqlService');
// Require the '../src/services/sql/bookingSyncSqlService' module as bookingSync.
const bookingSync = require('../src/services/sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { restoreOrder } = require('../src/services/admin/order/orderRestoreService');
// Destructure object properties into local variables.
const { insertTestCar } = require('./helpers/dbTestHarness');

// Create the run db tests constant.
const runDbTests = process.env.RUN_DB_TESTS === 'true' && process.env.DATABASE_URL;
// Create the describe if db constant.
const describeIfDb = runDbTests ? describe : describe.skip;

// Define the async function insertCar.
async function insertCar() {
  // Create the client constant.
  const client = await pool.connect();
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await insertTestCar(client);
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Call client.release to perform this step.
    client.release();
  }
}

// Define the async function cleanupCar.
async function cleanupCar(carId) {
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM cars WHERE id = $1', [carId]);
}

// Call describeIfDb to perform this step.
describeIfDb('DB consistency', () => {
  // Uses shared pool; do not call pool.end() here — other suites may reuse it.

  test('rejects overlapping confirmed car_date_blocks', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-06-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-06-05T10:00:00.000Z');

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carId, start, end);

      // Wait until the asynchronous operation resolves.
      await expect(
        // Call bookingSync.addRange to perform this step.
        bookingSync.addRange(
          // Contribute this line to the enclosing declaration or statement.
          carId,
          // Continue the surrounding logic with this statement.
          new Date('2030-06-03T10:00:00.000Z'),
          // Continue the surrounding logic with this statement.
          new Date('2030-06-07T10:00:00.000Z')
        )
      // Continue the surrounding logic with this statement.
      ).rejects.toMatchObject({ code: 'OVERLAP' });
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('rejects overlapping active pending holds', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-07-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-07-05T10:00:00.000Z');

    // Start a try block for operations that may fail.
    try {
      // Create the first constant.
      const first = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `session-a-${carId}`,
        // Provide the start date field value.
        startDate: start,
        // Provide the end date field value.
        endDate: end,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      // Assert that the value matches the intended expectation.
      expect(first.reservation).toBeTruthy();

      // Create the second constant.
      const second = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `session-b-${carId}`,
        // Provide the start date field value.
        startDate: new Date('2030-07-03T10:00:00.000Z'),
        // Provide the end date field value.
        endDate: new Date('2030-07-07T10:00:00.000Z'),
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      // Assert that the value matches the intended expectation.
      expect(second.reservation).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(second.overlappingReservation).toBeTruthy();
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('ignores expired reservations when creating a new hold', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-08-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-08-05T10:00:00.000Z');
    // Create the expired at constant.
    const expiredAt = new Date('2020-01-01T00:00:00.000Z');

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'expired', $5)
        `,
        // Continue the surrounding logic with this statement.
        [carId, `expired-session-${carId}`, start, end, expiredAt]
      );

      // Create the result constant.
      const result = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `fresh-session-${carId}`,
        // Provide the start date field value.
        startDate: start,
        // Provide the end date field value.
        endDate: end,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      // Assert that the value matches the intended expectation.
      expect(result.reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(result.overlappingReservation).toBeNull();
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('does not ignore active non-expired holds', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-09-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-09-05T10:00:00.000Z');
    // Create the hold expires at constant.
    const holdExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'pending_payment', $5)
        `,
        // Continue the surrounding logic with this statement.
        [carId, `active-session-${carId}`, start, end, holdExpiresAt]
      );

      // Create the result constant.
      const result = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `other-session-${carId}`,
        // Provide the start date field value.
        startDate: start,
        // Provide the end date field value.
        endDate: end,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      // Assert that the value matches the intended expectation.
      expect(result.reservation).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(result.overlappingReservation).toBeTruthy();
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('restore deleted order fails when dates already blocked', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-10-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-10-05T10:00:00.000Z');
    // Reserve the order id variable for later assignment.
    let orderId;

    // Start a try block for operations that may fail.
    try {
      // Create the order insert constant.
      const orderInsert = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO orders (
          car_id, pickup_date, return_date, pickup_location, return_location,
          rental_days, total_price, full_name, phone_number, email, address,
          status, is_deleted, deleted_at
        )
        VALUES (
          $1, $2, $3, 'office', 'office', 4, 200,
          'Test User', '123', 'test@example.com', 'Addr',
          'active', TRUE, NOW()
        )
        RETURNING id
        `,
        // Contribute this line to the enclosing declaration or statement.
        [carId, start, end]
      );
      // Update orderId with the right-hand side value.
      orderId = String(orderInsert.rows[0].id);

      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carId, start, end);

      // Wait until the asynchronous operation resolves.
      await expect(restoreOrder(orderId)).rejects.toMatchObject({
        // Provide the is order restore error field value.
        isOrderRestoreError: true,
        // Provide the code field value.
        code: 'OVERLAP',
      });
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Evaluate the condition and enter the branch when it is true.
      if (orderId) {
        // Wait until the asynchronous operation resolves.
        await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      }
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('case-insensitive email uniqueness is enforced', async () => {
    // Create the suffix constant.
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Create the email constant.
    const email = `User.${suffix}@Example.com`;
    // Reserve the user id variable for later assignment.
    let userId;

    // Start a try block for operations that may fail.
    try {
      // Create the insert constant.
      const insert = await pool.query(
        // Continue the surrounding logic with this statement.
        `INSERT INTO users (email, password, role) VALUES ($1, 'hash', 'user') RETURNING id`,
        // Continue the surrounding logic with this statement.
        [email.toLowerCase()]
      );
      // Update userId with the right-hand side value.
      userId = insert.rows[0].id;

      // Wait until the asynchronous operation resolves.
      await expect(
        // Call pool.query to perform this step.
        pool.query(`INSERT INTO users (email, password, role) VALUES ($1, 'hash', 'user')`, [
          // Call email.toUpperCase to perform this step.
          email.toUpperCase(),
        ])
      // Continue the surrounding logic with this statement.
      ).rejects.toMatchObject({ code: '23505' });
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Evaluate the condition and enter the branch when it is true.
      if (userId) {
        // Wait until the asynchronous operation resolves.
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      }
    }
  });

  // Define a single test case and its expectations.
  test('runWithTransaction rolls back partial writes on error', async () => {
    // Destructure object properties into local variables.
    const { runWithTransaction } = require('../src/db/transaction');
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-09-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-09-05T10:00:00.000Z');

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call runWithTransaction to perform this step.
        runWithTransaction(async (client) => {
          // Wait until the asynchronous operation resolves.
          await client.query(
            // Continue the surrounding logic with this statement.
            `
            INSERT INTO car_date_blocks (car_id, start_date, end_date)
            VALUES ($1, $2, $3)
            `,
            // Contribute this line to the enclosing declaration or statement.
            [carId, start, end]
          );

          // Create the mid constant.
          const mid = await client.query(
            // Continue the surrounding logic with this statement.
            'SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1',
            // Contribute this line to the enclosing declaration or statement.
            [carId]
          );
          // Assert that the value matches the intended expectation.
          expect(mid.rows[0].count).toBe(1);

          // Throw an error to stop the current control flow.
          throw new Error('force rollback');
        })
      // Continue the surrounding logic with this statement.
      ).rejects.toThrow('force rollback');

      // Create the after constant.
      const after = await pool.query(
        // Continue the surrounding logic with this statement.
        'SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1',
        // Contribute this line to the enclosing declaration or statement.
        [carId]
      );
      // Assert that the value matches the intended expectation.
      expect(after.rows[0].count).toBe(0);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('markAbandonedReservations expires holds for inactive sessions', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2030-10-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2030-10-05T10:00:00.000Z');

    // Start a try block for operations that may fail.
    try {
      // Create the created constant.
      const created = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `abandoned-session-${carId}`,
        // Provide the start date field value.
        startDate: start,
        // Provide the end date field value.
        endDate: end,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      // Assert that the value matches the intended expectation.
      expect(created.reservation).toBeTruthy();

      // Create the first pass constant.
      const firstPass = await reservationSql.markAbandonedReservations(
        // Contribute this line to the enclosing declaration or statement.
        ['some-other-active-session'],
        // Continue the surrounding logic with this statement.
        new Date()
      );
      // Assert that the value matches the intended expectation.
      expect(firstPass.count).toBeGreaterThanOrEqual(1);
      // Assert that the value matches the intended expectation.
      expect(firstPass.reservationIds.length).toBeGreaterThanOrEqual(1);

      // Create the row constant.
      const row = await pool.query('SELECT status FROM reservations WHERE id = $1', [
        // Contribute this line to the enclosing declaration or statement.
        created.reservation.id,
      ]);
      // Assert that the value matches the intended expectation.
      expect(row.rows[0].status).toBe('expired');

      // Create the second pass constant.
      const secondPass = await reservationSql.markAbandonedReservations(
        // Contribute this line to the enclosing declaration or statement.
        ['some-other-active-session'],
        // Continue the surrounding logic with this statement.
        new Date()
      );
      // Assert that the value matches the intended expectation.
      expect(secondPass.count).toBe(0);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('refund_operations table exists', async () => {
    // Create the result constant.
    const result = await pool.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'refund_operations'
    `);
    // Assert that the value matches the intended expectation.
    expect(result.rowCount).toBe(1);
  });

  // Define a single test case and its expectations.
  test('refund_operations unique stripe_refund_id and one-active indexes exist', async () => {
    // Create the unique stripe constant.
    const uniqueStripe = await pool.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'refund_operations'
        AND indexname = 'idx_refund_operations_stripe_refund_id_unique'
    `);
    // Assert that the value matches the intended expectation.
    expect(uniqueStripe.rowCount).toBe(1);

    // Create the one active constant.
    const oneActive = await pool.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'refund_operations'
        AND indexname = 'idx_refund_operations_one_active_per_reservation'
    `);
    // Assert that the value matches the intended expectation.
    expect(oneActive.rowCount).toBe(1);
  });

  // Define a single test case and its expectations.
  test('refund_operations unique id, restrict delete, and monotonic status', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the start constant.
    const start = new Date('2031-01-01T10:00:00.000Z');
    // Create the end constant.
    const end = new Date('2031-01-05T10:00:00.000Z');

    // Start a try block for operations that may fail.
    try {
      // Create the hold expires at constant.
      const holdExpiresAt = new Date('2031-01-01T10:00:00.000Z');
      // Create the res a constant.
      const resA = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, stripe_payment_intent_id, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'confirmed', 'pi_integrity_a', $5)
        RETURNING id
        `,
        // Continue the surrounding logic with this statement.
        [carId, `integrity-a-${carId}`, start, end, holdExpiresAt]
      );
      // Create the res b constant.
      const resB = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, stripe_payment_intent_id, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'confirmed', 'pi_integrity_b', $5)
        RETURNING id
        `,
        // Continue the surrounding logic with this statement.
        [carId, `integrity-b-${carId}`, start, new Date('2031-02-05T10:00:00.000Z'), holdExpiresAt]
      );
      // Create the reservation a constant.
      const reservationA = Number(resA.rows[0].id);
      // Create the reservation b constant.
      const reservationB = Number(resB.rows[0].id);

      // Create the op a constant.
      const opA = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO refund_operations (
          reservation_id, stripe_payment_intent_id, stripe_refund_id,
          amount_cents, currency, status, idempotency_key
        )
        VALUES ($1, 'pi_integrity_a', 're_dup', 10000, 'eur', 'succeeded', $2)
        RETURNING id
        `,
        // Continue the surrounding logic with this statement.
        [reservationA, `refund:reservation:${reservationA}:full`]
      );
      // Create the op id constant.
      const opId = Number(opA.rows[0].id);

      // Wait until the asynchronous operation resolves.
      await expect(
        // Call pool.query to perform this step.
        pool.query(
          // Continue the surrounding logic with this statement.
          `
          INSERT INTO refund_operations (
            reservation_id, stripe_payment_intent_id, stripe_refund_id,
            amount_cents, currency, status, idempotency_key
          )
          VALUES ($1, 'pi_integrity_b', 're_dup', 10000, 'eur', 'failed', $2)
          `,
          // Continue the surrounding logic with this statement.
          [reservationB, `refund:reservation:${reservationB}:full`]
        )
      // Continue the surrounding logic with this statement.
      ).rejects.toMatchObject({ code: '23505' });

      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO refund_operations (
          reservation_id, stripe_payment_intent_id, stripe_refund_id,
          amount_cents, currency, status, idempotency_key
        )
        VALUES ($1, 'pi_integrity_b', NULL, 10000, 'eur', 'failed', $2),
               ($1, 'pi_integrity_b', NULL, 10000, 'eur', 'failed', $3)
        `,
        [
          // Contribute this line to the enclosing declaration or statement.
          reservationB,
          // Continue the surrounding logic with this statement.
          `refund:reservation:${reservationB}:full:null1`,
          // Continue the surrounding logic with this statement.
          `refund:reservation:${reservationB}:full:null2`,
        ]
      );

      // Wait until the asynchronous operation resolves.
      await expect(
        // Call pool.query to perform this step.
        pool.query('DELETE FROM reservations WHERE id = $1', [reservationA])
      // Continue the surrounding logic with this statement.
      ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });

      // Wait until the asynchronous operation resolves.
      await expect(
        // Call pool.query to perform this step.
        pool.query(
          // Continue the surrounding logic with this statement.
          `UPDATE refund_operations SET status = 'failed' WHERE id = $1 AND status = 'succeeded'`,
          // Contribute this line to the enclosing declaration or statement.
          [opId]
        )
      // Continue the surrounding logic with this statement.
      ).rejects.toMatchObject({ code: 'P0001' });

      // Create the still succeeded constant.
      const stillSucceeded = await pool.query(
        // Continue the surrounding logic with this statement.
        'SELECT status FROM refund_operations WHERE id = $1',
        // Contribute this line to the enclosing declaration or statement.
        [opId]
      );
      // Assert that the value matches the intended expectation.
      expect(stillSucceeded.rows[0].status).toBe('succeeded');

      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        UPDATE refund_operations
        SET failure_code = 'DOMAIN_TRANSITION_FAILED', failure_message = 'picked_up → refunded'
        WHERE id = $1
        `,
        // Contribute this line to the enclosing declaration or statement.
        [opId]
      );
      // Create the patched constant.
      const patched = await pool.query(
        // Continue the surrounding logic with this statement.
        'SELECT status, failure_code FROM refund_operations WHERE id = $1',
        // Contribute this line to the enclosing declaration or statement.
        [opId]
      );
      // Assert that the value matches the intended expectation.
      expect(patched.rows[0].status).toBe('succeeded');
      // Assert that the value matches the intended expectation.
      expect(patched.rows[0].failure_code).toBe('DOMAIN_TRANSITION_FAILED');

      // Wait until the asynchronous operation resolves.
      await pool.query('DELETE FROM refund_operations WHERE reservation_id = $1', [reservationA]);
      // Wait until the asynchronous operation resolves.
      await pool.query('DELETE FROM reservations WHERE id = $1', [reservationA]);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('payment_events.event_id unique index exists', async () => {
    // Create the result constant.
    const result = await pool.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'payment_events'
        AND indexname = 'idx_payment_events_event_id_unique'
    `);
    // Assert that the value matches the intended expectation.
    expect(result.rowCount).toBe(1);
  });

  // Define a single test case and its expectations.
  test('purgeExpired retains and extends blocks for overdue picked_up rentals', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the pickup constant.
    const pickup = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    // Create the return date constant.
    const returnDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carId, pickup, returnDate);
      // Force block end into the past (addRange may have side effects from purge).
      await pool.query(
        // Continue the surrounding logic with this statement.
        `UPDATE car_date_blocks SET end_date = $2 WHERE car_id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [carId, returnDate]
      );

      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 3, 150, 'picked_up', $5)
        `,
        // Continue the surrounding logic with this statement.
        [carId, `overdue-picked-${carId}`, pickup, returnDate, new Date(Date.now() + 3600000)]
      );

      // Wait until the asynchronous operation resolves.
      await bookingSync.purgeExpired(carId);

      // Create the blocks constant.
      const blocks = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT start_date, end_date FROM car_date_blocks WHERE car_id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [carId]
      );
      // Assert that the value matches the intended expectation.
      expect(blocks.rowCount).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(new Date(blocks.rows[0].end_date).getTime()).toBeGreaterThan(Date.now() - 1000);

      // Create the hold constant.
      const hold = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `new-hold-overdue-${carId}`,
        // Provide the start date field value.
        startDate: new Date(Date.now() + 60 * 60 * 1000),
        // Provide the end date field value.
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 2, totalPrice: 100 },
      });
      // Assert that the value matches the intended expectation.
      expect(hold.reservation).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(hold.bookedOverlap).toBeTruthy();
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('hold rejected for open physical rental even when date block is missing', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the pickup constant.
    const pickup = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    // Create the return date constant.
    const returnDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 3, 150, 'active_rental', $5)
        `,
        // Continue the surrounding logic with this statement.
        [carId, `active-no-block-${carId}`, pickup, returnDate, new Date(Date.now() + 3600000)]
      );

      // Create the blocks constant.
      const blocks = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT id FROM car_date_blocks WHERE car_id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [carId]
      );
      // Assert that the value matches the intended expectation.
      expect(blocks.rowCount).toBe(0);

      // Create the hold constant.
      const hold = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `hold-no-block-${carId}`,
        // Provide the start date field value.
        startDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        // Provide the end date field value.
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 2, totalPrice: 100 },
      });
      // Assert that the value matches the intended expectation.
      expect(hold.reservation).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(hold.bookedOverlap).toBeTruthy();
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('staff order update rejects move onto car with overdue open physical rental', async () => {
    // Destructure object properties into local variables.
    const { updateOrder } = require('../src/services/admin/order/orderUpdateService');
    // Destructure object properties into local variables.
    const { getSofiaIsoDateString } = require('../src/utils/date/timezone');

    // Create the car x constant.
    const carX = await insertCar();
    // Create the car y constant.
    const carY = await insertCar();
    // Create the overdue pickup constant.
    const overduePickup = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    // Create the overdue return constant.
    const overdueReturn = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    // Create the order bstart constant.
    const orderBStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    // Create the order bend constant.
    const orderBEnd = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
    // Reserve the reservation aid variable for later assignment.
    let reservationAId;
    // Reserve the order bid variable for later assignment.
    let orderBId;

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carX, overduePickup, overdueReturn);
      // Wait until the asynchronous operation resolves.
      await pool.query(`UPDATE car_date_blocks SET end_date = $2 WHERE car_id = $1`, [
        // Contribute this line to the enclosing declaration or statement.
        carX,
        // Contribute this line to the enclosing declaration or statement.
        overdueReturn,
      ]);

      // Create the reservation a constant.
      const reservationA = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 3, 150, 'picked_up', $5)
        RETURNING id, status, car_id, pickup_date, return_date
        `,
        [
          // Contribute this line to the enclosing declaration or statement.
          carX,
          // Continue the surrounding logic with this statement.
          `overdue-open-${carX}`,
          // Contribute this line to the enclosing declaration or statement.
          overduePickup,
          // Contribute this line to the enclosing declaration or statement.
          overdueReturn,
          // Continue the surrounding logic with this statement.
          new Date(Date.now() + 3600000),
        ]
      );
      // Update reservationAId with the right-hand side value.
      reservationAId = reservationA.rows[0].id;

      // Wait until the asynchronous operation resolves.
      await bookingSync.purgeExpired(carX);

      // Create the order b constant.
      const orderB = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO orders (
          car_id, pickup_date, return_date, pickup_time, return_time,
          pickup_location, return_location, rental_days, total_price,
          full_name, phone_number, email, address, status, is_deleted
        )
        VALUES (
          $1, $2, $3, '10:00', '10:00',
          'office', 'office', 3, 150,
          'Order B Guest', '123456', $4, 'Addr B', 'active', FALSE
        )
        RETURNING id, car_id, pickup_date, return_date, full_name
        `,
        // Continue the surrounding logic with this statement.
        [carY, orderBStart, orderBEnd, `order-b-${carY}@example.com`]
      );
      // Update orderBId with the right-hand side value.
      orderBId = String(orderB.rows[0].id);
      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carY, orderBStart, orderBEnd);

      // Create the move start constant.
      const moveStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      // Create the move end constant.
      const moveEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      // Create the result constant.
      const result = await updateOrder(orderBId, {
        // Provide the car id field value.
        carId: carX,
        // Provide the pickup date field value.
        pickupDate: getSofiaIsoDateString(moveStart),
        // Provide the pickup time field value.
        pickupTime: '12:00',
        // Provide the return date field value.
        returnDate: getSofiaIsoDateString(moveEnd),
        // Provide the return time field value.
        returnTime: '12:00',
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the hotel name field value.
        hotelName: '',
        // Provide the full name field value.
        fullName: 'Order B Guest',
        // Provide the phone number field value.
        phoneNumber: '123456',
        // Provide the email field value.
        email: `order-b-${carY}@example.com`,
        // Provide the address field value.
        address: 'Addr B',
      });

      // Assert that the value matches the intended expectation.
      expect(result.success).toBe(false);
      // Assert that the value matches the intended expectation.
      expect(result.viewModel?.error || '').toMatch(/open rental/i);

      // Create the order after constant.
      const orderAfter = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT car_id, pickup_date, return_date, full_name FROM orders WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [orderBId]
      );
      // Assert that the value matches the intended expectation.
      expect(String(orderAfter.rows[0].car_id)).toBe(String(carY));
      // Assert that the value matches the intended expectation.
      expect(new Date(orderAfter.rows[0].pickup_date).getTime()).toBe(orderBStart.getTime());
      // Assert that the value matches the intended expectation.
      expect(new Date(orderAfter.rows[0].return_date).getTime()).toBe(orderBEnd.getTime());

      // Create the blocks on x constant.
      const blocksOnX = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT start_date, end_date FROM car_date_blocks WHERE car_id = $1 ORDER BY start_date`,
        // Contribute this line to the enclosing declaration or statement.
        [carX]
      );
      // Assert that the value matches the intended expectation.
      expect(blocksOnX.rowCount).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(new Date(blocksOnX.rows[0].end_date).getTime()).toBeLessThan(moveStart.getTime());

      // Create the reservation aafter constant.
      const reservationAAfter = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT status, car_id, pickup_date, return_date FROM reservations WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [reservationAId]
      );
      // Assert that the value matches the intended expectation.
      expect(reservationAAfter.rows[0].status).toBe('picked_up');
      // Assert that the value matches the intended expectation.
      expect(String(reservationAAfter.rows[0].car_id)).toBe(String(carX));
      // Assert that the value matches the intended expectation.
      expect(new Date(reservationAAfter.rows[0].pickup_date).getTime()).toBe(
        // Call overduePickup.getTime to perform this step.
        overduePickup.getTime()
      );
      // Assert that the value matches the intended expectation.
      expect(new Date(reservationAAfter.rows[0].return_date).getTime()).toBe(
        // Call overdueReturn.getTime to perform this step.
        overdueReturn.getTime()
      );
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carX);
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carY);
    }
  });

  // Define a single test case and its expectations.
  test('after returned, purge can remove block and car is holdable again', async () => {
    // Create the car id constant.
    const carId = await insertCar();
    // Create the pickup constant.
    const pickup = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    // Create the return date constant.
    const returnDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carId, pickup, returnDate);
      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `UPDATE car_date_blocks SET end_date = $2 WHERE car_id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [carId, returnDate]
      );

      // Create the inserted constant.
      const inserted = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 3, 150, 'picked_up', $5)
        RETURNING id
        `,
        // Continue the surrounding logic with this statement.
        [carId, `returned-flow-${carId}`, pickup, returnDate, new Date(Date.now() + 3600000)]
      );
      // Create the reservation id constant.
      const reservationId = inserted.rows[0].id;

      // Wait until the asynchronous operation resolves.
      await bookingSync.purgeExpired(carId);
      // Assert that the value matches the intended expectation.
      expect(
        // Continue the surrounding logic with this statement.
        (await pool.query(`SELECT id FROM car_date_blocks WHERE car_id = $1`, [carId])).rowCount
      // Continue the surrounding logic with this statement.
      ).toBe(1);

      // Wait until the asynchronous operation resolves.
      await pool.query(`UPDATE reservations SET status = 'returned' WHERE id = $1`, [
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
      ]);

      // Wait until the asynchronous operation resolves.
      await bookingSync.purgeExpired(carId);
      // Assert that the value matches the intended expectation.
      expect(
        // Continue the surrounding logic with this statement.
        (await pool.query(`SELECT id FROM car_date_blocks WHERE car_id = $1`, [carId])).rowCount
      // Continue the surrounding logic with this statement.
      ).toBe(0);

      // Create the future start constant.
      const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      // Create the future end constant.
      const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      // Create the hold constant.
      const hold = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: `after-return-${carId}`,
        // Provide the start date field value.
        startDate: futureStart,
        // Provide the end date field value.
        endDate: futureEnd,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 3, totalPrice: 150 },
      });
      // Assert that the value matches the intended expectation.
      expect(hold.reservation).toBeTruthy();
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });

  // Define a single test case and its expectations.
  test('overdue active_rental survives purge and blocks then frees booking after return', async () => {
    // Destructure object properties into local variables.
    const { changeStatus } = require('../src/services/reservation/reservationStatusService');

    // Create the car id constant.
    const carId = await insertCar();
    // Create the pickup constant.
    const pickup = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    // Create the return date constant.
    const returnDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    // Create the second session id constant.
    const secondSessionId = `second-customer-${carId}`;
    // Create the future start constant.
    const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Create the future end constant.
    const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    // Create the count for car constant.
    const countForCar = async () => {
      // Destructure array values into local variables.
      const [reservations, pending, orders, blocks] = await Promise.all([
        // Call pool.query to perform this step.
        pool.query(`SELECT COUNT(*)::int AS count FROM reservations WHERE car_id = $1`, [carId]),
        // Call pool.query to perform this step.
        pool.query(
          // Continue the surrounding logic with this statement.
          `
          SELECT COUNT(*)::int AS count
          FROM reservations
          WHERE car_id = $1 AND status = 'pending_payment'
          `,
          // Contribute this line to the enclosing declaration or statement.
          [carId]
        ),
        // Call pool.query to perform this step.
        pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE car_id = $1`, [carId]),
        // Call pool.query to perform this step.
        pool.query(`SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1`, [
          // Contribute this line to the enclosing declaration or statement.
          carId,
        ]),
      ]);
      // Return the resulting value to the caller.
      return {
        // Provide the reservations field value.
        reservations: reservations.rows[0].count,
        // Provide the pending field value.
        pending: pending.rows[0].count,
        // Provide the orders field value.
        orders: orders.rows[0].count,
        // Provide the blocks field value.
        blocks: blocks.rows[0].count,
      };
    };

    // Start a try block for operations that may fail.
    try {
      // Create the inserted constant.
      const inserted = await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 3, 150, 'confirmed', $5)
        RETURNING id
        `,
        [
          // Contribute this line to the enclosing declaration or statement.
          carId,
          // Continue the surrounding logic with this statement.
          `overdue-active-${carId}`,
          // Contribute this line to the enclosing declaration or statement.
          pickup,
          // Contribute this line to the enclosing declaration or statement.
          returnDate,
          // Continue the surrounding logic with this statement.
          new Date(Date.now() + 3600000),
        ]
      );
      // Create the reservation id constant.
      const reservationId = inserted.rows[0].id;

      // Wait until the asynchronous operation resolves.
      await pool.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO orders (
          reservation_id, car_id, pickup_date, return_date,
          pickup_time, return_time, pickup_location, return_location,
          rental_days, total_price, full_name, phone_number, email, address,
          status, is_deleted
        )
        VALUES (
          $1, $2, $3, $4, '10:00', '10:00', 'office', 'office',
          3, 150, 'Overdue Active Guest', '123456', $5, 'Addr',
          'active', FALSE
        )
        `,
        // Continue the surrounding logic with this statement.
        [reservationId, carId, pickup, returnDate, `overdue-active-${carId}@example.com`]
      );

      // Wait until the asynchronous operation resolves.
      await bookingSync.addRange(carId, pickup, returnDate);

      // Wait until the asynchronous operation resolves.
      await changeStatus({
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Provide the new status field value.
        newStatus: 'car_prepared',
        // Provide the reason field value.
        reason: 'db_consistency_overdue_active_rental',
      });
      // Wait until the asynchronous operation resolves.
      await changeStatus({
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Provide the new status field value.
        newStatus: 'picked_up',
        // Provide the reason field value.
        reason: 'db_consistency_overdue_active_rental',
      });
      // Wait until the asynchronous operation resolves.
      await changeStatus({
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Provide the new status field value.
        newStatus: 'active_rental',
        // Provide the reason field value.
        reason: 'db_consistency_overdue_active_rental',
      });

      // Wait until the asynchronous operation resolves.
      await pool.query(`UPDATE reservations SET return_date = $2 WHERE id = $1`, [
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Contribute this line to the enclosing declaration or statement.
        returnDate,
      ]);
      // Wait until the asynchronous operation resolves.
      await pool.query(`UPDATE car_date_blocks SET end_date = $2 WHERE car_id = $1`, [
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        returnDate,
      ]);

      // Create the before reject constant.
      const beforeReject = await countForCar();
      // Assert that the value matches the intended expectation.
      expect(beforeReject.reservations).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(beforeReject.pending).toBe(0);
      // Assert that the value matches the intended expectation.
      expect(beforeReject.orders).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(beforeReject.blocks).toBe(1);

      // Wait until the asynchronous operation resolves.
      await bookingSync.purgeExpired(carId);

      // Create the blocks after purge constant.
      const blocksAfterPurge = await pool.query(
        // Continue the surrounding logic with this statement.
        `SELECT start_date, end_date FROM car_date_blocks WHERE car_id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [carId]
      );
      // Assert that the value matches the intended expectation.
      expect(blocksAfterPurge.rowCount).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(new Date(blocksAfterPurge.rows[0].end_date).getTime()).toBeGreaterThan(
        // Call Date.now to perform this step.
        Date.now() - 1000
      );

      // Create the rejected hold constant.
      const rejectedHold = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: secondSessionId,
        // Provide the start date field value.
        startDate: futureStart,
        // Provide the end date field value.
        endDate: futureEnd,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 3, totalPrice: 150 },
      });
      // Assert that the value matches the intended expectation.
      expect(rejectedHold.reservation).toBeNull();
      // Assert that the value matches the intended expectation.
      expect(rejectedHold.bookedOverlap).toBeTruthy();

      // Create the after reject constant.
      const afterReject = await countForCar();
      // Assert that the value matches the intended expectation.
      expect(afterReject.reservations).toBe(beforeReject.reservations);
      // Assert that the value matches the intended expectation.
      expect(afterReject.pending).toBe(0);
      // Assert that the value matches the intended expectation.
      expect(afterReject.orders).toBe(beforeReject.orders);
      // Assert that the value matches the intended expectation.
      expect(afterReject.blocks).toBe(1);

      // Wait until the asynchronous operation resolves.
      await changeStatus({
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Provide the new status field value.
        newStatus: 'returned',
        // Provide the reason field value.
        reason: 'db_consistency_overdue_active_rental',
      });

      // Wait until the asynchronous operation resolves.
      await bookingSync.purgeExpired(carId);
      // Assert that the value matches the intended expectation.
      expect(
        // Continue the surrounding logic with this statement.
        (await pool.query(`SELECT id FROM car_date_blocks WHERE car_id = $1`, [carId])).rowCount
      // Continue the surrounding logic with this statement.
      ).toBe(0);

      // Create the allowed hold constant.
      const allowedHold = await reservationSql.createPendingReservationWithAvailabilityCheck({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the session id field value.
        sessionId: secondSessionId,
        // Provide the start date field value.
        startDate: futureStart,
        // Provide the end date field value.
        endDate: futureEnd,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pricing field value.
        pricing: { rentalDays: 3, totalPrice: 150 },
      });
      // Assert that the value matches the intended expectation.
      expect(allowedHold.reservation).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(allowedHold.reservation.status).toBe('pending_payment');

      // Create the after allow constant.
      const afterAllow = await countForCar();
      // Assert that the value matches the intended expectation.
      expect(afterAllow.pending).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(afterAllow.orders).toBe(1);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await cleanupCar(carId);
    }
  });
});
