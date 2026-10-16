/**
 * Transaction helpers, PostgreSQL constraint classifiers, and advisory locks
 * for cars, sessions, checkout, and background jobs.
 */

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

/**
 * True when `err` is a PostgreSQL unique_violation (SQLSTATE 23505).
 *
 * @param {unknown} err - Driver / query error
 * @returns {boolean}
 * @throws {never}
 */
function isUniqueViolation(err) {
  return Boolean(err && err.code === PG_UNIQUE_VIOLATION);
}

/**
 * True when `err` is a PostgreSQL exclusion_violation (SQLSTATE 23P01).
 *
 * @param {unknown} err
 * @returns {boolean}
 * @throws {never}
 */
function isExclusionViolation(err) {
  return Boolean(err && err.code === PG_EXCLUSION_VIOLATION);
}

/**
 * True when an exclusion violation came from overlapping car date blocks.
 * Treats a missing `constraint` name as a match (older drivers / wrapped errors).
 *
 * @param {unknown} err
 * @returns {boolean}
 * @throws {never}
 */
function isCarDateBlockOverlapViolation(err) {
  return (
    isExclusionViolation(err) &&
    (!err.constraint || err.constraint === CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT)
  );
}

/**
 * True when an exclusion violation came from overlapping active reservation holds.
 *
 * @param {unknown} err
 * @returns {boolean}
 * @throws {never}
 */
function isReservationHoldOverlapViolation(err) {
  return (
    isExclusionViolation(err) &&
    (!err.constraint || err.constraint === RESERVATION_HOLD_OVERLAP_CONSTRAINT)
  );
}

/**
 * True when a unique violation is the one-active-hold-per-session index.
 *
 * @param {unknown} err
 * @returns {boolean}
 * @throws {never}
 */
function isActiveSessionHoldUniqueViolation(err) {
  return isUniqueViolation(err) && err.constraint === ACTIVE_SESSION_HOLD_UNIQUE_INDEX;
}

/**
 * Run `work(client)` inside a PostgreSQL transaction.
 * `client` is a PoolClient — all queries inside `work` must use it.
 *
 * @param {(client: import('pg').PoolClient) => Promise<unknown>} work
 * @returns {Promise<unknown>} Result of `work`
 * @throws {Error} Rethrows whatever `work` (or BEGIN/COMMIT) throws after ROLLBACK
 */
async function runWithTransaction(work) {
  // Borrow a dedicated client so BEGIN/COMMIT/ROLLBACK stay on one connection.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Best-effort rollback; always rethrow the original work error.
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures — rethrow the original error.
    }
    throw err;
  } finally {
    // Always return the client to the pool.
    client.release();
  }
}

/**
 * Same API as the former Mongo optional-transaction helper.
 * PostgreSQL always supports transactions, so `client` is never null.
 *
 * @param {(client: import('pg').PoolClient) => Promise<unknown>} work
 * @returns {Promise<unknown>} Result of `work`
 * @throws {Error} Same as {@link runWithTransaction}
 */
async function runWithOptionalTransaction(work) {
  return runWithTransaction(work);
}

/**
 * Run SQL via `client` (in a transaction) or the shared pool (outside a transaction).
 *
 * @param {import('pg').PoolClient | null | undefined} client - Transaction client, or null/undefined for pool
 * @param {string} text - SQL text
 * @param {unknown[]} [params] - Bind parameters
 * @returns {Promise<import('pg').QueryResult>}
 * @throws {Error} Propagates driver / SQL errors from `query`
 */
function clientQuery(client, text, params) {
  // Prefer the transactional client when present so work stays inside BEGIN.
  if (client) {
    return client.query(text, params);
  }
  return pool.query(text, params);
}

/**
 * Transaction-scoped advisory lock on `car_id` — released automatically on COMMIT/ROLLBACK.
 *
 * @param {import('pg').PoolClient} client - Must be inside an open transaction
 * @param {number|string} carId - Positive integer car id
 * @returns {Promise<void>}
 * @throws {Error} When `carId` is not a positive integer
 */
async function acquireCarAdvisoryLock(client, carId) {
  const id = Number(carId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid car id for advisory lock');
  }
  // Blocks until the lock is free; released with the surrounding transaction.
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, id]);
}

/**
 * Unique car ids, sorted ascending, then locked one by one.
 *
 * @param {import('pg').PoolClient} client - Must be inside an open transaction
 * @param {Array<number|string>} carIds - Raw car ids (invalid entries dropped)
 * @returns {Promise<number[]>} Sorted unique positive ids that were locked
 * @throws {Error} When an individual id fails {@link acquireCarAdvisoryLock} validation
 */
async function acquireCarAdvisoryLocks(client, carIds) {
  // Deduplicate and sort ascending so all callers take car locks in the same order.
  const uniqueSorted = [
    ...new Set(
      (carIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ].sort((a, b) => a - b);

  // Acquire one lock at a time in sorted order (deadlock avoidance).
  for (const id of uniqueSorted) {
    await acquireCarAdvisoryLock(client, id);
  }

  return uniqueSorted;
}

/**
 * Transaction-scoped advisory lock on `session_id` (PostgreSQL hashtext, namespaced).
 * Must be taken before car locks on hold-create / rehold paths.
 *
 * @param {import('pg').PoolClient} client - Must be inside an open transaction
 * @param {string} sessionId - Non-empty session identifier
 * @returns {Promise<void>}
 * @throws {Error} When `sessionId` is missing or not a string
 */
async function acquireSessionAdvisoryLock(client, sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session id for advisory lock');
  }
  // hashtext maps the string session id into the second advisory-lock key slot.
  await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
    ADVISORY_LOCK_NS.SESSION,
    sessionId,
  ]);
}

const CHECKOUT_LOCK_MAX_ATTEMPTS = 40;
const CHECKOUT_LOCK_BASE_DELAY_MS = 25;
const CHECKOUT_LOCK_MAX_DELAY_MS = 200;

/**
 * Error thrown when a reservation checkout advisory lock cannot be acquired.
 *
 * @extends Error
 */
class CheckoutLockBusyError extends Error {
  /**
   * @param {string} [message='Checkout lock busy']
   */
  constructor(message = 'Checkout lock busy') {
    super(message);
    this.name = 'CheckoutLockBusyError';
    this.code = 'CHECKOUT_LOCK_BUSY';
  }
}

/**
 * @param {unknown} err
 * @returns {boolean}
 * @throws {never}
 */
function isCheckoutLockBusyError(err) {
  return Boolean(err && err.code === 'CHECKOUT_LOCK_BUSY');
}

/**
 * Normalize PostgreSQL boolean-ish results from `pg_try_advisory_lock`.
 *
 * @param {unknown} value - true / 't' / 'true' from node-pg
 * @returns {boolean}
 * @throws {never}
 */
function isPgBooleanTrue(value) {
  return value === true || value === 't' || value === 'true';
}

/**
 * Promise-based delay used for checkout-lock backoff.
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 * @throws {never}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay (with jitter) for checkout lock retries.
 *
 * @param {number} attempt - 1-based attempt index
 * @returns {number} Delay in milliseconds
 * @throws {never}
 */
function checkoutLockDelayMs(attempt) {
  // Cap exponential growth, then pick a random point in the upper half of the window.
  const exp = Math.min(
    CHECKOUT_LOCK_MAX_DELAY_MS,
    CHECKOUT_LOCK_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  );
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

/**
 * Coerce and validate a reservation id for checkout advisory locks.
 *
 * @param {number|string} reservationId
 * @returns {number} Positive integer id
 * @throws {Error} When the id is not a positive integer
 */
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
 *
 * @param {import('pg').PoolClient} client - Pool client that will hold the session lock
 * @param {number|string} reservationId
 * @returns {Promise<boolean>} True when the lock was acquired
 * @throws {Error} When `reservationId` is invalid
 */
async function tryAcquireReservationCheckoutLock(client, reservationId) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  // Non-blocking: returns false immediately if another holder exists.
  const result = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
    ADVISORY_LOCK_NS.CHECKOUT,
    id,
  ]);
  return isPgBooleanTrue(result.rows[0]?.acquired);
}

/**
 * Acquire the checkout lock or throw {@link CheckoutLockBusyError}.
 *
 * @param {import('pg').PoolClient} client
 * @param {number|string} reservationId
 * @returns {Promise<number>} Normalized reservation id
 * @throws {CheckoutLockBusyError} When the lock is held by another client
 * @throws {Error} When `reservationId` is invalid
 */
async function acquireReservationCheckoutLock(client, reservationId) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  const acquired = await tryAcquireReservationCheckoutLock(client, reservationId);
  if (!acquired) {
    throw new CheckoutLockBusyError();
  }
  return id;
}

/**
 * Release a previously acquired session-level checkout lock.
 *
 * @param {import('pg').PoolClient} client - Same client that acquired the lock
 * @param {number|string} reservationId
 * @returns {Promise<number>} Normalized reservation id
 * @throws {Error} When `reservationId` is invalid
 */
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
 *
 * @param {number|string} reservationId
 * @param {(client: import('pg').PoolClient) => Promise<unknown>} work
 * @param {{ maxAttempts?: number, sleep?: (ms: number) => Promise<void>, delayMsForAttempt?: (attempt: number) => number }} [options]
 * @returns {Promise<unknown>} Result of `work`
 * @throws {CheckoutLockBusyError} When all acquire attempts fail
 * @throws {Error} Propagates errors from `work` after unlocking
 */
async function withReservationCheckoutLock(reservationId, work, options = {}) {
  const id = normalizeReservationCheckoutLockId(reservationId);
  const maxAttempts = options.maxAttempts ?? CHECKOUT_LOCK_MAX_ATTEMPTS;
  const sleepFn = typeof options.sleep === 'function' ? options.sleep : sleep;
  const getDelayMs =
    typeof options.delayMsForAttempt === 'function' ? options.delayMsForAttempt : checkoutLockDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Fresh client per attempt so waiters do not hold pool slots during backoff.
    const client = await pool.connect();
    let acquired = false;
    try {
      acquired = await tryAcquireReservationCheckoutLock(client, id);
      if (acquired) {
        try {
          return await work(client);
        } finally {
          // Always unlock before the client returns to the pool.
          await releaseReservationCheckoutLock(client, id);
        }
      }
    } finally {
      client.release();
    }

    // Back off before the next try (skipped after the final attempt).
    if (attempt < maxAttempts) {
      await sleepFn(getDelayMs(attempt));
    }
  }

  throw new CheckoutLockBusyError();
}

/**
 * Trim and validate a background-job lock key.
 *
 * @param {string} jobKey - Non-empty job identifier
 * @returns {string} Trimmed key
 * @throws {Error} When the key is missing/blank/non-string
 */
function normalizeJobLockKey(jobKey) {
  if (!jobKey || typeof jobKey !== 'string' || !jobKey.trim()) {
    throw new Error('Invalid job key for advisory lock');
  }
  return jobKey.trim();
}

/**
 * Non-blocking session-level lock for background jobs (one holder per job key).
 * Uses hashtext(jobKey) under ADVISORY_LOCK_NS.JOB.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} jobKey
 * @returns {Promise<boolean>} True when the lock was acquired
 * @throws {Error} When `jobKey` is invalid
 */
async function tryAcquireJobLock(client, jobKey) {
  const key = normalizeJobLockKey(jobKey);
  const result = await client.query(
    'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
    [ADVISORY_LOCK_NS.JOB, key]
  );
  return isPgBooleanTrue(result.rows[0]?.acquired);
}

/**
 * Release a previously acquired job advisory lock.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} jobKey
 * @returns {Promise<string>} Normalized job key
 * @throws {Error} When `jobKey` is invalid
 */
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
 *
 * @param {string} jobKey
 * @param {(client: import('pg').PoolClient) => Promise<unknown>} work
 * @returns {Promise<{ skipped: true } | { skipped: false, result: unknown }>}
 * @throws {Error} Propagates errors from `work` after unlocking; also invalid `jobKey`
 */
async function withJobLock(jobKey, work) {
  const key = normalizeJobLockKey(jobKey);
  const client = await pool.connect();
  let acquired = false;
  try {
    acquired = await tryAcquireJobLock(client, key);
    // Another worker already holds this job key — skip without running work.
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
