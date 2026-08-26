const pool = require('./pool');

const PG_UNIQUE_VIOLATION = '23505';
const PG_EXCLUSION_VIOLATION = '23P01';
const CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT = 'no_overlapping_car_blocks';
const RESERVATION_HOLD_OVERLAP_CONSTRAINT = 'no_overlapping_active_reservation_holds';
const ACTIVE_SESSION_HOLD_UNIQUE_INDEX = 'idx_reservations_one_active_hold_per_session';

/**
 * Two-argument pg_advisory_xact_lock namespaces.
 * Must stay distinct from each other and from session-level hashtext('luxride_migrations').
 */
const ADVISORY_LOCK_NS = Object.freeze({
  CAR: 1,
  SESSION: 2,
});

/**
 * Canonical lock order for hold create / rehold (avoids deadlocks):
 * 1. Session advisory lock (namespace SESSION, hashtext(session_id))
 * 2. Car advisory locks, unique car_ids sorted ascending (namespace CAR)
 * 3. Reservation row locks (SELECT ... FOR UPDATE)
 *
 * Never take a car lock after a reservation row lock on these paths.
 * Never take a session lock after car locks.
 *
 * Canonical lock order for security tokens (issue / resend / verify / claim):
 * 1. User row (SELECT ... FOR UPDATE) when a user participates
 * 2. Reservation row (SELECT ... FOR UPDATE) when a reservation participates
 * 3. Linked order row (SELECT ... FOR UPDATE) if one exists
 * 4. Token row (SELECT ... FOR UPDATE)
 *
 * Lookup-by-hash is non-locking only to discover ids. Then lock in this order
 * and re-read the token FOR UPDATE. Token rotation serializes on the parent
 * row (user for verification, reservation for claim) before revoke+insert.
 *
 * Never invert this order. Never take a hold-path car/session advisory lock
 * after a security-token row lock on those paths.
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
};
