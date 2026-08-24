#!/usr/bin/env node
/**
 * Seeds customer-portal demo data for demo@luxride.local:
 * reservations, travel fields, cancellation request, documents,
 * pickup/return checklists (with private files).
 *
 * Idempotent: removes previous rows with session_id LIKE 'seed-portal-%'.
 *
 * Usage: node sql/seedCustomerPortal.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');
const userSql = require('../src/services/sql/userSqlService');
const { requireDatabaseUrl } = require('./dbCliUtils');
const privateStorage = require('../src/services/storage/privateStorageService');
const {
  parseSofiaDate,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
} = require('../src/utils/date/timezone');

const SESSION_PREFIX = 'seed-portal-';
const DEMO_EMAIL = process.env.SEED_DEMO_USER_EMAIL || 'demo@luxride.local';

/** Minimal 1x1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function sofiaDayOffset(days, time = '10:00') {
  const base = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), days));
  return parseSofiaDate(base, time);
}

async function storePng(category, filename) {
  return privateStorage.storePrivateBuffer({
    buffer: TINY_PNG,
    originalName: filename,
    category,
    mimeType: 'image/png',
  });
}

async function clearPreviousSeed(client) {
  await client.query(
    `
    DELETE FROM reservation_cancellation_requests
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE session_id LIKE $1
    )
    OR user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($2))
    `,
    [`${SESSION_PREFIX}%`, DEMO_EMAIL]
  );

  await client.query(
    `
    DELETE FROM reservation_pickup_checklists
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE session_id LIKE $1
    )
    `,
    [`${SESSION_PREFIX}%`]
  );

  await client.query(
    `
    DELETE FROM reservation_return_checklists
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE session_id LIKE $1
    )
    `,
    [`${SESSION_PREFIX}%`]
  );

  await client.query(
    `
    DELETE FROM customer_documents
    WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($1))
       OR reservation_id IN (
         SELECT id FROM reservations WHERE session_id LIKE $2
       )
    `,
    [DEMO_EMAIL, `${SESSION_PREFIX}%`]
  );

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
}

async function insertReservation(client, row) {
  const result = await client.query(
    `
    INSERT INTO reservations (
      car_id, session_id, user_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price, deposit,
      full_name, phone_number, email, address, hotel_name,
      flight_number, special_requests,
      status, hold_expires_at, stripe_session_id
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9,
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21,
      $22, $23, $24
    )
    RETURNING *
    `,
    [
      row.carId,
      row.sessionId,
      row.userId,
      row.pickupDate,
      row.pickupTime,
      row.returnDate,
      row.returnTime,
      row.pickupLocation || 'sofia-airport',
      row.returnLocation || 'sofia',
      row.rentalDays,
      row.deliveryPrice ?? 50,
      row.returnPrice ?? 0,
      row.totalPrice,
      row.deposit ?? 300,
      row.fullName,
      row.phoneNumber,
      row.email,
      row.address,
      row.hotelName,
      row.flightNumber || null,
      row.specialRequests || null,
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
        step.reason || 'seed_portal',
        JSON.stringify({ source: 'seed_customer_portal' }),
      ]
    );
  }
}

async function insertOrder(client, reservation, carId, userId) {
  const result = await client.query(
    `
    INSERT INTO orders (
      reservation_id, car_id, user_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price, deposit,
      full_name, phone_number, email, address, hotel_name,
      status
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9,
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      'active'
    )
    RETURNING id
    `,
    [
      reservation.id,
      carId,
      userId,
      reservation.pickup_date,
      reservation.pickup_time,
      reservation.return_date,
      reservation.return_time,
      reservation.pickup_location,
      reservation.return_location,
      reservation.rental_days,
      reservation.delivery_price,
      reservation.return_price,
      reservation.total_price,
      reservation.deposit,
      reservation.full_name,
      reservation.phone_number,
      reservation.email,
      reservation.address,
      reservation.hotel_name,
    ]
  );
  return result.rows[0];
}

async function seedCustomerPortal({ endPool = true } = {}) {
  requireDatabaseUrl();

  const client = await pool.connect();
  try {
    console.log('→ seed customer portal fixtures');

    let demoUser = await userSql.findUserByEmail(DEMO_EMAIL);
    if (!demoUser) {
      throw new Error(
        `Demo user ${DEMO_EMAIL} not found. Run npm run db:seed first (or create the user).`
      );
    }
    const userId = Number(demoUser.id);

    let adminUser = await userSql.findUserByEmail(
      process.env.SEED_ADMIN_EMAIL || 'admin@luxride.local'
    );
    const adminId = adminUser ? Number(adminUser.id) : null;

    const carsResult = await client.query(
      `
      SELECT id, name FROM cars
      WHERE is_deleted IS NOT TRUE
      ORDER BY id ASC
      LIMIT 5
      `
    );
    if (carsResult.rows.length < 3) {
      throw new Error('Need at least 3 cars. Run npm run db:seed first.');
    }
    const [car1, car2, car3] = carsResult.rows;

    await clearPreviousSeed(client);

    const baseContact = {
      fullName: 'Demo Customer',
      phoneNumber: '+359888200001',
      email: DEMO_EMAIL,
      address: 'Hotel Marinela, 100 James Bourchier Blvd, Sofia',
      hotelName: 'Hotel Marinela Sofia',
    };

    // 1) Upcoming confirmed — travel details + cancel-request eligible
    const upcoming = await insertReservation(client, {
      carId: car1.id,
      sessionId: `${SESSION_PREFIX}upcoming-confirmed`,
      userId,
      pickupDate: sofiaDayOffset(5, '10:00'),
      pickupTime: '10:00',
      returnDate: sofiaDayOffset(8, '10:00'),
      returnTime: '10:00',
      rentalDays: 3,
      totalPrice: 270,
      ...baseContact,
      flightNumber: 'FZ1756',
      specialRequests: 'Child seat if available; late flight arrival.',
      status: 'confirmed',
      holdExpiresAt: new Date(),
      stripeSessionId: `${SESSION_PREFIX}stripe-upcoming`,
    });
    await insertHistory(client, upcoming.id, [
      { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
      { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout' },
      { oldStatus: 'processing_payment', newStatus: 'paid', reason: 'stripe' },
      { oldStatus: 'paid', newStatus: 'confirmed', reason: 'finalized' },
    ]);
    await insertOrder(client, upcoming, car1.id, userId);

    await client.query(
      `
      INSERT INTO reservation_cancellation_requests (
        reservation_id, user_id, reason, status
      )
      VALUES ($1, $2, $3, 'pending')
      `,
      [upcoming.id, userId, 'Need to change travel dates — please review.']
    );

    // 2) Car prepared — ready for pickup checklist in admin
    const prepared = await insertReservation(client, {
      carId: car2.id,
      sessionId: `${SESSION_PREFIX}car-prepared`,
      userId,
      pickupDate: sofiaDayOffset(0, '14:00'),
      pickupTime: '14:00',
      returnDate: sofiaDayOffset(2, '14:00'),
      returnTime: '14:00',
      rentalDays: 2,
      totalPrice: 220,
      ...baseContact,
      flightNumber: 'W61302',
      specialRequests: 'Airport pickup sign with name.',
      status: 'car_prepared',
      holdExpiresAt: new Date(),
      stripeSessionId: `${SESSION_PREFIX}stripe-prepared`,
    });
    await insertHistory(client, prepared.id, [
      { oldStatus: null, newStatus: 'confirmed', reason: 'seed' },
      { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
    ]);
    await insertOrder(client, prepared, car2.id, userId);

    // 3) Active rental with completed pickup checklist
    const custSig = await storePng('signatures', 'customer-sig.png');
    const empSig = await storePng('signatures', 'employee-sig.png');
    const damagePhoto = await storePng('checklists', 'scratch-photo.png');

    const active = await insertReservation(client, {
      carId: car3.id,
      sessionId: `${SESSION_PREFIX}active-rental`,
      userId,
      pickupDate: sofiaDayOffset(-2, '11:00'),
      pickupTime: '11:00',
      returnDate: sofiaDayOffset(4, '11:00'),
      returnTime: '11:00',
      rentalDays: 6,
      totalPrice: 540,
      ...baseContact,
      flightNumber: 'FR6421',
      specialRequests: null,
      status: 'active_rental',
      holdExpiresAt: new Date(),
      stripeSessionId: `${SESSION_PREFIX}stripe-active`,
    });
    await insertHistory(client, active.id, [
      { oldStatus: null, newStatus: 'confirmed', reason: 'seed' },
      { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
      { oldStatus: 'car_prepared', newStatus: 'picked_up', reason: 'pickup_checklist' },
      { oldStatus: 'picked_up', newStatus: 'active_rental', reason: 'admin_ops' },
    ]);
    await insertOrder(client, active, car3.id, userId);

    await client.query(
      `
      INSERT INTO reservation_pickup_checklists (
        reservation_id, fuel_level, mileage, existing_damages, photos,
        customer_signature_key, employee_signature_key, pickup_time, notes,
        created_by_user_id
      )
      VALUES ($1, 'full', 45210, $2, $3::jsonb, $4, $5, $6, $7, $8)
      `,
      [
        active.id,
        'Small scratch on rear bumper (passenger side).',
        JSON.stringify([damagePhoto.storageKey]),
        custSig.storageKey,
        empSig.storageKey,
        sofiaDayOffset(-2, '11:05'),
        'Customer inspected vehicle; keys handed over.',
        adminId,
      ]
    );

    // 4) Completed rental with pickup + return checklists
    const completedCar = carsResult.rows[Math.min(3, carsResult.rows.length - 1)];
    const completed = await insertReservation(client, {
      carId: completedCar.id,
      sessionId: `${SESSION_PREFIX}completed`,
      userId,
      pickupDate: sofiaDayOffset(-10, '09:00'),
      pickupTime: '09:00',
      returnDate: sofiaDayOffset(-7, '09:00'),
      returnTime: '09:00',
      rentalDays: 3,
      totalPrice: 195,
      ...baseContact,
      hotelName: 'Sense Hotel Sofia',
      address: '18 Oborishte Street, Sofia',
      flightNumber: 'LH1425',
      specialRequests: 'Early check-in if possible.',
      status: 'completed',
      holdExpiresAt: new Date(),
      stripeSessionId: `${SESSION_PREFIX}stripe-completed`,
    });
    await insertHistory(client, completed.id, [
      { oldStatus: null, newStatus: 'confirmed', reason: 'seed' },
      { oldStatus: 'confirmed', newStatus: 'picked_up', reason: 'pickup' },
      { oldStatus: 'picked_up', newStatus: 'returned', reason: 'return_checklist' },
      { oldStatus: 'returned', newStatus: 'completed', reason: 'admin_ops' },
    ]);
    await insertOrder(client, completed, completedCar.id, userId);

    const retPhoto = await storePng('checklists', 'return-photo.png');
    await client.query(
      `
      INSERT INTO reservation_pickup_checklists (
        reservation_id, fuel_level, mileage, existing_damages, photos,
        customer_signature_key, employee_signature_key, pickup_time, notes,
        created_by_user_id
      )
      VALUES ($1, 'full', 12000, 'None noted', '[]'::jsonb, $2, $3, $4, $5, $6)
      `,
      [
        completed.id,
        custSig.storageKey,
        empSig.storageKey,
        sofiaDayOffset(-10, '09:10'),
        'Clean handover.',
        adminId,
      ]
    );
    await client.query(
      `
      INSERT INTO reservation_return_checklists (
        reservation_id, fuel_level, mileage, new_damages, photos,
        late_return, extra_fees, customer_signature_key, employee_signature_key,
        return_time, notes, created_by_user_id
      )
      VALUES ($1, 'three_quarters', 12480, $2, $3::jsonb, FALSE, 25, $4, $5, $6, $7, $8)
      `,
      [
        completed.id,
        'Minor scuff on alloy wheel — charged cleaning/extra fee.',
        JSON.stringify([retPhoto.storageKey]),
        custSig.storageKey,
        empSig.storageKey,
        sofiaDayOffset(-7, '09:20'),
        'Returned on time. Extra fee for wheel scuff.',
        adminId,
      ]
    );

    // Customer documents (license + passport)
    const license = await storePng('customer-docs', 'driver-license.png');
    const passport = await storePng('customer-docs', 'passport.png');

    await client.query(
      `
      INSERT INTO customer_documents (
        user_id, reservation_id, doc_type, storage_key,
        original_filename, mime_type, size_bytes
      )
      VALUES
        ($1, $2, 'driver_license', $3, 'driver-license.png', 'image/png', $4),
        ($1, $2, 'passport_id', $5, 'passport.png', 'image/png', $6)
      `,
      [
        userId,
        upcoming.id,
        license.storageKey,
        license.sizeBytes,
        passport.storageKey,
        passport.sizeBytes,
      ]
    );

    console.log('✓ Customer portal fixtures seeded');
    console.log('');
    console.log('Try it:');
    console.log(`  Login:  ${DEMO_EMAIL} / Demo123!`);
    console.log('  Portal: /account  → My reservations, Documents, PDFs');
    console.log('  Admin:  /admin/reservations → checklists + cancel requests');
    console.log(`  Sample reservation IDs: upcoming=#${upcoming.id}, prepared=#${prepared.id}, active=#${active.id}, completed=#${completed.id}`);
  } finally {
    client.release();
    if (endPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  seedCustomerPortal().catch((err) => {
    console.error('Customer portal seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedCustomerPortal };
