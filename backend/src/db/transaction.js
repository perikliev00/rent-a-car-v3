const pool = require('./pool');

const PG_UNIQUE_VIOLATION = '23505';
const PG_EXCLUSION_VIOLATION = '23P01';
const CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT = 'no_overlapping_car_blocks';
const RESERVATION_HOLD_OVERLAP_CONSTRAINT = 'no_overlapping_active_reservation_holds';

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
  await client.query('SELECT pg_advisory_xact_lock($1)', [id]);
}

module.exports = {
  PG_UNIQUE_VIOLATION,
  PG_EXCLUSION_VIOLATION,
  CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT,
  RESERVATION_HOLD_OVERLAP_CONSTRAINT,
  isUniqueViolation,
  isExclusionViolation,
  isCarDateBlockOverlapViolation,
  isReservationHoldOverlapViolation,
  runWithTransaction,
  runWithOptionalTransaction,
  clientQuery,
  acquireCarAdvisoryLock,
};
