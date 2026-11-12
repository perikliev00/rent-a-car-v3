// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { addRange } = require('../../../src/services/sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../../src/utils/date/timezone');

// Create the default admin constant.
const DEFAULT_ADMIN = {
  // Provide the email field value.
  email: 'admin@luxride.local',
  // Provide the password field value.
  password: 'Admin123!',
};

// Create the default guest constant.
const DEFAULT_GUEST = {
  // Provide the full name field value.
  fullName: 'Integration Guest',
  // Provide the phone number field value.
  phoneNumber: '+359888123456',
  // Provide the email field value.
  email: 'integration-guest@example.com',
  // Provide the address field value.
  address: 'Test Street 1',
  // Provide the hotel name field value.
  hotelName: 'Test Hotel',
};

// Create the hold seed statuses constant.
const HOLD_SEED_STATUSES = new Set(['pending_payment', 'processing_payment']);
// Create the staff password constant.
const STAFF_PASSWORD = 'Staff123!';

// Define the async function insertIsolatedTestCar.
async function insertIsolatedTestCar({ name = 'Integration Test Car', price = 50 } = {}) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO cars (
      name, image, transmission, price, seats, fuel_type, availability
    )
    VALUES ($1, '/images/test.jpg', 'Automatic', $2, 4, 'Petrol', TRUE)
    RETURNING id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [name, price]
  );
  // Return the resulting value to the caller.
  return Number(result.rows[0].id);
}

// Define the async function insertTestAdmin.
async function insertTestAdmin({
  // Update email with the right-hand side value.
  email = DEFAULT_ADMIN.email,
  // Update password with the right-hand side value.
  password = DEFAULT_ADMIN.password,
// Continue the surrounding logic with this statement.
} = {}) {
  // Create the normalized email constant.
  const normalizedEmail = email.trim().toLowerCase();
  // Create the existing constant.
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [
    // Contribute this line to the enclosing declaration or statement.
    normalizedEmail,
  ]);

  // Reserve the user id variable for later assignment.
  let userId;
  // Evaluate the condition and enter the branch when it is true.
  if (existing.rows.length > 0) {
    // Update userId with the right-hand side value.
    userId = Number(existing.rows[0].id);
    // Create the hashed password constant.
    const hashedPassword = await bcrypt.hash(password, 10);
    // Wait until the asynchronous operation resolves.
    await pool.query(
      // Continue the surrounding logic with this statement.
      `UPDATE users SET password = $2, role = 'admin', updated_at = NOW() WHERE id = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [userId, hashedPassword]
    );
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Create the hashed password constant.
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create the result constant.
    const result = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO users (email, password, role)
      VALUES ($1, $2, 'admin')
      RETURNING id
      `,
      // Contribute this line to the enclosing declaration or statement.
      [normalizedEmail, hashedPassword]
    );
    // Update userId with the right-hand side value.
    userId = Number(result.rows[0].id);
  }

  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO user_roles (user_id, role_id)
    SELECT $1, r.id
    FROM roles r
    WHERE r.slug = 'owner'
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    // Contribute this line to the enclosing declaration or statement.
    [userId]
  );

  // Return the resulting value to the caller.
  return userId;
}

// Define the async function getReservationByStripeSessionId.
async function getReservationByStripeSessionId(stripeSessionId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, car_id, session_id, status, stripe_session_id, stripe_payment_intent_id,
           hold_expires_at, pickup_date, return_date, total_price, email, full_name
    FROM reservations
    WHERE stripe_session_id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [stripeSessionId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Define the async function getReservationById.
async function getReservationById(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, car_id, session_id, status, stripe_session_id, stripe_payment_intent_id,
           hold_expires_at, pickup_date, pickup_time, return_date, return_time,
           total_price, paid_amount_cents, paid_currency, email, full_name, price_snapshot
    FROM reservations
    WHERE id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Define the async function getOrderByReservationId.
async function getOrderByReservationId(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, car_id, reservation_id, status, stripe_session_id, email, total_price,
           is_deleted, deleted_at
    FROM orders
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Define the async function getRefundOperationByReservationId.
async function getRefundOperationByReservationId(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, reservation_id, order_id, stripe_payment_intent_id, stripe_refund_id,
           amount_cents, currency, status, idempotency_key, failure_code, failure_message
    FROM refund_operations
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Define the async function getDateBlocksForCar.
async function getDateBlocksForCar(carId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, car_id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
    ORDER BY start_date
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Return the resulting value to the caller.
  return result.rows;
}

// Define the async function countActiveReservationsForCar.
async function countActiveReservationsForCar(carId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE car_id = $1
      AND status IN ('pending_payment', 'processing_payment')
      AND hold_expires_at > NOW()
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function countActiveReservationsForSession.
async function countActiveReservationsForSession(sessionId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE session_id = $1
      AND status IN ('pending_payment', 'processing_payment')
      AND hold_expires_at > NOW()
    `,
    // Contribute this line to the enclosing declaration or statement.
    [sessionId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function countReservationsForSession.
async function countReservationsForSession(sessionId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `SELECT COUNT(*)::int AS count FROM reservations WHERE session_id = $1`,
    // Contribute this line to the enclosing declaration or statement.
    [sessionId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function countReholdHistory.
async function countReholdHistory(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM reservation_status_history
    WHERE reservation_id = $1
      AND reason = 'customer_reheld'
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function setHoldExpired.
async function setHoldExpired(reservationId, expiredAt = new Date('2020-01-01T00:00:00.000Z')) {
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `
    UPDATE reservations
    SET hold_expires_at = $2, updated_at = NOW()
    WHERE id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId, expiredAt]
  );
}

// Define the async function insertDateBlock.
async function insertDateBlock(carId, startDate, endDate) {
  // Wait until the asynchronous operation resolves.
  await addRange(carId, startDate, endDate);
}

// Define the async function countProcessedStripeEvents.
async function countProcessedStripeEvents(eventId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    'SELECT COUNT(*)::int AS count FROM processed_stripe_events WHERE event_id = $1',
    // Contribute this line to the enclosing declaration or statement.
    [eventId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function countOrdersForCar.
async function countOrdersForCar(carId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    'SELECT COUNT(*)::int AS count FROM orders WHERE car_id = $1 AND is_deleted = FALSE',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function getActiveReservationForCar.
async function getActiveReservationForCar(carId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Define the async function clearStripeSessionId.
async function clearStripeSessionId(reservationId) {
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `
    UPDATE reservations
    SET stripe_session_id = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
}

// Define the async function countPaymentEventsForReservation.
async function countPaymentEventsForReservation(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    'SELECT COUNT(*)::int AS count FROM payment_events WHERE reservation_id = $1',
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows[0].count;
}

// Define the async function cleanupTestCar.
async function cleanupTestCar(carId) {
  // Evaluate the condition and enter the branch when it is true.
  if (!carId) return;

  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM payment_events WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM payment_failures WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Also drop processed events for superseded/stale stub sessions that lost their reservation link.
  await pool.query(
    // Continue the surrounding logic with this statement.
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
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM cars WHERE id = $1', [carId]);
}

// Define the buildOrderBody function.
function buildOrderBody(carId, overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Provide the pickup date field value.
    pickupDate: '2030-06-01',
    // Provide the return date field value.
    returnDate: '2030-06-05',
    // Provide the pickup time field value.
    pickupTime: '10:00',
    // Provide the return time field value.
    returnTime: '10:00',
    // Provide the pickup location field value.
    pickupLocation: 'office',
    // Provide the return location field value.
    returnLocation: 'office',
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Define the buildCheckoutBody function.
function buildCheckoutBody(carId, overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Call ...buildOrderBody to perform this step.
    ...buildOrderBody(carId, overrides),
    // Provide the full name field value.
    fullName: 'Jane Doe',
    // Provide the phone number field value.
    phoneNumber: '+359888123456',
    // Provide the email field value.
    email: 'jane@example.com',
    // Provide the address field value.
    address: 'Main St 1',
    // Provide the hotel name field value.
    hotelName: 'Hotel Test',
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Define the buildAdminOrderBody function.
function buildAdminOrderBody(carId, overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Call ...buildCheckoutBody to perform this step.
    ...buildCheckoutBody(carId, overrides),
    // Provide the full name field value.
    fullName: 'Admin Guest',
    // Provide the email field value.
    email: 'admin.guest@example.com',
  };
}

// Define the rentalDaysBetween function.
function rentalDaysBetween(pickupDate, returnDate) {
  // Create the start constant.
  const start = parseSofiaDate(pickupDate, '00:00');
  // Create the end constant.
  const end = parseSofiaDate(returnDate, '00:00');
  // Evaluate the condition and enter the branch when it is true.
  if (!start || !end) {
    // Throw an error to stop the current control flow.
    throw new Error(`Invalid Sofia dates for rentalDays: ${pickupDate} → ${returnDate}`);
  }
  // Create the days constant.
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  // Return the resulting value to the caller.
  return Math.max(1, days);
}

// Define the async function getStatusHistory.
async function getStatusHistory(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT id, reservation_id, old_status, new_status, reason
    FROM reservation_status_history
    WHERE reservation_id = $1
    ORDER BY id ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return result.rows;
}

// Define the async function cleanupReservationsForCar.
async function cleanupReservationsForCar(carId) {
  // Evaluate the condition and enter the branch when it is true.
  if (!carId) return;

  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM payment_events WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    'DELETE FROM payment_failures WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM processed_stripe_events
    WHERE stripe_session_id IN (
      SELECT stripe_session_id FROM reservations WHERE car_id = $1 AND stripe_session_id IS NOT NULL
      UNION
      SELECT stripe_session_id FROM orders WHERE car_id = $1 AND stripe_session_id IS NOT NULL
    )
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
}

// Define the async function getRoleBySlug.
async function getRoleBySlug(slug) {
  // Create the result constant.
  const result = await pool.query(`SELECT id, slug, name FROM roles WHERE slug = $1 LIMIT 1`, [
    // Contribute this line to the enclosing declaration or statement.
    slug,
  ]);
  // Evaluate the condition and enter the branch when it is true.
  if (!result.rows[0]) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(result.rows[0].id),
    // Provide the slug field value.
    slug: String(result.rows[0].slug),
    // Provide the name field value.
    name: String(result.rows[0].name),
  };
}

// Define the async function insertTestStaff.
async function insertTestStaff({
  // Contribute this line to the enclosing declaration or statement.
  roleSlug,
  // Contribute this line to the enclosing declaration or statement.
  email,
  // Update password with the right-hand side value.
  password = STAFF_PASSWORD,
// Continue the surrounding logic with this statement.
} = {}) {
  // Create the normalized email constant.
  const normalizedEmail = (
    // Continue the surrounding logic with this statement.
    email || `staff-${roleSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  // Continue the surrounding logic with this statement.
  ).toLowerCase();
  // Create the hashed password constant.
  const hashedPassword = await bcrypt.hash(password, 10);
  // Create the role constant.
  const role = await getRoleBySlug(roleSlug);
  // Evaluate the condition and enter the branch when it is true.
  if (!role) {
    // Throw an error to stop the current control flow.
    throw new Error(`insertTestStaff: role slug not found: ${roleSlug}`);
  }

  // Create the legacy role constant.
  const legacyRole = roleSlug === 'owner' ? 'admin' : 'staff';
  // Create the existing constant.
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [
    // Contribute this line to the enclosing declaration or statement.
    normalizedEmail,
  ]);

  // Reserve the user id variable for later assignment.
  let userId;
  // Evaluate the condition and enter the branch when it is true.
  if (existing.rows[0]) {
    // Update userId with the right-hand side value.
    userId = Number(existing.rows[0].id);
    // Wait until the asynchronous operation resolves.
    await pool.query(
      // Continue the surrounding logic with this statement.
      `UPDATE users SET password = $2, role = $3, updated_at = NOW() WHERE id = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [userId, hashedPassword, legacyRole]
    );
    // Wait until the asynchronous operation resolves.
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Create the inserted constant.
    const inserted = await pool.query(
      // Continue the surrounding logic with this statement.
      `INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id`,
      // Contribute this line to the enclosing declaration or statement.
      [normalizedEmail, hashedPassword, legacyRole]
    );
    // Update userId with the right-hand side value.
    userId = Number(inserted.rows[0].id);
  }

  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO user_roles (user_id, role_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    // Contribute this line to the enclosing declaration or statement.
    [userId, role.id]
  );

  // Return the resulting value to the caller.
  return { userId, email: normalizedEmail, password, roleSlug };
}

// Define the async function cleanupTestStaff.
async function cleanupTestStaff(email) {
  // Create the normalized constant.
  const normalized = String(email || '').toLowerCase();
  // Evaluate the condition and enter the branch when it is true.
  if (!normalized) return;
  // Evaluate the condition and enter the branch when it is true.
  if (normalized === DEFAULT_ADMIN.email.toLowerCase()) {
    // Throw an error to stop the current control flow.
    throw new Error('cleanupTestStaff: refusing to delete sole owner admin email');
  }

  // Create the user constant.
  const user = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalized]);
  // Evaluate the condition and enter the branch when it is true.
  if (!user.rows[0]) return;
  // Create the user id constant.
  const userId = Number(user.rows[0].id);

  // Create the owner count constant.
  const ownerCount = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS owners
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.slug = 'owner'
    `
  );
  // Create the is owner constant.
  const isOwner = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1 AND r.slug = 'owner'
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [userId]
  );
  // Evaluate the condition and enter the branch when it is true.
  if (isOwner.rows[0] && Number(ownerCount.rows[0].owners) <= 1) {
    // Throw an error to stop the current control flow.
    throw new Error('cleanupTestStaff: refusing to delete the last owner');
  }

  // Wait until the asynchronous operation resolves.
  await pool.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM calendar_tasks WHERE assigned_to_user_id = $1 OR created_by_user_id = $1`,
    // Contribute this line to the enclosing declaration or statement.
    [userId]
  );
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  // Wait until the asynchronous operation resolves.
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

// Define the async function insertLinkedBooking.
async function insertLinkedBooking(options) {
  // Create the pickup date constant.
  const pickupDate = options.pickupDate || '2031-03-01';
  // Create the return date constant.
  const returnDate = options.returnDate || '2031-03-04';
  // Create the pickup time constant.
  const pickupTime = options.pickupTime || '10:00';
  // Create the return time constant.
  const returnTime = options.returnTime || '10:00';
  // Create the pickup at constant.
  const pickupAt = parseSofiaDate(pickupDate, pickupTime);
  // Create the return at constant.
  const returnAt = parseSofiaDate(returnDate, returnTime);
  // Evaluate the condition and enter the branch when it is true.
  if (!pickupAt || !returnAt) {
    // Throw an error to stop the current control flow.
    throw new Error(`Failed to parse Sofia pickup/return for linked booking`);
  }

  // Create the rental days constant.
  const rentalDays = options.rentalDays ?? rentalDaysBetween(pickupDate, returnDate);
  // Create the day price constant.
  const dayPrice = options.dayPrice ?? 55;
  // Create the total price constant.
  const totalPrice = options.totalPrice ?? dayPrice * rentalDays;
  // Create the guest constant.
  const guest = { ...DEFAULT_GUEST, ...options.guest };
  // Create the session id constant.
  const sessionId =
    // Continue the surrounding logic with this statement.
    options.sessionId || `int-linked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Create the price snapshot constant.
  const priceSnapshot = {
    // Provide the currency field value.
    currency: 'EUR',
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    dayPrice,
    // Contribute this line to the enclosing declaration or statement.
    totalPrice,
  };
  // Create the with history constant.
  const withHistory = options.withHistory !== false;
  // Create the order status constant.
  const orderStatus = options.orderStatus || 'active';
  // Create the hold expires at constant.
  const holdExpiresAt = options.holdExpiresAt || new Date(Date.now() + 60 * 60 * 1000);
  // Create the is hold constant.
  const isHold = HOLD_SEED_STATUSES.has(String(options.status));
  // Create the with order constant.
  const withOrder = options.withOrder ?? !isHold;
  // Create the with block constant.
  const withBlock = options.withBlock ?? !isHold;
  // Create the user id constant.
  const userId = options.userId ?? null;

  // Create the client constant.
  const client = await pool.connect();
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Create the reservation result constant.
    const reservationResult = await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO reservations (
        car_id, session_id, user_id,
        pickup_date, pickup_time, return_date, return_time,
        pickup_location, return_location,
        rental_days, delivery_price, return_price, total_price,
        full_name, phone_number, email, address, hotel_name,
        status, hold_expires_at, stripe_session_id, stripe_payment_intent_id, price_snapshot
      )
      VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23::jsonb
      )
      RETURNING id
      `,
      [
        // Contribute this line to the enclosing declaration or statement.
        options.carId,
        // Contribute this line to the enclosing declaration or statement.
        sessionId,
        // Contribute this line to the enclosing declaration or statement.
        userId,
        // Contribute this line to the enclosing declaration or statement.
        pickupAt,
        // Contribute this line to the enclosing declaration or statement.
        pickupTime,
        // Contribute this line to the enclosing declaration or statement.
        returnAt,
        // Contribute this line to the enclosing declaration or statement.
        returnTime,
        // Contribute this line to the enclosing declaration or statement.
        options.pickupLocation || 'office',
        // Contribute this line to the enclosing declaration or statement.
        options.returnLocation || 'office',
        // Contribute this line to the enclosing declaration or statement.
        rentalDays,
        // Contribute this line to the enclosing declaration or statement.
        options.deliveryPrice ?? 0,
        // Contribute this line to the enclosing declaration or statement.
        options.returnPrice ?? 0,
        // Contribute this line to the enclosing declaration or statement.
        totalPrice,
        // Contribute this line to the enclosing declaration or statement.
        guest.fullName,
        // Contribute this line to the enclosing declaration or statement.
        guest.phoneNumber,
        // Contribute this line to the enclosing declaration or statement.
        guest.email,
        // Contribute this line to the enclosing declaration or statement.
        guest.address,
        // Contribute this line to the enclosing declaration or statement.
        guest.hotelName,
        // Contribute this line to the enclosing declaration or statement.
        options.status,
        // Contribute this line to the enclosing declaration or statement.
        holdExpiresAt,
        // Contribute this line to the enclosing declaration or statement.
        options.stripeSessionId ?? null,
        // Contribute this line to the enclosing declaration or statement.
        options.stripePaymentIntentId ?? null,
        // Call JSON.stringify to perform this step.
        JSON.stringify(priceSnapshot),
      ]
    );
    // Create the reservation id constant.
    const reservationId = Number(reservationResult.rows[0].id);

    // Evaluate the condition and enter the branch when it is true.
    if (withHistory) {
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservation_status_history (
          reservation_id, old_status, new_status,
          changed_by_system, reason, metadata
        )
        VALUES ($1, NULL, $2, TRUE, $3, $4::jsonb)
        `,
        [
          // Contribute this line to the enclosing declaration or statement.
          reservationId,
          // Contribute this line to the enclosing declaration or statement.
          options.status,
          // Supply the literal value used by the enclosing expression.
          'seed_linked_booking',
          // Call JSON.stringify to perform this step.
          JSON.stringify({ source: 'integration_seed_linked_booking' }),
        ]
      );
    }

    // Initialize the mutable order id variable.
    let orderId = null;
    // Evaluate the condition and enter the branch when it is true.
    if (withOrder) {
      // Create the order result constant.
      const orderResult = await client.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO orders (
          reservation_id, car_id, user_id,
          pickup_date, pickup_time, return_date, return_time,
          pickup_location, return_location,
          rental_days, delivery_price, return_price, total_price,
          full_name, phone_number, email, address, hotel_name,
          status, price_snapshot
        )
        VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20::jsonb
        )
        RETURNING id
        `,
        [
          // Contribute this line to the enclosing declaration or statement.
          reservationId,
          // Contribute this line to the enclosing declaration or statement.
          options.carId,
          // Contribute this line to the enclosing declaration or statement.
          userId,
          // Contribute this line to the enclosing declaration or statement.
          pickupAt,
          // Contribute this line to the enclosing declaration or statement.
          pickupTime,
          // Contribute this line to the enclosing declaration or statement.
          returnAt,
          // Contribute this line to the enclosing declaration or statement.
          returnTime,
          // Contribute this line to the enclosing declaration or statement.
          options.pickupLocation || 'office',
          // Contribute this line to the enclosing declaration or statement.
          options.returnLocation || 'office',
          // Contribute this line to the enclosing declaration or statement.
          rentalDays,
          // Contribute this line to the enclosing declaration or statement.
          options.deliveryPrice ?? 0,
          // Contribute this line to the enclosing declaration or statement.
          options.returnPrice ?? 0,
          // Contribute this line to the enclosing declaration or statement.
          totalPrice,
          // Contribute this line to the enclosing declaration or statement.
          guest.fullName,
          // Contribute this line to the enclosing declaration or statement.
          guest.phoneNumber,
          // Contribute this line to the enclosing declaration or statement.
          guest.email,
          // Contribute this line to the enclosing declaration or statement.
          guest.address,
          // Contribute this line to the enclosing declaration or statement.
          guest.hotelName,
          // Contribute this line to the enclosing declaration or statement.
          orderStatus,
          // Call JSON.stringify to perform this step.
          JSON.stringify(priceSnapshot),
        ]
      );
      // Update orderId with the right-hand side value.
      orderId = Number(orderResult.rows[0].id);
    }

    // Initialize the mutable block id variable.
    let blockId = null;
    // Evaluate the condition and enter the branch when it is true.
    if (withBlock) {
      // Create the block result constant.
      const blockResult = await client.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type)
        VALUES ($1, $2, $3, 'booking')
        RETURNING id
        `,
        // Contribute this line to the enclosing declaration or statement.
        [options.carId, pickupAt, returnAt]
      );
      // Update blockId with the right-hand side value.
      blockId = Number(blockResult.rows[0].id);
    }

    // Wait until the asynchronous operation resolves.
    await client.query('COMMIT');
    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      orderId,
      // Contribute this line to the enclosing declaration or statement.
      blockId,
      // Contribute this line to the enclosing declaration or statement.
      sessionId,
      // Contribute this line to the enclosing declaration or statement.
      pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      returnDate,
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await client.query('ROLLBACK');
    // Throw an error to stop the current control flow.
    throw err;
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Call client.release to perform this step.
    client.release();
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_ADMIN,
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_GUEST,
  // Contribute this line to the enclosing declaration or statement.
  STAFF_PASSWORD,
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  getRoleBySlug,
  // Contribute this line to the enclosing declaration or statement.
  insertLinkedBooking,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  getRefundOperationByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  getStatusHistory,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForSession,
  // Contribute this line to the enclosing declaration or statement.
  countReservationsForSession,
  // Contribute this line to the enclosing declaration or statement.
  countReholdHistory,
  // Contribute this line to the enclosing declaration or statement.
  setHoldExpired,
  // Contribute this line to the enclosing declaration or statement.
  insertDateBlock,
  // Contribute this line to the enclosing declaration or statement.
  countProcessedStripeEvents,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
  // Contribute this line to the enclosing declaration or statement.
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  clearStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  countPaymentEventsForReservation,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderBody,
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutBody,
  // Contribute this line to the enclosing declaration or statement.
  buildAdminOrderBody,
};
