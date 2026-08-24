const bcrypt = require('bcrypt');
const { pool } = require('../../helpers/dbTestHarness');
const { addRange } = require('../../../src/services/sql/bookingSyncSqlService');
const { parseSofiaDate } = require('../../../src/utils/date/timezone');

const DEFAULT_ADMIN = {
  email: 'admin@luxride.local',
  password: 'Admin123!',
};

const DEFAULT_GUEST = {
  fullName: 'Integration Guest',
  phoneNumber: '+359888123456',
  email: 'integration-guest@example.com',
  address: 'Test Street 1',
  hotelName: 'Test Hotel',
};

const HOLD_SEED_STATUSES = new Set(['pending_payment', 'processing_payment']);
const STAFF_PASSWORD = 'Staff123!';

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
    SELECT id, car_id, session_id, status, stripe_session_id, stripe_payment_intent_id,
           hold_expires_at, pickup_date, return_date, total_price, email, full_name
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
    SELECT id, car_id, session_id, status, stripe_session_id, stripe_payment_intent_id,
           hold_expires_at, pickup_date, pickup_time, return_date, return_time,
           total_price, email, full_name, price_snapshot
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
    SELECT id, car_id, reservation_id, status, stripe_session_id, email, total_price,
           is_deleted, deleted_at
    FROM orders
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [reservationId]
  );
  return result.rows[0] || null;
}

async function getRefundOperationByReservationId(reservationId) {
  const result = await pool.query(
    `
    SELECT id, reservation_id, order_id, stripe_payment_intent_id, stripe_refund_id,
           amount_cents, currency, status, idempotency_key, failure_code, failure_message
    FROM refund_operations
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
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
    'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    [carId]
  );
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

function rentalDaysBetween(pickupDate, returnDate) {
  const start = parseSofiaDate(pickupDate, '00:00');
  const end = parseSofiaDate(returnDate, '00:00');
  if (!start || !end) {
    throw new Error(`Invalid Sofia dates for rentalDays: ${pickupDate} → ${returnDate}`);
  }
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

async function getStatusHistory(reservationId) {
  const result = await pool.query(
    `
    SELECT id, reservation_id, old_status, new_status, reason
    FROM reservation_status_history
    WHERE reservation_id = $1
    ORDER BY id ASC
    `,
    [reservationId]
  );
  return result.rows;
}

async function cleanupReservationsForCar(carId) {
  if (!carId) return;

  await pool.query(
    'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)',
    [carId]
  );
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
    `,
    [carId]
  );
  await pool.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
}

async function getRoleBySlug(slug) {
  const result = await pool.query(`SELECT id, slug, name FROM roles WHERE slug = $1 LIMIT 1`, [
    slug,
  ]);
  if (!result.rows[0]) return null;
  return {
    id: Number(result.rows[0].id),
    slug: String(result.rows[0].slug),
    name: String(result.rows[0].name),
  };
}

async function insertTestStaff({
  roleSlug,
  email,
  password = STAFF_PASSWORD,
} = {}) {
  const normalizedEmail = (
    email || `staff-${roleSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  ).toLowerCase();
  const hashedPassword = await bcrypt.hash(password, 10);
  const role = await getRoleBySlug(roleSlug);
  if (!role) {
    throw new Error(`insertTestStaff: role slug not found: ${roleSlug}`);
  }

  const legacyRole = roleSlug === 'owner' ? 'admin' : 'staff';
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [
    normalizedEmail,
  ]);

  let userId;
  if (existing.rows[0]) {
    userId = Number(existing.rows[0].id);
    await pool.query(
      `UPDATE users SET password = $2, role = $3, updated_at = NOW() WHERE id = $1`,
      [userId, hashedPassword, legacyRole]
    );
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id`,
      [normalizedEmail, hashedPassword, legacyRole]
    );
    userId = Number(inserted.rows[0].id);
  }

  await pool.query(
    `
    INSERT INTO user_roles (user_id, role_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [userId, role.id]
  );

  return { userId, email: normalizedEmail, password, roleSlug };
}

async function cleanupTestStaff(email) {
  const normalized = String(email || '').toLowerCase();
  if (!normalized) return;
  if (normalized === DEFAULT_ADMIN.email.toLowerCase()) {
    throw new Error('cleanupTestStaff: refusing to delete sole owner admin email');
  }

  const user = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalized]);
  if (!user.rows[0]) return;
  const userId = Number(user.rows[0].id);

  const ownerCount = await pool.query(
    `
    SELECT COUNT(*)::int AS owners
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.slug = 'owner'
    `
  );
  const isOwner = await pool.query(
    `
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1 AND r.slug = 'owner'
    LIMIT 1
    `,
    [userId]
  );
  if (isOwner.rows[0] && Number(ownerCount.rows[0].owners) <= 1) {
    throw new Error('cleanupTestStaff: refusing to delete the last owner');
  }

  await pool.query(
    `DELETE FROM calendar_tasks WHERE assigned_to_user_id = $1 OR created_by_user_id = $1`,
    [userId]
  );
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function insertLinkedBooking(options) {
  const pickupDate = options.pickupDate || '2031-03-01';
  const returnDate = options.returnDate || '2031-03-04';
  const pickupTime = options.pickupTime || '10:00';
  const returnTime = options.returnTime || '10:00';
  const pickupAt = parseSofiaDate(pickupDate, pickupTime);
  const returnAt = parseSofiaDate(returnDate, returnTime);
  if (!pickupAt || !returnAt) {
    throw new Error(`Failed to parse Sofia pickup/return for linked booking`);
  }

  const rentalDays = options.rentalDays ?? rentalDaysBetween(pickupDate, returnDate);
  const dayPrice = options.dayPrice ?? 55;
  const totalPrice = options.totalPrice ?? dayPrice * rentalDays;
  const guest = { ...DEFAULT_GUEST, ...options.guest };
  const sessionId =
    options.sessionId || `int-linked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const priceSnapshot = {
    currency: 'EUR',
    rentalDays,
    dayPrice,
    totalPrice,
  };
  const withHistory = options.withHistory !== false;
  const orderStatus = options.orderStatus || 'active';
  const holdExpiresAt = options.holdExpiresAt || new Date(Date.now() + 60 * 60 * 1000);
  const isHold = HOLD_SEED_STATUSES.has(String(options.status));
  const withOrder = options.withOrder ?? !isHold;
  const withBlock = options.withBlock ?? !isHold;
  const userId = options.userId ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reservationResult = await client.query(
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
        options.carId,
        sessionId,
        userId,
        pickupAt,
        pickupTime,
        returnAt,
        returnTime,
        options.pickupLocation || 'office',
        options.returnLocation || 'office',
        rentalDays,
        options.deliveryPrice ?? 0,
        options.returnPrice ?? 0,
        totalPrice,
        guest.fullName,
        guest.phoneNumber,
        guest.email,
        guest.address,
        guest.hotelName,
        options.status,
        holdExpiresAt,
        options.stripeSessionId ?? null,
        options.stripePaymentIntentId ?? null,
        JSON.stringify(priceSnapshot),
      ]
    );
    const reservationId = Number(reservationResult.rows[0].id);

    if (withHistory) {
      await client.query(
        `
        INSERT INTO reservation_status_history (
          reservation_id, old_status, new_status,
          changed_by_system, reason, metadata
        )
        VALUES ($1, NULL, $2, TRUE, $3, $4::jsonb)
        `,
        [
          reservationId,
          options.status,
          'seed_linked_booking',
          JSON.stringify({ source: 'integration_seed_linked_booking' }),
        ]
      );
    }

    let orderId = null;
    if (withOrder) {
      const orderResult = await client.query(
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
          reservationId,
          options.carId,
          userId,
          pickupAt,
          pickupTime,
          returnAt,
          returnTime,
          options.pickupLocation || 'office',
          options.returnLocation || 'office',
          rentalDays,
          options.deliveryPrice ?? 0,
          options.returnPrice ?? 0,
          totalPrice,
          guest.fullName,
          guest.phoneNumber,
          guest.email,
          guest.address,
          guest.hotelName,
          orderStatus,
          JSON.stringify(priceSnapshot),
        ]
      );
      orderId = Number(orderResult.rows[0].id);
    }

    let blockId = null;
    if (withBlock) {
      const blockResult = await client.query(
        `
        INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type)
        VALUES ($1, $2, $3, 'booking')
        RETURNING id
        `,
        [options.carId, pickupAt, returnAt]
      );
      blockId = Number(blockResult.rows[0].id);
    }

    await client.query('COMMIT');
    return {
      reservationId,
      orderId,
      blockId,
      sessionId,
      pickupDate,
      returnDate,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  DEFAULT_ADMIN,
  DEFAULT_GUEST,
  STAFF_PASSWORD,
  insertIsolatedTestCar,
  insertTestAdmin,
  insertTestStaff,
  cleanupTestStaff,
  getRoleBySlug,
  insertLinkedBooking,
  getReservationByStripeSessionId,
  getReservationById,
  getOrderByReservationId,
  getRefundOperationByReservationId,
  getDateBlocksForCar,
  getStatusHistory,
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
  cleanupReservationsForCar,
  cleanupTestCar,
  buildOrderBody,
  buildCheckoutBody,
  buildAdminOrderBody,
};
