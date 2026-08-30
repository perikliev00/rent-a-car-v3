const pool = require('./pool');

const PG_UNIQUE_VIOLATION = '23505';
const PG_EXCLUSION_VIOLATION = '23P01';
const CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT = 'no_overlapping_car_blocks';
const RESERVATION_HOLD_OVERLAP_CONSTRAINT = 'no_overlapping_active_reservation_holds';
const ACTIVE_SESSION_HOLD_UNIQUE_INDEX = 'idx_reservations_one_active_hold_per_session';

/**
 * Two-argument advisory lock namespaces.
 * Must stay distinct from each other and from session-level hashtext('luxride_migrations').
 * CAR and SESSION are transaction-scoped (pg_advisory_xact_lock).
 * CHECKOUT is session-scoped (pg_advisory_lock) so it can span Stripe API calls.
 */
const ADVISORY_LOCK_NS = Object.freeze({
  CAR: 1,
  SESSION: 2,
  CHECKOUT: 3,
});

/**
 * Canonical lock order for hold create / rehold (avoids deadlocks):
 * 1. Session advisory lock (namespace SESSION, hashtext(session_id))
 * 2. Car advisory locks, unique car_ids sorted ascending (namespace CAR)
 * 3. Reservation row locks (SELECT ... FOR UPDATE)
 *
 * Never take a car lock after a reservation row lock on these paths.
 * Never take a session lock after car locks.
 */

function isUniqueViolation(err) {
  return Boolean(err && err.code === PG_UNIQUE_VIOLATION);
}

function isExclusionViolation(err) {
  return Boolean(err && err.code === PG_EXCLUSION_VIOLATION);
}

function isCarDateBlockOverlapViolation(err) {
  return (
    isExclusionViolation(err) &&
    (!err.constraint || err.constraint === CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT)
  );
}

function isReservationHoldOverlapViolation(err) {
  return (
    isExclusionViolation(err) &&
    (!err.constraint || err.constraint === RESERVATION_HOLD_OVERLAP_CONSTRAINT)
  );
}

function isActiveSessionHoldUniqueViolation(err) {
  return isUniqueViolation(err) && err.constraint === ACTIVE_SESSION_HOLD_UNIQUE_INDEX;
}

/**
 * Изпълнява work(client) в PostgreSQL транзакция.
 * client е PoolClient – всички заявки в work() трябва да минават през него.
 */
async function runWithTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Игнорираме rollback грешки – хвърляме първоначалната.
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Изпълнява work(client) в PostgreSQL транзакция – същият API като предишния Mongo helper.
 * PostgreSQL винаги поддържа транзакции, затова client никога не е null.
 */
async function runWithOptionalTransaction(work) {
  return runWithTransaction(work);
}

/** Изпълнява SQL през client (в транзакция) или през pool (извън транзакция). */
function clientQuery(client, text, params) {
  if (client) {
    return client.query(text, params);
  }
  return pool.query(text, params);
}

/** Transaction-scoped advisory lock по car_id – освобождава се автоматично при COMMIT/ROLLBACK. */
async function acquireCarAdvisoryLock(client, carId) {
  const id = Number(carId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid car id for advisory lock');
  }
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, id]);
}

/** Unique car ids, sorted ascending, then locked one by one. */
async function acquireCarAdvisoryLocks(client, carIds) {
  const uniqueSorted = [
    ...new Set(
      (carIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ].sort((a, b) => a - b);

  for (const id of uniqueSorted) {
    await acquireCarAdvisoryLock(client, id);
  }

  return uniqueSorted;
}

/** Transaction-scoped advisory lock по session_id (PostgreSQL hashtext, namespaced). */
async function acquireSessionAdvisoryLock(client, sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session id for advisory lock');
  }
  await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
    ADVISORY_LOCK_NS.SESSION,
    sessionId,
  ]);
}

function normalizeReservationCheckoutLockId(reservationId) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid reservation id for checkout lock');
  }
  return id;
}

/**
 * Session-level checkout lock. Held across Stripe create + DB link.
 * Acquire only after hold-create / prepare transactions have committed.
 */
async function acquireReservationCheckoutLock(client, reservationId) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  await client.query('SELECT pg_advisory_lock($1, $2)', [ADVISORY_LOCK_NS.CHECKOUT, id]);
  return id;
}

async function releaseReservationCheckoutLock(client, reservationId) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  await client.query('SELECT pg_advisory_unlock($1, $2)', [ADVISORY_LOCK_NS.CHECKOUT, id]);
  return id;
}

/**
 * Holds a session-level advisory lock for the reservation while work() runs.
 * Does not open a transaction; Stripe calls must stay outside BEGIN.
 * Unlocks before returning the client to the pool.
 */
async function withReservationCheckoutLock(reservationId, work) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  const client = await pool.connect();

  try {
    await acquireReservationCheckoutLock(client, id);
    try {
      return await work(client);
    } finally {
      await releaseReservationCheckoutLock(client, id);
    }
  } finally {
    client.release();
  }
}

module.exports = {
  PG_UNIQUE_VIOLATION,
  PG_EXCLUSION_VIOLATION,
  CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT,
  RESERVATION_HOLD_OVERLAP_CONSTRAINT,
  ACTIVE_SESSION_HOLD_UNIQUE_INDEX,
  ADVISORY_LOCK_NS,
  isUniqueViolation,
  isExclusionViolation,
  isCarDateBlockOverlapViolation,
  isReservationHoldOverlapViolation,
  isActiveSessionHoldUniqueViolation,
  runWithTransaction,
  runWithOptionalTransaction,
  clientQuery,
  acquireCarAdvisoryLock,
  acquireCarAdvisoryLocks,
  acquireSessionAdvisoryLock,
  acquireReservationCheckoutLock,
  releaseReservationCheckoutLock,
  withReservationCheckoutLock,
};
