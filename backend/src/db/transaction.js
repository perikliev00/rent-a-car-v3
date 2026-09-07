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
 * CHECKOUT and JOB are session-scoped (pg_try_advisory_lock / pg_advisory_unlock) so they can
 * span work outside a transaction. Waiters must not use blocking pg_advisory_lock.
 */
const ADVISORY_LOCK_NS = Object.freeze({
  CAR: 1,
  SESSION: 2,
  CHECKOUT: 3,
  JOB: 4,
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

const CHECKOUT_LOCK_MAX_ATTEMPTS = 40;
const CHECKOUT_LOCK_BASE_DELAY_MS = 25;
const CHECKOUT_LOCK_MAX_DELAY_MS = 200;

class CheckoutLockBusyError extends Error {
  constructor(message = 'Checkout lock busy') {
    super(message);
    this.name = 'CheckoutLockBusyError';
    this.code = 'CHECKOUT_LOCK_BUSY';
  }
}

function isCheckoutLockBusyError(err) {
  return Boolean(err && err.code === 'CHECKOUT_LOCK_BUSY');
}

function isPgBooleanTrue(value) {
  return value === true || value === 't' || value === 'true';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkoutLockDelayMs(attempt) {
  const exp = Math.min(
    CHECKOUT_LOCK_MAX_DELAY_MS,
    CHECKOUT_LOCK_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  );
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

function normalizeReservationCheckoutLockId(reservationId) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid reservation id for checkout lock');
  }
  return id;
}

/**
 * Non-blocking session-level checkout lock. Held across Stripe create + DB link.
 * Acquire only after hold-create / prepare transactions have committed.
 */
async function tryAcquireReservationCheckoutLock(client, reservationId) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  const result = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
    ADVISORY_LOCK_NS.CHECKOUT,
    id,
  ]);
  return isPgBooleanTrue(result.rows[0]?.acquired);
}

async function acquireReservationCheckoutLock(client, reservationId) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  const acquired = await tryAcquireReservationCheckoutLock(client, reservationId);
  if (!acquired) {
    throw new CheckoutLockBusyError();
  }
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
 * Waiters release the pool client before backing off. Unlocks before returning
 * the client to the pool.
 */
async function withReservationCheckoutLock(reservationId, work, options = {}) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  const maxAttempts = options.maxAttempts ?? CHECKOUT_LOCK_MAX_ATTEMPTS;
  const sleepFn = typeof options.sleep === 'function' ? options.sleep : sleep;
  const getDelayMs =
    typeof options.delayMsForAttempt === 'function' ? options.delayMsForAttempt : checkoutLockDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await pool.connect();
    let acquired = false;
    try {
      acquired = await tryAcquireReservationCheckoutLock(client, id);
      if (acquired) {
        try {
          return await work(client);
        } finally {
          await releaseReservationCheckoutLock(client, id);
        }
      }
    } finally {
      client.release();
    }

    if (attempt < maxAttempts) {
      await sleepFn(getDelayMs(attempt));
    }
  }

  throw new CheckoutLockBusyError();
}

function normalizeJobLockKey(jobKey) {
  if (!jobKey || typeof jobKey !== 'string' || !jobKey.trim()) {
    throw new Error('Invalid job key for advisory lock');
  }
  return jobKey.trim();
}

/**
 * Non-blocking session-level lock for background jobs (one holder per job key).
 * Uses hashtext(jobKey) under ADVISORY_LOCK_NS.JOB.
 */
async function tryAcquireJobLock(client, jobKey) {
  const key = normalizeJobLockKey(jobKey);
  const result = await client.query(
    'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
    [ADVISORY_LOCK_NS.JOB, key]
  );
  return isPgBooleanTrue(result.rows[0]?.acquired);
}

async function releaseJobLock(client, jobKey) {
  const key = normalizeJobLockKey(jobKey);
  await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [
    ADVISORY_LOCK_NS.JOB,
    key,
  ]);
  return key;
}

/**
 * Runs work(client) while holding the job advisory lock.
 * If the lock is already held, returns { skipped: true } without calling work.
 */
async function withJobLock(jobKey, work) {
  const key = normalizeJobLockKey(jobKey);
  const client = await pool.connect();
  let acquired = false;
  try {
    acquired = await tryAcquireJobLock(client, key);
    if (!acquired) {
      return { skipped: true };
    }
    try {
      const result = await work(client);
      return { skipped: false, result };
    } finally {
      await releaseJobLock(client, key);
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
  tryAcquireReservationCheckoutLock,
  acquireReservationCheckoutLock,
  releaseReservationCheckoutLock,
  withReservationCheckoutLock,
  CheckoutLockBusyError,
  isCheckoutLockBusyError,
  tryAcquireJobLock,
  releaseJobLock,
  withJobLock,
};
