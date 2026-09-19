#!/usr/bin/env node
/**
 * Seeds large realistic operational history on the existing car fleet.
 * Idempotent: removes previous rows marked with seed-hist- / hist.seed markers.
 *
 * Does NOT create or delete cars. Prefer running after `npm run db:seed`.
 *
 * Usage: node sql/seedOperationalHistory.js
 *        npm run db:seed:history
 *
 * Env (optional):
 *   SEED_HIST_CUSTOMERS=60
 *   SEED_HIST_MONTHS_BACK=14
 *   SEED_HIST_MONTHS_AHEAD=3
 *   SEED_HIST_TARGET=1100
 */
require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../src/db/pool');
const userSql = require('../src/services/sql/userSqlService');
const userRoleSql = require('../src/services/sql/userRoleSqlService');
const { requireDatabaseUrl } = require('./dbCliUtils');
const {
  parseSofiaDate,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  getSofiaIsoDateString,
} = require('../src/utils/date/timezone');

const SESSION_PREFIX = 'seed-hist-';
const EMAIL_PREFIX = 'hist.seed.';
const CONTACT_EMAIL_PREFIX = 'hist.contact.';
const TASK_TITLE_PREFIX = '[Hist]';
const BLOCK_REASON = 'seed-hist';
const SHARED_CUSTOMER_PASSWORD = 'HistCustomer123!';

const LOCATIONS = ['sofia', 'airport', 'plovdiv', 'varna', 'burgas'];
const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarters', 'full'];
const FIRST_NAMES = [
  'Ivan', 'Maria', 'Georgi', 'Elena', 'Dimitar', 'Nikola', 'Petar', 'Anna',
  'Stefan', 'Kristina', 'Viktor', 'Desislava', 'Alexander', 'Yana', 'Martin',
  'Teodora', 'Kaloyan', 'Radoslava', 'Boris', 'Ivelina',
];
const LAST_NAMES = [
  'Ivanov', 'Petrova', 'Georgiev', 'Dimitrova', 'Nikolov', 'Stoyanova',
  'Hristov', 'Todorova', 'Vasilev', 'Angelova', 'Kolev', 'Marinova',
  'Popov', 'Ilieva', 'Yankov', 'Petrova', 'Atanasov', 'Kostova',
];

const EXTRA_STAFF = [
  { email: 'accountant@luxride.local', roleSlug: 'accountant', label: 'Accountant' },
  { email: 'support@luxride.local', roleSlug: 'support', label: 'Support' },
  { email: 'owner@luxride.local', roleSlug: 'owner', label: 'Owner' },
];

/** Statuses that occupy inventory via car_date_blocks. */
const BLOCKING_STATUSES = new Set([
  'confirmed',
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
  'completed',
]);

const PAID_PATH_STATUSES = new Set([
  'paid',
  'confirmed',
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
  'completed',
  'manual_review',
  'no_show',
  'refunded',
  'cancelled',
]);

function config() {
  return {
    customers: clampInt(process.env.SEED_HIST_CUSTOMERS, 60, 10, 200),
    monthsBack: clampInt(process.env.SEED_HIST_MONTHS_BACK, 14, 3, 36),
    monthsAhead: clampInt(process.env.SEED_HIST_MONTHS_AHEAD, 3, 1, 12),
    target: clampInt(process.env.SEED_HIST_TARGET, 1100, 100, 5000),
  };
}

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Deterministic PRNG (mulberry32). */
function createRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function sofiaAt(daysFromToday, time = '10:00') {
  const base = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), daysFromToday));
  return parseSofiaDate(base, time);
}

function daysBetween(a, b) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function dayRate(car) {
  const rate = Number(car.price_tier_1_3 ?? car.price_per_day ?? car.price ?? 80);
  return Number.isFinite(rate) && rate > 0 ? rate : 80;
}

function priceFor(car, rentalDays, delivery = 0, ret = 0) {
  const total = Math.round((dayRate(car) * rentalDays + delivery + ret) * 100) / 100;
  return Math.max(0, total);
}

function historyForStatus(status) {
  const paidPath = [
    { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
    { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
    { oldStatus: 'processing_payment', newStatus: 'paid', reason: 'stripe_payment_received' },
    { oldStatus: 'paid', newStatus: 'confirmed', reason: 'booking_finalized' },
  ];

  switch (status) {
    case 'pending_payment':
      return [{ oldStatus: null, newStatus: 'pending_payment', reason: 'created' }];
    case 'processing_payment':
      return [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
      ];
    case 'paid':
      return paidPath.slice(0, 3);
    case 'manual_review':
      return [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'processing_payment', reason: 'checkout_started' },
        { oldStatus: 'processing_payment', newStatus: 'manual_review', reason: 'overlap_after_payment' },
      ];
    case 'confirmed':
      return [...paidPath];
    case 'car_prepared':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
      ];
    case 'picked_up':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
        { oldStatus: 'car_prepared', newStatus: 'picked_up', reason: 'admin_ops' },
      ];
    case 'active_rental':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'picked_up', reason: 'admin_ops' },
        { oldStatus: 'picked_up', newStatus: 'active_rental', reason: 'admin_ops' },
      ];
    case 'returned':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'picked_up', reason: 'admin_ops' },
        { oldStatus: 'picked_up', newStatus: 'returned', reason: 'admin_ops' },
      ];
    case 'completed':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'car_prepared', reason: 'admin_ops' },
        { oldStatus: 'car_prepared', newStatus: 'picked_up', reason: 'admin_ops' },
        { oldStatus: 'picked_up', newStatus: 'active_rental', reason: 'admin_ops' },
        { oldStatus: 'active_rental', newStatus: 'returned', reason: 'admin_ops' },
        { oldStatus: 'returned', newStatus: 'completed', reason: 'admin_ops' },
      ];
    case 'cancelled':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'cancelled', reason: 'customer_or_admin_cancel' },
      ];
    case 'no_show':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'no_show', reason: 'customer_no_show' },
      ];
    case 'expired':
      return [
        { oldStatus: null, newStatus: 'pending_payment', reason: 'created' },
        { oldStatus: 'pending_payment', newStatus: 'expired', reason: 'hold_expired' },
      ];
    case 'refunded':
      return [
        ...paidPath,
        { oldStatus: 'confirmed', newStatus: 'refunded', reason: 'refund_succeeded' },
      ];
    default:
      return [{ oldStatus: null, newStatus: status, reason: 'seed_hist' }];
  }
}

function choosePastStatus(rng) {
  const roll = rng();
  if (roll < 0.7) return 'completed';
  if (roll < 0.85) return 'cancelled';
  if (roll < 0.93) return 'expired';
  if (roll < 0.97) return 'no_show';
  return 'refunded';
}

function chooseCurrentStatus(rng, pickup, ret, now) {
  if (pickup > now) {
    const roll = rng();
    if (roll < 0.5) return 'confirmed';
    if (roll < 0.65) return 'car_prepared';
    if (roll < 0.75) return 'paid';
    if (roll < 0.83) return 'pending_payment';
    if (roll < 0.9) return 'processing_payment';
    return 'manual_review';
  }
  if (ret < now) {
    const roll = rng();
    if (roll < 0.4) return 'returned';
    if (roll < 0.7) return 'picked_up';
    return 'completed';
  }
  const roll = rng();
  if (roll < 0.4) return 'active_rental';
  if (roll < 0.7) return 'picked_up';
  if (roll < 0.85) return 'car_prepared';
  return 'confirmed';
}

function chooseFutureStatus(rng) {
  const roll = rng();
  if (roll < 0.65) return 'confirmed';
  if (roll < 0.75) return 'car_prepared';
  if (roll < 0.83) return 'paid';
  if (roll < 0.9) return 'pending_payment';
  if (roll < 0.95) return 'processing_payment';
  return 'manual_review';
}

async function clearPreviousSeed(client) {
  const sessionLike = `${SESSION_PREFIX}%`;
  const emailLike = `${EMAIL_PREFIX}%`;
  const contactLike = `${CONTACT_EMAIL_PREFIX}%`;

  await client.query(
    `DELETE FROM notifications
     WHERE idempotency_key LIKE $1
        OR reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $2)`,
    [`${SESSION_PREFIX}%`, sessionLike]
  );

  await client.query(`DELETE FROM calendar_tasks WHERE title LIKE $1`, [
    `${TASK_TITLE_PREFIX}%`,
  ]);

  await client.query(
    `DELETE FROM admin_audit_logs
     WHERE metadata->>'source' = 'seed_hist'
        OR (entity_type = 'reservation' AND entity_id IN (
              SELECT id::text FROM reservations WHERE session_id LIKE $1
            ))`,
    [sessionLike]
  );

  await client.query(
    `DELETE FROM payment_failures
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)
        OR stripe_session_id LIKE $2`,
    [sessionLike, `cs_${SESSION_PREFIX}%`]
  );

  await client.query(
    `DELETE FROM payment_events
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)
        OR event_id LIKE $2
        OR stripe_session_id LIKE $3`,
    [sessionLike, `evt_${SESSION_PREFIX}%`, `cs_${SESSION_PREFIX}%`]
  );

  await client.query(
    `DELETE FROM refund_operations
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)
        OR idempotency_key LIKE $2`,
    [sessionLike, `${SESSION_PREFIX}%`]
  );

  await client.query(
    `DELETE FROM reservation_cancellation_requests
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)`,
    [sessionLike]
  );

  await client.query(
    `DELETE FROM reservation_pickup_checklists
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)`,
    [sessionLike]
  );

  await client.query(
    `DELETE FROM reservation_return_checklists
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)`,
    [sessionLike]
  );

  await client.query(
    `DELETE FROM customer_documents
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)
        OR user_id IN (SELECT id FROM users WHERE LOWER(email) LIKE LOWER($2))`,
    [sessionLike, emailLike]
  );

  await client.query(
    `DELETE FROM orders
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)
        OR email LIKE $2`,
    [sessionLike, emailLike]
  );

  await client.query(
    `DELETE FROM reservation_status_history
     WHERE reservation_id IN (SELECT id FROM reservations WHERE session_id LIKE $1)`,
    [sessionLike]
  );

  await client.query(`DELETE FROM reservations WHERE session_id LIKE $1`, [sessionLike]);

  await client.query(`DELETE FROM car_date_blocks WHERE reason = $1`, [BLOCK_REASON]);

  await client.query(`DELETE FROM contacts WHERE email LIKE $1`, [contactLike]);
}

async function loadCars(client) {
  const result = await client.query(
    `
    SELECT id, name, price, price_per_day, price_tier_1_3, mileage, vin
    FROM cars
    WHERE COALESCE(is_deleted, false) = false
    ORDER BY id
    `
  );
  if (result.rows.length < 5) {
    throw new Error('Need at least 5 cars. Run npm run db:seed (or db:seed:cars) first.');
  }
  return result.rows;
}

async function loadExistingBlocks(client) {
  const result = await client.query(
    `SELECT car_id, start_date, end_date FROM car_date_blocks`
  );
  const map = new Map();
  for (const row of result.rows) {
    const list = map.get(row.car_id) || [];
    list.push({ start: new Date(row.start_date), end: new Date(row.end_date) });
    map.set(row.car_id, list);
  }
  return map;
}

function canPlace(planned, existing, carId, start, end) {
  const lists = [planned.get(carId) || [], existing.get(carId) || []];
  for (const list of lists) {
    for (const iv of list) {
      if (overlaps(start, end, iv.start, iv.end)) return false;
    }
  }
  return true;
}

function markPlanned(planned, carId, start, end) {
  const list = planned.get(carId) || [];
  list.push({ start, end });
  planned.set(carId, list);
}

async function ensureCustomer(email, hashedPassword) {
  let user = await userSql.findUserByEmail(email);
  if (user) return user;
  user = await userSql.createUser({
    email,
    password: hashedPassword,
    role: 'user',
    emailVerifiedAt: new Date(),
  });
  return user;
}

async function ensureStaffUser(email, hashedPassword) {
  let user = await userSql.findUserByEmail(email);
  if (!user) {
    user = await userSql.createUser({
      email,
      password: hashedPassword,
      role: 'staff',
      emailVerifiedAt: new Date(),
    });
    console.log(`→ created staff user ${email}`);
  } else {
    console.log(`⊘ skip staff ${email} (already exists)`);
  }
  return user;
}

async function assignRoleBySlug(userId, slug, client) {
  const roleRes = await client.query(`SELECT id FROM roles WHERE slug = $1 LIMIT 1`, [slug]);
  const roleId = roleRes.rows[0]?.id;
  if (!roleId) {
    throw new Error(`Role not found: ${slug}`);
  }
  await userRoleSql.replaceUserRoles(userId, [roleId], null, client);
}

function buildScenarios({ cfg, cars, customers, existingBlocks, rng }) {
  const planned = new Map();
  const scenarios = [];
  const now = new Date();
  const startDay = -(cfg.monthsBack * 30);
  const endDay = cfg.monthsAhead * 30;
  let seq = 0;

  const times = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

  // Pack inventory bookings per car with gaps for realism + constraint safety.
  for (const car of cars) {
    let cursorDay = startDay + Math.floor(rng() * 5);
    while (cursorDay < endDay && scenarios.length < cfg.target) {
      const rentalDays = 1 + Math.floor(rng() * 7); // 1–7
      const gapDays = 1 + Math.floor(rng() * 4); // 1–4 free days
      const pickupTime = pick(rng, times);
      const returnTime = pick(rng, times);
      const pickup = sofiaAt(cursorDay, pickupTime);
      const ret = sofiaAt(cursorDay + rentalDays, returnTime);

      if (!canPlace(planned, existingBlocks, car.id, pickup, ret)) {
        cursorDay += 1;
        continue;
      }

      let status;
      const recentlyEnded = ret < now && pickup <= now && daysBetween(ret, now) <= 3;
      if (recentlyEnded) {
        // Overdue / just-returned ops cases around "today"
        status = chooseCurrentStatus(rng, pickup, ret, now);
      } else if (ret < now && pickup < now) {
        status = choosePastStatus(rng);
      } else if (pickup <= now && ret >= now) {
        status = chooseCurrentStatus(rng, pickup, ret, now);
      } else if (pickup > now) {
        status = chooseFutureStatus(rng);
      } else {
        status = choosePastStatus(rng);
      }

      // Holds must stay sparse and never share session; skip dense holds in past.
      if (
        (status === 'pending_payment' || status === 'processing_payment') &&
        pickup < now
      ) {
        status = 'expired';
      }

      const needsBlock = BLOCKING_STATUSES.has(status);
      if (needsBlock) {
        markPlanned(planned, car.id, pickup, ret);
      }

      const customer = pick(rng, customers);
      const pickupLoc = pick(rng, LOCATIONS);
      const returnLoc = rng() < 0.75 ? pickupLoc : pick(rng, LOCATIONS);
      const delivery = pickupLoc === 'airport' ? 25 : 0;
      const returnPrice = returnLoc === 'airport' ? 25 : 0;
      const totalPrice = priceFor(car, rentalDays, delivery, returnPrice);
      const paidPath = PAID_PATH_STATUSES.has(status) && status !== 'expired';
      const stripeSessionId = paidPath
        ? `cs_${SESSION_PREFIX}${String(seq).padStart(5, '0')}`
        : null;
      const paymentIntentId = paidPath
        ? `pi_${SESSION_PREFIX}${String(seq).padStart(5, '0')}`
        : null;

      let holdExpiresAt;
      if (status === 'pending_payment' || status === 'processing_payment') {
        holdExpiresAt = new Date(now.getTime() + (15 + Math.floor(rng() * 30)) * 60 * 1000);
      } else if (status === 'expired') {
        holdExpiresAt = new Date(pickup.getTime() - 24 * 60 * 60 * 1000);
      } else {
        holdExpiresAt = new Date(pickup.getTime() - 60 * 60 * 1000);
      }

      scenarios.push({
        seq,
        car,
        customer,
        sessionId: `${SESSION_PREFIX}${String(seq).padStart(5, '0')}`,
        pickupDate: pickup,
        pickupTime,
        returnDate: ret,
        returnTime,
        pickupLocation: pickupLoc,
        returnLocation: returnLoc,
        rentalDays,
        deliveryPrice: delivery,
        returnPrice,
        totalPrice,
        deposit: 300,
        fullName: customer.fullName,
        phoneNumber: customer.phone,
        email: customer.email,
        address: customer.address,
        hotelName: rng() < 0.25 ? pick(rng, ['Hotel Marinela', 'Sense Hotel', 'Hilton Sofia', null]) : null,
        flightNumber: rng() < 0.2 ? `FB${1000 + Math.floor(rng() * 8000)}` : null,
        specialRequests: rng() < 0.15 ? 'Child seat requested' : null,
        status,
        holdExpiresAt,
        stripeSessionId,
        stripePaymentIntentId: paymentIntentId,
        userId: customer.id,
        withBlock: needsBlock,
        withOrder: BLOCKING_STATUSES.has(status) || status === 'refunded' || status === 'no_show',
        withPayment: paidPath && status !== 'expired',
        withRefund: status === 'refunded',
        withChecklists: status === 'completed' && rng() < 0.35,
        withCancelRequest:
          status === 'confirmed' && pickup > now && rng() < 0.08,
        withNotification: paidPath && rng() < 0.45,
        history: historyForStatus(status),
        createdAtOffsetHours: Math.max(1, daysBetween(pickup, now) * 24 + Math.floor(rng() * 48)),
      });

      seq += 1;
      cursorDay += rentalDays + gapDays;
    }
  }

  // Sprinkle a few non-blocking cancelled/expired in free slots if under target.
  let sprinkle = 0;
  while (scenarios.length < cfg.target && sprinkle < 200) {
    sprinkle += 1;
    const car = pick(rng, cars);
    const day = startDay + Math.floor(rng() * (endDay - startDay - 5));
    const rentalDays = 2 + Math.floor(rng() * 4);
    const pickup = sofiaAt(day, '10:00');
    const ret = sofiaAt(day + rentalDays, '10:00');
    if (!canPlace(planned, existingBlocks, car.id, pickup, ret) && rng() < 0.5) {
      // cancelled/expired don't need free calendar — allow "attempted" overlapping ghost bookings
    }
    const status = rng() < 0.55 ? 'cancelled' : 'expired';
    const customer = pick(rng, customers);
    scenarios.push({
      seq,
      car,
      customer,
      sessionId: `${SESSION_PREFIX}${String(seq).padStart(5, '0')}`,
      pickupDate: pickup,
      pickupTime: '10:00',
      returnDate: ret,
      returnTime: '10:00',
      pickupLocation: 'sofia',
      returnLocation: 'sofia',
      rentalDays,
      deliveryPrice: 0,
      returnPrice: 0,
      totalPrice: priceFor(car, rentalDays),
      deposit: 300,
      fullName: customer.fullName,
      phoneNumber: customer.phone,
      email: customer.email,
      address: customer.address,
      hotelName: null,
      flightNumber: null,
      specialRequests: null,
      status,
      holdExpiresAt: new Date(pickup.getTime() - 2 * 60 * 60 * 1000),
      stripeSessionId: status === 'cancelled' ? `cs_${SESSION_PREFIX}${String(seq).padStart(5, '0')}` : null,
      stripePaymentIntentId:
        status === 'cancelled' ? `pi_${SESSION_PREFIX}${String(seq).padStart(5, '0')}` : null,
      userId: customer.id,
      withBlock: false,
      withOrder: false,
      withPayment: status === 'cancelled' && rng() < 0.4,
      withRefund: false,
      withChecklists: false,
      withCancelRequest: false,
      withNotification: false,
      history: historyForStatus(status),
      createdAtOffsetHours: 72,
    });
    seq += 1;
  }

  return scenarios;
}

async function insertReservation(client, row) {
  const shouldRecordPayment =
    Boolean(row.stripeSessionId) &&
    (row.withPayment ||
      row.withRefund ||
      BLOCKING_STATUSES.has(row.status) ||
      ['paid', 'manual_review', 'no_show', 'refunded'].includes(row.status));

  const paidCents = shouldRecordPayment
    ? Math.max(1, Math.round(Number(row.totalPrice) * 100))
    : null;

  const result = await client.query(
    `
    INSERT INTO reservations (
      car_id, session_id, user_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price, deposit,
      full_name, phone_number, email, address, hotel_name,
      flight_number, special_requests,
      status, hold_expires_at,
      stripe_session_id, stripe_payment_intent_id,
      paid_amount_cents, paid_currency,
      created_at, updated_at
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9,
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21,
      $22, $23,
      $24, $25,
      $26, $27,
      $28, $28
    )
    RETURNING id, status
    `,
    [
      row.car.id,
      row.sessionId,
      row.userId,
      row.pickupDate,
      row.pickupTime,
      row.returnDate,
      row.returnTime,
      row.pickupLocation,
      row.returnLocation,
      row.rentalDays,
      row.deliveryPrice,
      row.returnPrice,
      row.totalPrice,
      row.deposit,
      row.fullName,
      row.phoneNumber,
      row.email,
      row.address,
      row.hotelName,
      row.flightNumber,
      row.specialRequests,
      row.status,
      row.holdExpiresAt,
      row.stripeSessionId,
      row.stripePaymentIntentId,
      paidCents,
      paidCents ? 'eur' : null,
      new Date(row.pickupDate.getTime() - row.createdAtOffsetHours * 60 * 60 * 1000),
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
        step.reason || 'seed_hist',
        JSON.stringify({ source: 'seed_hist' }),
      ]
    );
  }
}

async function insertOrder(client, row, reservationId) {
  const orderStatus =
    row.status === 'cancelled' || row.status === 'refunded'
      ? 'cancelled'
      : row.status === 'expired'
        ? 'expired'
        : 'active';

  const result = await client.query(
    `
    INSERT INTO orders (
      reservation_id, car_id, user_id,
      pickup_date, pickup_time, return_date, return_time,
      pickup_location, return_location,
      rental_days, delivery_price, return_price, total_price, deposit,
      full_name, phone_number, email, address, hotel_name,
      stripe_session_id, status,
      is_deleted, deleted_at
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9,
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21,
      $22, $23
    )
    RETURNING id
    `,
    [
      reservationId,
      row.car.id,
      row.userId,
      row.pickupDate,
      row.pickupTime,
      row.returnDate,
      row.returnTime,
      row.pickupLocation,
      row.returnLocation,
      row.rentalDays,
      row.deliveryPrice,
      row.returnPrice,
      row.totalPrice,
      row.deposit,
      row.fullName,
      row.phoneNumber,
      row.email,
      row.address,
      row.hotelName,
      row.stripeSessionId,
      orderStatus,
      orderStatus === 'cancelled',
      orderStatus === 'cancelled' ? new Date() : null,
    ]
  );
  return result.rows[0];
}

async function insertBlock(client, carId, start, end) {
  await client.query(
    `
    INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type, reason)
    VALUES ($1, $2, $3, 'booking', $4)
    `,
    [carId, start, end, BLOCK_REASON]
  );
  return true;
}

async function insertPaymentEvent(client, row, reservationId) {
  await client.query(
    `
    INSERT INTO payment_events (
      event_id, event_type, stripe_session_id, reservation_id, status, payload
    )
    VALUES ($1, $2, $3, $4, 'processed', $5::jsonb)
    `,
    [
      `evt_${SESSION_PREFIX}${String(row.seq).padStart(5, '0')}`,
      'checkout.session.completed',
      row.stripeSessionId,
      reservationId,
      JSON.stringify({
        source: 'seed_hist',
        amount_total: Math.round(Number(row.totalPrice) * 100),
        currency: 'eur',
      }),
    ]
  );
}

async function insertRefund(client, row, reservationId, orderId, adminUserId) {
  const amountCents = Math.max(1, Math.round(Number(row.totalPrice) * 100));
  await client.query(
    `
    INSERT INTO refund_operations (
      reservation_id, order_id, stripe_payment_intent_id, stripe_refund_id,
      amount_cents, currency, status, idempotency_key,
      requested_by_user_id, reason, stripe_raw_status
    )
    VALUES ($1, $2, $3, $4, $5, 'eur', 'succeeded', $6, $7, $8, 'succeeded')
    `,
    [
      reservationId,
      orderId,
      row.stripePaymentIntentId,
      `re_${SESSION_PREFIX}${String(row.seq).padStart(5, '0')}`,
      amountCents,
      `${SESSION_PREFIX}refund-${String(row.seq).padStart(5, '0')}`,
      adminUserId,
      'customer_requested_refund',
    ]
  );
}

async function insertChecklists(client, row, reservationId, staffUserId, rng) {
  const baseMileage = Number(row.car.mileage) || 30000;
  const pickupFuel = pick(rng, FUEL_LEVELS);
  const returnFuel = pick(rng, FUEL_LEVELS);
  const driven = 40 + Math.floor(rng() * 600);

  await client.query(
    `
    INSERT INTO reservation_pickup_checklists (
      reservation_id, fuel_level, mileage, existing_damages, photos,
      pickup_time, notes, created_by_user_id
    )
    VALUES ($1, $2, $3, $4, '[]'::jsonb, $5, $6, $7)
    `,
    [
      reservationId,
      pickupFuel,
      baseMileage,
      rng() < 0.2 ? 'Minor scratch on rear bumper' : null,
      row.pickupDate,
      'seed_hist pickup',
      staffUserId,
    ]
  );

  await client.query(
    `
    INSERT INTO reservation_return_checklists (
      reservation_id, fuel_level, mileage, new_damages, photos,
      late_return, extra_fees, return_time, notes, created_by_user_id
    )
    VALUES ($1, $2, $3, $4, '[]'::jsonb, $5, $6, $7, $8, $9)
    `,
    [
      reservationId,
      returnFuel,
      baseMileage + driven,
      rng() < 0.12 ? 'New scuff on passenger door' : null,
      rng() < 0.1,
      rng() < 0.1 ? 35 : 0,
      row.returnDate,
      'seed_hist return',
      staffUserId,
    ]
  );
}

async function insertCancelRequest(client, row, reservationId, adminUserId, rng) {
  const status = pick(rng, ['pending', 'approved', 'rejected']);
  await client.query(
    `
    INSERT INTO reservation_cancellation_requests (
      reservation_id, user_id, reason, status, admin_note,
      reviewed_by_user_id, reviewed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      reservationId,
      row.userId,
      'Change of travel plans',
      status,
      status === 'pending' ? null : 'Reviewed by seed',
      status === 'pending' ? null : adminUserId,
      status === 'pending' ? null : new Date(),
    ]
  );
}

async function insertNotification(client, row, reservationId, orderId) {
  await client.query(
    `
    INSERT INTO notifications (
      type, channel, recipient_email, recipient_user_id,
      reservation_id, order_id, car_id, payload, status,
      scheduled_at, sent_at, attempts, idempotency_key
    )
    VALUES (
      'booking_confirmation', 'email', $1, $2,
      $3, $4, $5, $6::jsonb, 'sent',
      $7, $7, 1, $8
    )
    `,
    [
      row.email,
      row.userId,
      reservationId,
      orderId,
      row.car.id,
      JSON.stringify({ source: 'seed_hist', status: row.status }),
      new Date(row.pickupDate.getTime() - 48 * 60 * 60 * 1000),
      `${SESSION_PREFIX}notify-${String(row.seq).padStart(5, '0')}`,
    ]
  );
}

async function insertAudit(client, reservationId, adminUserId, action) {
  await client.query(
    `
    INSERT INTO admin_audit_logs (
      admin_user_id, actor_type, action, entity_type, entity_id, metadata
    )
    VALUES ($1, 'admin', $2, 'reservation', $3, $4::jsonb)
    `,
    [
      adminUserId,
      action,
      String(reservationId),
      JSON.stringify({ source: 'seed_hist' }),
    ]
  );
}

async function seedContacts(client, rng, count = 80) {
  const subjects = [
    'Airport pickup question',
    'Long-term rental inquiry',
    'Insurance coverage',
    'Child seat availability',
    'Corporate account',
    'Damage claim follow-up',
  ];
  for (let i = 0; i < count; i += 1) {
    const status = pick(rng, ['new', 'ready', 'done', 'done', 'ready']);
    await client.query(
      `
      INSERT INTO contacts (name, email, phone, subject, message, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      `,
      [
        `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
        `${CONTACT_EMAIL_PREFIX}${String(i).padStart(3, '0')}@example.com`,
        `+35988${String(2000000 + i).slice(0, 7)}`,
        pick(rng, subjects),
        'Hello, I would like more information about your rental terms.',
        status,
        sofiaAt(-(Math.floor(rng() * 400)), '12:00'),
      ]
    );
  }
}

async function seedPaymentFailures(client, scenarios, rng, count = 20) {
  const paid = scenarios.filter((s) => s.stripeSessionId);
  for (let i = 0; i < count && i < paid.length; i += 1) {
    const s = paid[i * 3] || paid[i];
    if (!s) break;
    const resolved = rng() < 0.6;
    await client.query(
      `
      INSERT INTO payment_failures (
        reason, correlation_id, stripe_session_id, reservation_id,
        event_id, context, resolved, resolved_at
      )
      VALUES ($1, $2, $3, NULL, $4, $5::jsonb, $6, $7)
      `,
      [
        pick(rng, ['webhook_timeout', 'finalize_conflict', 'amount_mismatch', 'network_error']),
        `${SESSION_PREFIX}corr-${i}`,
        `cs_${SESSION_PREFIX}fail-${String(i).padStart(3, '0')}`,
        `evt_${SESSION_PREFIX}fail-${String(i).padStart(3, '0')}`,
        JSON.stringify({ source: 'seed_hist' }),
        resolved,
        resolved ? new Date() : null,
      ]
    );
  }
}

async function seedMaintenanceBlocks(client, cars, existingBlocks, planned, rng, count = 40) {
  let created = 0;
  for (let i = 0; i < count * 3 && created < count; i += 1) {
    const car = pick(rng, cars);
    const day = -(Math.floor(rng() * 360)) - 20;
    const days = 1 + Math.floor(rng() * 3);
    const start = sofiaAt(day, '08:00');
    const end = sofiaAt(day + days, '18:00');
    if (!canPlace(planned, existingBlocks, car.id, start, end)) continue;
    const ok = await insertBlockTyped(client, car.id, start, end, 'maintenance');
    if (ok) {
      markPlanned(planned, car.id, start, end);
      created += 1;
    }
  }
  return created;
}

async function insertBlockTyped(client, carId, start, end, blockType) {
  await client.query('SAVEPOINT sp_hist_block');
  try {
    await client.query(
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type, reason)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [carId, start, end, blockType, BLOCK_REASON]
    );
    await client.query('RELEASE SAVEPOINT sp_hist_block');
    return true;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT sp_hist_block');
    if (err.code === '23P01') return false;
    throw err;
  }
}

async function seedCalendarTasks(client, inserted, staffBySlug, adminUserId, rng) {
  const staffIds = Object.values(staffBySlug).map((u) => u.id);
  let count = 0;
  for (const row of inserted) {
    if (!BLOCKING_STATUSES.has(row.status) && row.status !== 'completed') continue;
    if (rng() > 0.2) continue;

    const assignee = pick(rng, staffIds);
    const isPast = row.returnDate < new Date();
    const status = isPast
      ? pick(rng, ['completed', 'completed', 'completed', 'failed', 'cancelled'])
      : pick(rng, ['pending', 'assigned', 'in_progress']);
    const taskType = pick(rng, ['pickup', 'return', 'cleaning', 'inspection', 'delivery']);

    await client.query(
      `
      INSERT INTO calendar_tasks (
        car_id, reservation_id, task_type, title, notes, location_text,
        starts_at, due_at, status, assigned_to_user_id, created_by_user_id, completed_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        row.car.id,
        row.reservationId,
        taskType,
        `${TASK_TITLE_PREFIX} ${taskType} #${row.reservationId}`,
        'seed_hist task',
        row.pickupLocation,
        row.pickupDate,
        row.returnDate,
        status,
        assignee,
        adminUserId,
        status === 'completed' ? row.returnDate : null,
      ]
    );
    count += 1;
    if (count >= 180) break;
  }
  return count;
}

async function seedOperationalHistory({ endPool = true } = {}) {
  requireDatabaseUrl();
  const cfg = config();
  const rng = createRng(0x4c555852); // 'LUXR'
  const client = await pool.connect();

  const stats = {
    customers: 0,
    staff: 0,
    reservations: 0,
    orders: 0,
    blocks: 0,
    payments: 0,
    refunds: 0,
    checklists: 0,
    cancels: 0,
    notifications: 0,
    audits: 0,
    contacts: 0,
    failures: 0,
    maintenance: 0,
    tasks: 0,
    byStatus: {},
  };

  try {
    console.log('→ operational history seed');
    console.log(
      `  target≈${cfg.target}, customers=${cfg.customers}, window=-${cfg.monthsBack}m / +${cfg.monthsAhead}m`
    );

    await client.query('BEGIN');
    console.log('  clearing previous seed-hist rows…');
    await clearPreviousSeed(client);
    console.log('  clear done');

    const cars = await loadCars(client);
    const existingBlocks = await loadExistingBlocks(client);
    console.log(`  cars=${cars.length}`);

    // Create users outside the main data transaction to avoid long locks.
    await client.query('COMMIT');

    const hashedCustomer = await bcrypt.hash(SHARED_CUSTOMER_PASSWORD, 10);
    const customers = [];
    for (let i = 0; i < cfg.customers; i += 1) {
      const email = `${EMAIL_PREFIX}customer.${String(i + 1).padStart(3, '0')}@example.com`;
      const user = await ensureCustomer(email, hashedCustomer);
      const fullName = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      customers.push({
        id: user.id,
        email,
        fullName,
        phone: `+35988${String(1000000 + i).slice(0, 7)}`,
        address: `${10 + i} Seed Street, Sofia`,
      });
    }
    stats.customers = customers.length;

    const hashedStaff = await bcrypt.hash('Staff123!', 10);
    const staffBySlug = {};
    for (const s of EXTRA_STAFF) {
      const user = await ensureStaffUser(s.email, hashedStaff);
      await assignRoleBySlug(user.id, s.roleSlug, client);
      staffBySlug[s.roleSlug] = user;
      stats.staff += 1;
    }

    // Reuse existing fixture staff if present.
    for (const [slug, email] of [
      ['driver', 'driver@luxride.local'],
      ['cleaner', 'cleaner@luxride.local'],
      ['receptionist', 'receptionist@luxride.local'],
      ['manager', 'manager@luxride.local'],
    ]) {
      const existing = await userSql.findUserByEmail(email);
      if (existing) staffBySlug[slug] = existing;
    }

    const admin =
      (await userSql.findUserByEmail(process.env.SEED_ADMIN_EMAIL || 'admin@luxride.local')) ||
      staffBySlug.owner ||
      staffBySlug.manager;
    const adminUserId = admin?.id || null;
    const checklistStaffId =
      staffBySlug.receptionist?.id || staffBySlug.manager?.id || adminUserId;

    const scenarios = buildScenarios({
      cfg,
      cars,
      customers,
      existingBlocks,
      rng,
    });
    console.log(`  scenarios planned=${scenarios.length}`);

    await client.query('BEGIN');
    const blocksNow = await loadExistingBlocks(client);
    existingBlocks.clear();
    for (const [carId, list] of blocksNow) {
      existingBlocks.set(carId, list);
    }

    const inserted = [];
    for (const scenario of scenarios) {
      await client.query(`SAVEPOINT sp_hist_${scenario.seq}`);
      let reservation;
      try {
        reservation = await insertReservation(client, scenario);
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT sp_hist_${scenario.seq}`);
        // Hold exclusion / unique session — skip this scenario.
        if (err.code === '23P01' || err.code === '23505') {
          continue;
        }
        err.message = `insertReservation#${scenario.seq} (${scenario.status}): ${err.message}`;
        throw err;
      }

      try {
        await insertHistory(client, reservation.id, scenario.history);

        let orderId = null;
        if (scenario.withOrder) {
          const order = await insertOrder(client, scenario, reservation.id);
          orderId = order.id;
          stats.orders += 1;
        }

        if (scenario.withBlock) {
          await insertBlock(
            client,
            scenario.car.id,
            scenario.pickupDate,
            scenario.returnDate
          );
          stats.blocks += 1;
        }

        if (scenario.withPayment && scenario.stripeSessionId) {
          await insertPaymentEvent(client, scenario, reservation.id);
          stats.payments += 1;
        }

        if (scenario.withRefund && scenario.stripePaymentIntentId) {
          await insertRefund(client, scenario, reservation.id, orderId, adminUserId);
          stats.refunds += 1;
        }

        if (scenario.withChecklists && checklistStaffId) {
          await insertChecklists(client, scenario, reservation.id, checklistStaffId, rng);
          stats.checklists += 1;
        }

        if (scenario.withCancelRequest && scenario.userId) {
          await insertCancelRequest(client, scenario, reservation.id, adminUserId, rng);
          stats.cancels += 1;
        }

        if (scenario.withNotification) {
          await insertNotification(client, scenario, reservation.id, orderId);
          stats.notifications += 1;
        }

        if (adminUserId && BLOCKING_STATUSES.has(scenario.status) && rng() < 0.15) {
          await insertAudit(client, reservation.id, adminUserId, `seed_hist_${scenario.status}`);
          stats.audits += 1;
        }

        await client.query(`RELEASE SAVEPOINT sp_hist_${scenario.seq}`);
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT sp_hist_${scenario.seq}`);
        // Overlap / unique — skip this scenario rather than aborting the batch.
        if (err.code === '23P01' || err.code === '23505') {
          continue;
        }
        err.message = `related#${scenario.seq} (${scenario.status}): ${err.message}`;
        throw err;
      }

      stats.reservations += 1;
      stats.byStatus[scenario.status] = (stats.byStatus[scenario.status] || 0) + 1;
      inserted.push({ ...scenario, reservationId: reservation.id });
    }

    await seedContacts(client, rng, 80);
    stats.contacts = 80;

    await seedPaymentFailures(client, scenarios, rng, 22);
    stats.failures = 22;

    const planned = new Map();
    stats.maintenance = await seedMaintenanceBlocks(
      client,
      cars,
      existingBlocks,
      planned,
      rng,
      35
    );

    stats.tasks = await seedCalendarTasks(
      client,
      inserted,
      staffBySlug,
      adminUserId,
      rng
    );

    await client.query('COMMIT');

    const today = getSofiaIsoDateString(new Date());
    console.log(`✓ Operational history seeded (Sofia day ${today})`);
    console.log(`  reservations=${stats.reservations}  orders=${stats.orders}  blocks=${stats.blocks}`);
    console.log(
      `  payments=${stats.payments}  refunds=${stats.refunds}  checklists=${stats.checklists}`
    );
    console.log(
      `  notifications=${stats.notifications}  cancels=${stats.cancels}  tasks=${stats.tasks}`
    );
    console.log(
      `  contacts=${stats.contacts}  failures=${stats.failures}  maintenance_blocks=${stats.maintenance}`
    );
    console.log(`  customers=${stats.customers}  extra_staff=${stats.staff}`);
    console.log('  status mix:');
    for (const [status, count] of Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${status.padEnd(20)} ${count}`);
    }
    console.log('');
    console.log(`Customer password for hist.seed.customer.* : ${SHARED_CUSTOMER_PASSWORD}`);
    console.log('Staff extras: accountant@ / support@ / owner@ luxride.local  (Staff123!)');
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
  seedOperationalHistory().catch((err) => {
    console.error('Operational history seed failed:', err.message);
    if (err.code) console.error('  code:', err.code);
    if (err.detail) console.error('  detail:', err.detail);
    if (err.constraint) console.error('  constraint:', err.constraint);
    if (err.column) console.error('  column:', err.column);
    process.exit(1);
  });
}

module.exports = { seedOperationalHistory };
