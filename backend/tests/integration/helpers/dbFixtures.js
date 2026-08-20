const bcrypt = require('bcrypt');
const { pool } = require('../../helpers/dbTestHarness');
const { addRange } = require('../../../src/services/sql/bookingSyncSqlService');

const DEFAULT_ADMIN = {
  email: 'admin@luxride.local',
  password: 'Admin123!',
};

async function insertIsolatedTestCar({ name = 'Integration Test Car', price = 50 } = {}) {
  const result = await pool.query(
    `
    INSERT INTO cars (
      name, image, transmission, price, seats, fuel_type, availability
    )
    VALUES ($1, '/images/test.jpg', 'Automatic', $2, 4, 'Petrol', TRUE)
    RETURNING id
    `,
    [name, price]
  );
  return Number(result.rows[0].id);
}

async function insertTestAdmin({
  email = DEFAULT_ADMIN.email,
  password = DEFAULT_ADMIN.password,
} = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [
    normalizedEmail,
  ]);

  let userId;
  if (existing.rows.length > 0) {
    userId = Number(existing.rows[0].id);
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password = $2, role = 'admin', updated_at = NOW() WHERE id = $1`,
      [userId, hashedPassword]
    );
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `
      INSERT INTO users (email, password, role)
      VALUES ($1, $2, 'admin')
      RETURNING id
      `,
      [normalizedEmail, hashedPassword]
    );
    userId = Number(result.rows[0].id);
  }

  await pool.query(
    `
    INSERT INTO user_roles (user_id, role_id)
    SELECT $1, r.id
    FROM roles r
    WHERE r.slug = 'owner'
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [userId]
  );

  return userId;
}

async function getReservationByStripeSessionId(stripeSessionId) {
  const result = await pool.query(
    `
    SELECT id, car_id, session_id, status, stripe_session_id, hold_expires_at,
           pickup_date, return_date, total_price, email, full_name
    FROM reservations
    WHERE stripe_session_id = $1
    `,
    [stripeSessionId]
  );
  return result.rows[0] || null;
}

async function getReservationById(reservationId) {
  const result = await pool.query(
    `
    SELECT id, car_id, session_id, status, stripe_session_id, hold_expires_at,
           pickup_date, return_date, total_price, email, full_name
    FROM reservations
    WHERE id = $1
    `,
    [reservationId]
  );
  return result.rows[0] || null;
}

async function getOrderByReservationId(reservationId) {
  const result = await pool.query(
    `
    SELECT id, car_id, reservation_id, status, stripe_session_id, email, total_price
    FROM orders
    WHERE reservation_id = $1
    `,
    [reservationId]
  );
  return result.rows[0] || null;
}

async function getDateBlocksForCar(carId) {
  const result = await pool.query(
    `
    SELECT id, car_id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
    ORDER BY start_date
    `,
    [carId]
  );
  return result.rows;
}

async function countActiveReservationsForCar(carId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE car_id = $1
      AND status IN ('pending_payment', 'processing_payment')
      AND hold_expires_at > NOW()
    `,
    [carId]
  );
  return result.rows[0].count;
}

async function countActiveReservationsForSession(sessionId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE session_id = $1
      AND status IN ('pending_payment', 'processing_payment')
      AND hold_expires_at > NOW()
    `,
    [sessionId]
  );
  return result.rows[0].count;
}

async function countReservationsForSession(sessionId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM reservations WHERE session_id = $1`,
    [sessionId]
  );
  return result.rows[0].count;
}

async function countReholdHistory(reservationId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM reservation_status_history
    WHERE reservation_id = $1
      AND reason = 'customer_reheld'
    `,
    [reservationId]
  );
  return result.rows[0].count;
}

async function setHoldExpired(reservationId, expiredAt = new Date('2020-01-01T00:00:00.000Z')) {
  await pool.query(
    `
    UPDATE reservations
    SET hold_expires_at = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [reservationId, expiredAt]
  );
}

async function insertDateBlock(carId, startDate, endDate) {
  await addRange(carId, startDate, endDate);
}

async function countProcessedStripeEvents(eventId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM processed_stripe_events WHERE event_id = $1',
    [eventId]
  );
  return result.rows[0].count;
}

async function countOrdersForCar(carId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM orders WHERE car_id = $1 AND is_deleted = FALSE',
    [carId]
  );
  return result.rows[0].count;
}

async function getActiveReservationForCar(carId) {
  const result = await pool.query(
    `
    SELECT id, car_id, session_id, status, stripe_session_id, hold_expires_at,
           pickup_date, return_date, total_price, email, full_name
    FROM reservations
    WHERE car_id = $1
      AND status IN ('pending_payment', 'processing_payment')
      AND hold_expires_at > NOW()
    ORDER BY id DESC
    LIMIT 1
    `,
    [carId]
  );
  return result.rows[0] || null;
}

async function clearStripeSessionId(reservationId) {
  await pool.query(
    `
    UPDATE reservations
    SET stripe_session_id = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    [reservationId]
  );
}

async function countPaymentEventsForReservation(reservationId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM payment_events WHERE reservation_id = $1',
    [reservationId]
  );
  return result.rows[0].count;
}

async function cleanupTestCar(carId) {
  if (!carId) return;

  await pool.query(
    'DELETE FROM payment_events WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    [carId]
  );
  await pool.query(
    'DELETE FROM payment_failures WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    [carId]
  );
  await pool.query(
    `
    DELETE FROM processed_stripe_events
    WHERE stripe_session_id IN (
      SELECT stripe_session_id FROM reservations WHERE car_id = $1 AND stripe_session_id IS NOT NULL
      UNION
      SELECT stripe_session_id FROM orders WHERE car_id = $1 AND stripe_session_id IS NOT NULL
    )
    OR event_id LIKE 'evt_%'
       AND stripe_session_id LIKE 'cs_test_%'
       AND created_at < NOW() - INTERVAL '1 day'
    `,
    [carId]
  );
  // Also drop processed events for superseded/stale stub sessions that lost their reservation link.
  await pool.query(
    `
    DELETE FROM processed_stripe_events pse
    WHERE pse.stripe_session_id LIKE 'cs_test_%'
      AND NOT EXISTS (
        SELECT 1 FROM reservations r WHERE r.stripe_session_id = pse.stripe_session_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.stripe_session_id = pse.stripe_session_id
      )
    `
  );
  await pool.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM cars WHERE id = $1', [carId]);
}

function buildOrderBody(carId, overrides = {}) {
  return {
    carId,
    pickupDate: '2030-06-01',
    returnDate: '2030-06-05',
    pickupTime: '10:00',
    returnTime: '10:00',
    pickupLocation: 'office',
    returnLocation: 'office',
    ...overrides,
  };
}

function buildCheckoutBody(carId, overrides = {}) {
  return {
    ...buildOrderBody(carId, overrides),
    fullName: 'Jane Doe',
    phoneNumber: '+359888123456',
    email: 'jane@example.com',
    address: 'Main St 1',
    hotelName: 'Hotel Test',
    ...overrides,
  };
}

function buildAdminOrderBody(carId, overrides = {}) {
  return {
    ...buildCheckoutBody(carId, overrides),
    fullName: 'Admin Guest',
    email: 'admin.guest@example.com',
  };
}

module.exports = {
  DEFAULT_ADMIN,
  insertIsolatedTestCar,
  insertTestAdmin,
  getReservationByStripeSessionId,
  getReservationById,
  getOrderByReservationId,
  getDateBlocksForCar,
  countActiveReservationsForCar,
  countActiveReservationsForSession,
  countReservationsForSession,
  countReholdHistory,
  setHoldExpired,
  insertDateBlock,
  countProcessedStripeEvents,
  countOrdersForCar,
  getActiveReservationForCar,
  clearStripeSessionId,
  countPaymentEventsForReservation,
  cleanupTestCar,
  buildOrderBody,
  buildCheckoutBody,
  buildAdminOrderBody,
};
