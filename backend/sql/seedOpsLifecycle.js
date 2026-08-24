#!/usr/bin/env node
/**
 * Seeds reservation lifecycle samples for Ops dashboard testing.
 * Idempotent: removes previous rows with session_id LIKE 'seed-ops-%'.
 *
 * Usage: node sql/seedOpsLifecycle.js
 */
require('dotenv').config();

const pool = require('../src/db/pool');
const { requireDatabaseUrl } = require('./dbCliUtils');
const {
  getSofiaIsoDateString,
  parseSofiaDate,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
} = require('../src/utils/date/timezone');

const SESSION_PREFIX = 'seed-ops-';

function sofiaDayOffset(days, time = '10:00') {
  const base = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), days));
  return parseSofiaDate(base, time);
}

function contact(name, email, phone) {
  return {
    fullName: name,
    email,
    phoneNumber: phone,
    address: '1 Demo Street, Sofia',
    hotelName: null,
  };
}

async function clearPreviousSeed(client) {
  await client.query(
    `
    DELETE FROM refund_operations
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE session_id LIKE $1
    )
    `,
    [`${SESSION_PREFIX}%`]
  );

  await client.query(
    `
    DELETE FROM orders
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE session_id LIKE $1
    )
    OR email LIKE 'ops.seed.%@example.com'
    `,
    [`${SESSION_PREFIX}%`]
  );

  await client.query(
    `
    DELETE FROM reservation_status_history
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE session_id LIKE $1
    )
    `,
    [`${SESSION_PREFIX}%`]
  );

  await client.query(`DELETE FROM reservations WHERE session_id LIKE $1`, [
    `${SESSION_PREFIX}%`,
  ]);

  await client.query(
    `
    DELETE FROM car_date_blocks b
    WHERE EXISTS (
      SELECT 1
      FROM cars c
      WHERE c.id = b.car_id
        AND c.name IN (
          'Volkswagen Golf 7',
          'BMW 320d',
          'Toyota RAV4',
          'Mercedes-Benz E-Class',
          'Audi A4'
        )
    )
      AND b.start_date >= (NOW() - INTERVAL '14 days')
      AND b.end_date <= (NOW() + INTERVAL '30 days')
    `
  );
}

async function insertReservation(client, row) {
  const result = await client.query(
    `
    INSERT INTO reservations (
      car_id, session_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price,
      full_name, phone_number, email, address, hotel_name,
      status, hold_expires_at, stripe_session_id
    )
    VALUES (
      $1, $2,
      $3, $4, $5, $6,
      $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20
    )
    RETURNING id, status
    `,
    [
      row.carId,
      row.sessionId,
      row.pickupDate,
      row.pickupTime,
      row.returnDate,
      row.returnTime,
      row.pickupLocation || 'sofia',
      row.returnLocation || 'sofia',
      row.rentalDays,
      row.deliveryPrice ?? 0,
      row.returnPrice ?? 0,
      row.totalPrice,
      row.fullName,
      row.phoneNumber,
      row.email,
      row.address,
      row.hotelName,
      row.status,
      row.holdExpiresAt,
      row.stripeSessionId || null,
    ]
  );

  return result.rows[0];
}

async function insertHistory(client, reservationId, transitions) {
  for (const step of transitions) {
    await client.query(
      `
      INSERT INTO reservation_status_history (
        reservation_id, old_status, new_status,
        changed_by_system, reason, metadata
      )
      VALUES ($1, $2, $3, TRUE, $4, $5::jsonb)
      `,
      [
        reservationId,
        step.oldStatus ?? null,
        step.newStatus,
        step.reason || 'seed_ops',
        JSON.stringify(step.metadata || { source: 'seed_ops' }),
      ]
    );
  }
}

async function insertOrder(client, reservation, carId) {
  const result = await client.query(
    `
    INSERT INTO orders (
      reservation_id, car_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price,
      full_name, phone_number, email, address, hotel_name,
      status
    )
    VALUES (
      $1, $2,
      $3, $4, $5, $6,
      $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16, $17,
      'active'
    )
    RETURNING id
    `,
    [
      reservation.id,
      carId,
      reservation.pickupDate,
      reservation.pickupTime,
      reservation.returnDate,
      reservation.returnTime,
      reservation.pickupLocation || 'sofia',
      reservation.returnLocation || 'sofia',
      reservation.rentalDays,
      reservation.deliveryPrice ?? 0,
      reservation.returnPrice ?? 0,
      reservation.totalPrice,
      reservation.fullName,
      reservation.phoneNumber,
      reservation.email,
      reservation.address,
      reservation.hotelName,
    ]
  );
  return result.rows[0];
}

async function insertBlock(client, carId, start, end) {
  try {
    await client.query(
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date)
      VALUES ($1, $2, $3)
      `,
      [carId, start, end]
    );
  } catch (err) {
    // Exclusion / overlap — keep reservation for Ops even if block already exists.
    if (err.code === '23P01') {
      return;
    }
    throw err;
  }
}

async function seedOpsLifecycle({ endPool = true } = {}) {
  requireDatabaseUrl();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const carsResult = await client.query(
      `
      SELECT id, name
      FROM cars
      WHERE COALESCE(is_deleted, false) = false
      ORDER BY id
      LIMIT 5
      `
    );
    const cars = carsResult.rows;
    if (cars.length < 5) {
      throw new Error('Need at least 5 cars. Run npm run db:seed first.');
    }

    const [golf, bmw, rav4, mercedes, audi] = cars;
    await clearPreviousSeed(client);

    const today = getSofiaIsoDateString(new Date());
    const scenarios = [];

    const c1 = contact('Ops Pickup Confirmed', 'ops.seed.pickup1@example.com', '+359888100001');
    const pickupConfirmed = {
      carId: golf.id,
      sessionId: `${SESSION_PREFIX}pickup-confirmed`,
      pickupDate: sofiaDayOffset(0, '10:00'),
      pickupTime: '10:00',
      returnDate: sofiaDayOffset(3, '10:00'),
      returnTime: '10:00',
      rentalDays: 3,
      totalPrice: 180,
      ...c1,
      status: 'confirmed',
      holdExpiresAt: new Date(),
      withOrder: true,
      withBlock: true,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
        { oldStatus: 'processing_payment', newStatus: 'paid', reason: 'stripe_payment_received' },
        { oldStatus: 'paid', newStatus: 'confirmed', reason: 'booking_finalized' },
      ],
    };
    scenarios.push(pickupConfirmed);

    const c2 = contact('Ops Car Prepared', 'ops.seed.prepared@example.com', '+359888100002');
    scenarios.push({
      carId: bmw.id,
      sessionId: `${SESSION_PREFIX}car-prepared`,
      pickupDate: sofiaDayOffset(0, '14:00'),
      pickupTime: '14:00',
      returnDate: sofiaDayOffset(2, '14:00'),
      returnTime: '14:00',
      rentalDays: 2,
      totalPrice: 220,
      ...c2,
      status: 'car_prepared',
      holdExpiresAt: new Date(),
      withOrder: true,
      withBlock: true,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
        { oldStatus: 'processing_payment', newStatus: 'paid', reason: 'stripe_payment_received' },
        { oldStatus: 'paid', newStatus: 'confirmed', reason: 'booking_finalized' },
        { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
      ],
    });

    const c3 = contact('Ops Return Today', 'ops.seed.return@example.com', '+359888100003');
    scenarios.push({
      carId: rav4.id,
      sessionId: `${SESSION_PREFIX}return-today`,
      pickupDate: sofiaDayOffset(-3, '09:00'),
      pickupTime: '09:00',
      returnDate: sofiaDayOffset(0, '18:00'),
      returnTime: '18:00',
      rentalDays: 3,
      totalPrice: 240,
      ...c3,
      status: 'picked_up',
      holdExpiresAt: new Date(),
      withOrder: true,
      withBlock: true,
      history: [
        { oldStatus: null, newStatus: 'confirmed', reason: 'admin_order_link' },
        { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
        { oldStatus: 'car_prepared', newStatus: 'picked_up', reason: 'admin_ops' },
      ],
    });

    const c4 = contact('Ops Active Rental', 'ops.seed.active@example.com', '+359888100004');
    scenarios.push({
      carId: mercedes.id,
      sessionId: `${SESSION_PREFIX}active-rental`,
      pickupDate: sofiaDayOffset(-2, '11:00'),
      pickupTime: '11:00',
      returnDate: sofiaDayOffset(4, '11:00'),
      returnTime: '11:00',
      rentalDays: 6,
      totalPrice: 720,
      ...c4,
      status: 'active_rental',
      holdExpiresAt: new Date(),
      withOrder: true,
      withBlock: true,
      history: [
        { oldStatus: null, newStatus: 'confirmed', reason: 'admin_order_link' },
        { oldStatus: 'confirmed', newStatus: 'picked_up', reason: 'admin_ops' },
        { oldStatus: 'picked_up', newStatus: 'active_rental', reason: 'admin_ops' },
      ],
    });

    const c5 = contact('Ops Overdue Return', 'ops.seed.overdue@example.com', '+359888100005');
    scenarios.push({
      carId: audi.id,
      sessionId: `${SESSION_PREFIX}overdue-return`,
      pickupDate: sofiaDayOffset(-5, '10:00'),
      pickupTime: '10:00',
      returnDate: sofiaDayOffset(-1, '10:00'),
      returnTime: '10:00',
      rentalDays: 4,
      totalPrice: 400,
      ...c5,
      status: 'picked_up',
      holdExpiresAt: new Date(),
      withOrder: true,
      withBlock: true,
      history: [
        { oldStatus: null, newStatus: 'confirmed', reason: 'admin_order_link' },
        { oldStatus: 'confirmed', newStatus: 'picked_up', reason: 'admin_ops' },
      ],
    });

    const c6 = contact('Ops Manual Review', 'ops.seed.manual@example.com', '+359888100006');
    scenarios.push({
      carId: golf.id,
      sessionId: `${SESSION_PREFIX}manual-review`,
      pickupDate: sofiaDayOffset(10, '10:00'),
      pickupTime: '10:00',
      returnDate: sofiaDayOffset(13, '10:00'),
      returnTime: '10:00',
      rentalDays: 3,
      totalPrice: 210,
      ...c6,
      status: 'manual_review',
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      stripeSessionId: `cs_seed_manual_${Date.now()}`,
      withOrder: false,
      withBlock: false,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
        {
          oldStatus: 'processing_payment',
          newStatus: 'manual_review',
          reason: 'overlap_after_payment',
        },
      ],
    });

    const c7 = contact('Ops Paid Pending', 'ops.seed.paid@example.com', '+359888100007');
    scenarios.push({
      carId: bmw.id,
      sessionId: `${SESSION_PREFIX}paid`,
      pickupDate: sofiaDayOffset(12, '12:00'),
      pickupTime: '12:00',
      returnDate: sofiaDayOffset(15, '12:00'),
      returnTime: '12:00',
      rentalDays: 3,
      totalPrice: 270,
      ...c7,
      status: 'paid',
      holdExpiresAt: new Date(),
      stripeSessionId: `cs_seed_paid_${Date.now()}`,
      withOrder: false,
      withBlock: false,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
        { oldStatus: 'processing_payment', newStatus: 'paid', reason: 'stripe_payment_received' },
      ],
    });

    const c8 = contact('Ops Cancelled', 'ops.seed.cancelled@example.com', '+359888100008');
    scenarios.push({
      carId: rav4.id,
      sessionId: `${SESSION_PREFIX}cancelled`,
      pickupDate: sofiaDayOffset(8, '09:00'),
      pickupTime: '09:00',
      returnDate: sofiaDayOffset(11, '09:00'),
      returnTime: '09:00',
      rentalDays: 3,
      totalPrice: 195,
      ...c8,
      status: 'cancelled',
      holdExpiresAt: new Date(),
      withOrder: false,
      withBlock: false,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        {
          oldStatus: 'pending_payment',
          newStatus: 'cancelled',
          reason: 'customer_released_hold',
        },
      ],
    });

    const c9 = contact('Ops Pending Payment', 'ops.seed.pending@example.com', '+359888100009');
    scenarios.push({
      carId: mercedes.id,
      sessionId: `${SESSION_PREFIX}pending-payment`,
      pickupDate: sofiaDayOffset(16, '10:00'),
      pickupTime: '10:00',
      returnDate: sofiaDayOffset(19, '10:00'),
      returnTime: '10:00',
      rentalDays: 3,
      totalPrice: 360,
      ...c9,
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() + 20 * 60 * 1000),
      withOrder: false,
      withBlock: false,
      history: [{ oldStatus: null, newStatus: 'pending_payment', reason: 'created' }],
    });

    const c10 = contact('Ops Processing', 'ops.seed.processing@example.com', '+359888100010');
    scenarios.push({
      carId: audi.id,
      sessionId: `${SESSION_PREFIX}processing-payment`,
      pickupDate: sofiaDayOffset(18, '15:00'),
      pickupTime: '15:00',
      returnDate: sofiaDayOffset(21, '15:00'),
      returnTime: '15:00',
      rentalDays: 3,
      totalPrice: 285,
      ...c10,
      status: 'processing_payment',
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      stripeSessionId: `cs_seed_processing_${Date.now()}`,
      withOrder: false,
      withBlock: false,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
      ],
    });

    const c11 = contact('Ops Expired Hold', 'ops.seed.expired@example.com', '+359888100011');
    scenarios.push({
      carId: golf.id,
      sessionId: `${SESSION_PREFIX}expired`,
      pickupDate: sofiaDayOffset(20, '10:00'),
      pickupTime: '10:00',
      returnDate: sofiaDayOffset(23, '10:00'),
      returnTime: '10:00',
      rentalDays: 3,
      totalPrice: 150,
      ...c11,
      status: 'expired',
      holdExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
      withOrder: false,
      withBlock: false,
      history: [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'expired', reason: 'hold_expired' },
      ],
    });

    const created = [];
    for (const scenario of scenarios) {
      const inserted = await insertReservation(client, scenario);
      await insertHistory(client, inserted.id, scenario.history);

      const full = { ...scenario, id: inserted.id };
      if (scenario.withOrder) {
        await insertOrder(client, full, scenario.carId);
      }
      if (scenario.withBlock) {
        try {
          await insertBlock(client, scenario.carId, scenario.pickupDate, scenario.returnDate);
        } catch (err) {
          // Overlap with existing blocks is fine for demo; keep reservation visible in Ops.
          if (err.code !== '23P01' && err.code !== 'OVERLAP') {
            throw err;
          }
        }
      }

      created.push({ id: inserted.id, status: inserted.status, sessionId: scenario.sessionId });
    }

    await client.query('COMMIT');

    console.log(`✓ Seeded ${created.length} ops lifecycle reservations (Sofia day ${today})`);
    for (const row of created) {
      console.log(`  #${row.id}  ${row.status.padEnd(20)}  ${row.sessionId}`);
    }
    console.log('');
    console.log('Open Admin → Ops (/admin/reservations) to test status changes.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    if (endPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  seedOpsLifecycle().catch((err) => {
    console.error('Ops lifecycle seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedOpsLifecycle };
