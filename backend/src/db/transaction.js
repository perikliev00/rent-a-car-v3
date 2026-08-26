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
  /** Session-level (not xact): claim token issue/resend serialization by reservation_id */
  CLAIM_TOKEN: 3,
  /** Session-level (not xact): verification token issue/resend serialization by user_id */
  VERIFY_TOKEN: 4,
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
 * Canonical lock order for any path that touches reservation + linked order
 * (claim, admin order update, calendar move, cancel/refund):
 * 1. User row (SELECT ... FOR UPDATE) when a user participates
 * 2. Reservation row (SELECT ... FOR UPDATE) when a reservation participates
 * 3. Linked order row (SELECT ... FOR UPDATE) if one exists (including soft-deleted on claim)
 * 4. Token row (SELECT ... FOR UPDATE)
 *
 * Lookup-by-hash / findById is non-locking only to discover ids. Then lock in
 * this order and re-read authoritative rows before validating or updating.
 *
 * Token rotation (issue/resend) additionally takes a session-level advisory
 * lock on the parent (CLAIM_TOKEN / VERIFY_TOKEN) outside the short row
 * transaction so concurrent issuers serialize across processes without holding
 * row locks during SMTP. Always release that advisory in finally.
 *
 * Never invert reservation↔order. Never take a hold-path car/session advisory
 * lock after a security-token row lock on those paths.
 * Security email delivery must run only after COMMIT — never while row locks
 * are held.
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

/**
 * Session-level advisory lock for claim-token rotation (held across short TXs + SMTP).
 * Must be paired with releaseClaimTokenAdvisoryLock in finally.
 */
async function acquireClaimTokenAdvisoryLock(client, reservationId) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid reservation id for claim-token advisory lock');
  }
  await client.query('SELECT pg_advisory_lock($1, $2)', [ADVISORY_LOCK_NS.CLAIM_TOKEN, id]);
}

async function releaseClaimTokenAdvisoryLock(client, reservationId) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) {
    return;
  }
  await client.query('SELECT pg_advisory_unlock($1, $2)', [ADVISORY_LOCK_NS.CLAIM_TOKEN, id]);
}

/**
 * Session-level advisory lock for verification-token rotation.
 * Must be paired with releaseVerifyTokenAdvisoryLock in finally.
 */
async function acquireVerifyTokenAdvisoryLock(client, userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid user id for verify-token advisory lock');
  }
  await client.query('SELECT pg_advisory_lock($1, $2)', [ADVISORY_LOCK_NS.VERIFY_TOKEN, id]);
}

async function releaseVerifyTokenAdvisoryLock(client, userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    return;
  }
  await client.query('SELECT pg_advisory_unlock($1, $2)', [ADVISORY_LOCK_NS.VERIFY_TOKEN, id]);
}

/**
 * Runs work while holding a session-level advisory lock on a dedicated connection.
 * Row transactions inside work should use runWithTransaction (separate connections)
 * so SMTP can run after COMMIT without holding row locks — only this advisory.
 */
async function withSessionAdvisoryLock(acquire, release, work) {
  const client = await pool.connect();
  let locked = false;
  try {
    await acquire(client);
    locked = true;
    return await work();
  } finally {
    if (locked) {
      try {
        await release(client);
      } catch {
        // Prefer releasing the pool client even if unlock fails.
      }
    }
    client.release();
  }
}

async function withClaimTokenAdvisory(reservationId, work) {
  return withSessionAdvisoryLock(
    (client) => acquireClaimTokenAdvisoryLock(client, reservationId),
    (client) => releaseClaimTokenAdvisoryLock(client, reservationId),
    work
  );
}

async function withVerifyTokenAdvisory(userId, work) {
  return withSessionAdvisoryLock(
    (client) => acquireVerifyTokenAdvisoryLock(client, userId),
    (client) => releaseVerifyTokenAdvisoryLock(client, userId),
    work
  );
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
  acquireClaimTokenAdvisoryLock,
  releaseClaimTokenAdvisoryLock,
  acquireVerifyTokenAdvisoryLock,
  releaseVerifyTokenAdvisoryLock,
  withClaimTokenAdvisory,
  withVerifyTokenAdvisory,
};
