/**
 * Opt-in DB integration tests.
 * Run: RUN_DB_TESTS=1 DATABASE_URL=postgres://... npm run test:db
 */
const pool = require('../src/db/pool');
const reservationSql = require('../src/services/sql/reservationSqlService');
const bookingSync = require('../src/services/sql/bookingSyncSqlService');
const { restoreOrder } = require('../src/services/admin/order/orderRestoreService');
const { insertTestCar } = require('./helpers/dbTestHarness');

const runDbTests = process.env.RUN_DB_TESTS === 'true' && process.env.DATABASE_URL;
const describeIfDb = runDbTests ? describe : describe.skip;

async function insertCar() {
  const client = await pool.connect();
  try {
    return await insertTestCar(client);
  } finally {
    client.release();
  }
}

async function cleanupCar(carId) {
  await pool.query(
    'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    [carId]
  );
  await pool.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM cars WHERE id = $1', [carId]);
}

describeIfDb('DB consistency', () => {
  // Uses shared pool; do not call pool.end() here — other suites may reuse it.

  test('rejects overlapping confirmed car_date_blocks', async () => {
    const carId = await insertCar();
    const start = new Date('2030-06-01T10:00:00.000Z');
    const end = new Date('2030-06-05T10:00:00.000Z');

    try {
      await bookingSync.addRange(carId, start, end);

      await expect(
        bookingSync.addRange(
          carId,
          new Date('2030-06-03T10:00:00.000Z'),
          new Date('2030-06-07T10:00:00.000Z')
        )
      ).rejects.toMatchObject({ code: 'OVERLAP' });
    } finally {
      await cleanupCar(carId);
    }
  });

  test('rejects overlapping active pending holds', async () => {
    const carId = await insertCar();
    const start = new Date('2030-07-01T10:00:00.000Z');
    const end = new Date('2030-07-05T10:00:00.000Z');

    try {
      const first = await reservationSql.createPendingReservationWithAvailabilityCheck({
        carId,
        sessionId: `session-a-${carId}`,
        startDate: start,
        endDate: end,
        pickupLocation: 'office',
        returnLocation: 'office',
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      expect(first.reservation).toBeTruthy();

      const second = await reservationSql.createPendingReservationWithAvailabilityCheck({
        carId,
        sessionId: `session-b-${carId}`,
        startDate: new Date('2030-07-03T10:00:00.000Z'),
        endDate: new Date('2030-07-07T10:00:00.000Z'),
        pickupLocation: 'office',
        returnLocation: 'office',
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      expect(second.reservation).toBeNull();
      expect(second.overlappingReservation).toBeTruthy();
    } finally {
      await cleanupCar(carId);
    }
  });

  test('ignores expired reservations when creating a new hold', async () => {
    const carId = await insertCar();
    const start = new Date('2030-08-01T10:00:00.000Z');
    const end = new Date('2030-08-05T10:00:00.000Z');
    const expiredAt = new Date('2020-01-01T00:00:00.000Z');

    try {
      await pool.query(
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'expired', $5)
        `,
        [carId, `expired-session-${carId}`, start, end, expiredAt]
      );

      const result = await reservationSql.createPendingReservationWithAvailabilityCheck({
        carId,
        sessionId: `fresh-session-${carId}`,
        startDate: start,
        endDate: end,
        pickupLocation: 'office',
        returnLocation: 'office',
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      expect(result.reservation).toBeTruthy();
      expect(result.overlappingReservation).toBeNull();
    } finally {
      await cleanupCar(carId);
    }
  });

  test('does not ignore active non-expired holds', async () => {
    const carId = await insertCar();
    const start = new Date('2030-09-01T10:00:00.000Z');
    const end = new Date('2030-09-05T10:00:00.000Z');
    const holdExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    try {
      await pool.query(
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'pending_payment', $5)
        `,
        [carId, `active-session-${carId}`, start, end, holdExpiresAt]
      );

      const result = await reservationSql.createPendingReservationWithAvailabilityCheck({
        carId,
        sessionId: `other-session-${carId}`,
        startDate: start,
        endDate: end,
        pickupLocation: 'office',
        returnLocation: 'office',
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      expect(result.reservation).toBeNull();
      expect(result.overlappingReservation).toBeTruthy();
    } finally {
      await cleanupCar(carId);
    }
  });

  test('restore deleted order fails when dates already blocked', async () => {
    const carId = await insertCar();
    const start = new Date('2030-10-01T10:00:00.000Z');
    const end = new Date('2030-10-05T10:00:00.000Z');
    let orderId;

    try {
      const orderInsert = await pool.query(
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
        [carId, start, end]
      );
      orderId = String(orderInsert.rows[0].id);

      await bookingSync.addRange(carId, start, end);

      await expect(restoreOrder(orderId)).rejects.toMatchObject({
        isOrderRestoreError: true,
        code: 'OVERLAP',
      });
    } finally {
      if (orderId) {
        await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      }
      await cleanupCar(carId);
    }
  });

  test('case-insensitive email uniqueness is enforced', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = `User.${suffix}@Example.com`;
    let userId;

    try {
      const insert = await pool.query(
        `INSERT INTO users (email, password, role) VALUES ($1, 'hash', 'user') RETURNING id`,
        [email.toLowerCase()]
      );
      userId = insert.rows[0].id;

      await expect(
        pool.query(`INSERT INTO users (email, password, role) VALUES ($1, 'hash', 'user')`, [
          email.toUpperCase(),
        ])
      ).rejects.toMatchObject({ code: '23505' });
    } finally {
      if (userId) {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      }
    }
  });

  test('runWithTransaction rolls back partial writes on error', async () => {
    const { runWithTransaction } = require('../src/db/transaction');
    const carId = await insertCar();
    const start = new Date('2030-09-01T10:00:00.000Z');
    const end = new Date('2030-09-05T10:00:00.000Z');

    try {
      await expect(
        runWithTransaction(async (client) => {
          await client.query(
            `
            INSERT INTO car_date_blocks (car_id, start_date, end_date)
            VALUES ($1, $2, $3)
            `,
            [carId, start, end]
          );

          const mid = await client.query(
            'SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1',
            [carId]
          );
          expect(mid.rows[0].count).toBe(1);

          throw new Error('force rollback');
        })
      ).rejects.toThrow('force rollback');

      const after = await pool.query(
        'SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1',
        [carId]
      );
      expect(after.rows[0].count).toBe(0);
    } finally {
      await cleanupCar(carId);
    }
  });

  test('markAbandonedReservations expires holds for inactive sessions', async () => {
    const carId = await insertCar();
    const start = new Date('2030-10-01T10:00:00.000Z');
    const end = new Date('2030-10-05T10:00:00.000Z');

    try {
      const created = await reservationSql.createPendingReservationWithAvailabilityCheck({
        carId,
        sessionId: `abandoned-session-${carId}`,
        startDate: start,
        endDate: end,
        pickupLocation: 'office',
        returnLocation: 'office',
        pricing: { rentalDays: 4, totalPrice: 200 },
      });

      expect(created.reservation).toBeTruthy();

      const firstPass = await reservationSql.markAbandonedReservations(
        ['some-other-active-session'],
        new Date()
      );
      expect(firstPass.count).toBeGreaterThanOrEqual(1);
      expect(firstPass.reservationIds.length).toBeGreaterThanOrEqual(1);

      const row = await pool.query('SELECT status FROM reservations WHERE id = $1', [
        created.reservation.id,
      ]);
      expect(row.rows[0].status).toBe('expired');

      const secondPass = await reservationSql.markAbandonedReservations(
        ['some-other-active-session'],
        new Date()
      );
      expect(secondPass.count).toBe(0);
    } finally {
      await cleanupCar(carId);
    }
  });

  test('refund_operations table exists', async () => {
    const result = await pool.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'refund_operations'
    `);
    expect(result.rowCount).toBe(1);
  });

  test('refund_operations unique stripe_refund_id and one-active indexes exist', async () => {
    const uniqueStripe = await pool.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'refund_operations'
        AND indexname = 'idx_refund_operations_stripe_refund_id_unique'
    `);
    expect(uniqueStripe.rowCount).toBe(1);

    const oneActive = await pool.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'refund_operations'
        AND indexname = 'idx_refund_operations_one_active_per_reservation'
    `);
    expect(oneActive.rowCount).toBe(1);
  });

  test('refund_operations unique id, restrict delete, and monotonic status', async () => {
    const carId = await insertCar();
    const start = new Date('2031-01-01T10:00:00.000Z');
    const end = new Date('2031-01-05T10:00:00.000Z');

    try {
      const holdExpiresAt = new Date('2031-01-01T10:00:00.000Z');
      const resA = await pool.query(
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, stripe_payment_intent_id, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'confirmed', 'pi_integrity_a', $5)
        RETURNING id
        `,
        [carId, `integrity-a-${carId}`, start, end, holdExpiresAt]
      );
      const resB = await pool.query(
        `
        INSERT INTO reservations (
          car_id, session_id, pickup_date, return_date,
          pickup_location, return_location, rental_days, total_price,
          status, stripe_payment_intent_id, hold_expires_at
        )
        VALUES ($1, $2, $3, $4, 'office', 'office', 4, 200, 'confirmed', 'pi_integrity_b', $5)
        RETURNING id
        `,
        [carId, `integrity-b-${carId}`, start, new Date('2031-02-05T10:00:00.000Z'), holdExpiresAt]
      );
      const reservationA = Number(resA.rows[0].id);
      const reservationB = Number(resB.rows[0].id);

      const opA = await pool.query(
        `
        INSERT INTO refund_operations (
          reservation_id, stripe_payment_intent_id, stripe_refund_id,
          amount_cents, currency, status, idempotency_key
        )
        VALUES ($1, 'pi_integrity_a', 're_dup', 10000, 'eur', 'succeeded', $2)
        RETURNING id
        `,
        [reservationA, `refund:reservation:${reservationA}:full`]
      );
      const opId = Number(opA.rows[0].id);

      await expect(
        pool.query(
          `
          INSERT INTO refund_operations (
            reservation_id, stripe_payment_intent_id, stripe_refund_id,
            amount_cents, currency, status, idempotency_key
          )
          VALUES ($1, 'pi_integrity_b', 're_dup', 10000, 'eur', 'failed', $2)
          `,
          [reservationB, `refund:reservation:${reservationB}:full`]
        )
      ).rejects.toMatchObject({ code: '23505' });

      await pool.query(
        `
        INSERT INTO refund_operations (
          reservation_id, stripe_payment_intent_id, stripe_refund_id,
          amount_cents, currency, status, idempotency_key
        )
        VALUES ($1, 'pi_integrity_b', NULL, 10000, 'eur', 'failed', $2),
               ($1, 'pi_integrity_b', NULL, 10000, 'eur', 'failed', $3)
        `,
        [
          reservationB,
          `refund:reservation:${reservationB}:full:null1`,
          `refund:reservation:${reservationB}:full:null2`,
        ]
      );

      await expect(
        pool.query('DELETE FROM reservations WHERE id = $1', [reservationA])
      ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });

      await expect(
        pool.query(
          `UPDATE refund_operations SET status = 'failed' WHERE id = $1 AND status = 'succeeded'`,
          [opId]
        )
      ).rejects.toMatchObject({ code: 'P0001' });

      const stillSucceeded = await pool.query(
        'SELECT status FROM refund_operations WHERE id = $1',
        [opId]
      );
      expect(stillSucceeded.rows[0].status).toBe('succeeded');

      await pool.query(
        `
        UPDATE refund_operations
        SET failure_code = 'DOMAIN_TRANSITION_FAILED', failure_message = 'picked_up → refunded'
        WHERE id = $1
        `,
        [opId]
      );
      const patched = await pool.query(
        'SELECT status, failure_code FROM refund_operations WHERE id = $1',
        [opId]
      );
      expect(patched.rows[0].status).toBe('succeeded');
      expect(patched.rows[0].failure_code).toBe('DOMAIN_TRANSITION_FAILED');

      await pool.query('DELETE FROM refund_operations WHERE reservation_id = $1', [reservationA]);
      await pool.query('DELETE FROM reservations WHERE id = $1', [reservationA]);
    } finally {
      await cleanupCar(carId);
    }
  });

  test('payment_events.event_id unique index exists', async () => {
    const result = await pool.query(`
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'payment_events'
        AND indexname = 'idx_payment_events_event_id_unique'
    `);
    expect(result.rowCount).toBe(1);
  });
});
