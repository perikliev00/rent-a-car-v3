/**
 * Reservation repository facade over `reservationSqlService`.
 * Encapsulates hold lookup, overlap checks, create/rehold, and abandonment helpers.
 */

const reservationSql = require('../services/sql/reservationSqlService');

/**
 * Find the active payment hold for a browser/session id.
 *
 * @param {string} sessionId - Customer session identifier
 * @param {import('pg').PoolClient | null} [client=null] - Optional transaction client
 * @returns {Promise<object|null>} Active hold reservation, or null
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findActiveBySessionId(sessionId, client = null) {
  return reservationSql.findActiveBySessionId(sessionId, client);
}

/**
 * Find a reservation by its Stripe Checkout session id.
 *
 * @param {string} stripeSessionId
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object|null>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findByStripeSessionId(stripeSessionId, client = null) {
  return reservationSql.findByStripeSessionId(stripeSessionId, client);
}

/**
 * Load a reservation by primary key.
 *
 * @param {number|string} id
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object|null>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findById(id, client = null) {
  return reservationSql.findById(id, client);
}

/**
 * Find an overlapping active hold for the given car/window criteria.
 *
 * @param {object} criteria - Overlap criteria (carId, start, end, excludeId, …)
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object|null>} Conflicting hold, or null when free
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findOverlappingHold(criteria, client = null) {
  return reservationSql.findOverlappingHold(criteria, client);
}

/**
 * Find a booked-date overlap for a car in the given window.
 *
 * @param {number|string} carId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object|null>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findBookedDateOverlap(carId, startDate, endDate, client = null) {
  return reservationSql.findBookedDateOverlap(carId, startDate, endDate, client);
}

/**
 * Find an open physical rental (picked up / active) for a car.
 *
 * @param {number|string} carId
 * @param {import('pg').PoolClient | null} [client=null]
 * @param {object} [options={}] - Extra filters forwarded to the SQL service
 * @returns {Promise<object|null>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findOpenPhysicalRental(carId, client = null, options = {}) {
  return reservationSql.findOpenPhysicalRental(carId, client, options);
}

/**
 * Create a pending_payment reservation row (no availability orchestration).
 *
 * @param {object} payload - Pending reservation fields
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object>}
 * @throws {Error} Propagates SQL / constraint errors from the SQL service
 */
async function create(payload, client = null) {
  return reservationSql.createPendingReservation(payload, client);
}

/**
 * Create a pending hold after availability checks (transactional).
 * Takes session + car advisory locks and overlap checks inside the SQL service.
 *
 * @param {object} payload - Hold create payload (session, car, dates, …)
 * @returns {Promise<object>}
 * @throws {Error} Propagates conflict / SQL errors from the SQL service
 */
async function createWithAvailabilityCheck(payload) {
  return reservationSql.createPendingReservationWithAvailabilityCheck(payload);
}

/**
 * Replace an existing session hold with a new one after availability checks.
 *
 * @param {object} payload - Rehold payload (session, car, dates, …)
 * @returns {Promise<object>}
 * @throws {Error} Propagates conflict / SQL errors from the SQL service
 */
async function reholdWithAvailabilityCheck(payload) {
  return reservationSql.reholdPendingReservationWithAvailabilityCheck(payload);
}

/**
 * Create an already-confirmed reservation (admin / ops path).
 *
 * @param {object} payload - Confirmed reservation fields
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object>}
 * @throws {Error} Propagates SQL / constraint errors from the SQL service
 */
async function createConfirmed(payload, client = null) {
  return reservationSql.createConfirmedReservation(payload, client);
}

/**
 * Persist updates on an existing reservation row.
 *
 * @param {object} reservation - Reservation entity with id + changed fields
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object>}
 * @throws {Error} Propagates SQL / constraint errors from the SQL service
 */
async function update(reservation, client = null) {
  return reservationSql.update(reservation, client);
}

/**
 * List processing_payment reservations that still have a Stripe session id.
 * Used by checkout reconciliation jobs.
 *
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object[]>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findProcessingWithStripeSession(client = null) {
  return reservationSql.findProcessingWithStripeSession(client);
}

/**
 * List processing_payment holds whose hold window has expired.
 *
 * @param {Date} [now=new Date()] - Reference "now" for expiry comparison
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object[]>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function findProcessingWithExpiredHold(now = new Date(), client = null) {
  return reservationSql.findProcessingWithExpiredHold(now, client);
}

/**
 * Mark a single reservation as expired.
 *
 * @param {number|string} reservationId
 * @param {Date} [now=new Date()]
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<object|null>}
 * @throws {Error} Propagates SQL / status-transition errors from the SQL service
 */
async function markExpired(reservationId, now = new Date(), client = null) {
  return reservationSql.markReservationExpired(reservationId, now, client);
}

/**
 * Mark abandoned holds for sessions that are no longer active.
 *
 * @param {string[]} activeSessionIds - Session ids that should remain untouched
 * @param {Date} [now=new Date()]
 * @param {import('pg').PoolClient | null} [client=null]
 * @returns {Promise<unknown>}
 * @throws {Error} Propagates SQL / driver errors from the SQL service
 */
async function markAbandoned(activeSessionIds, now = new Date(), client = null) {
  return reservationSql.markAbandonedReservations(activeSessionIds, now, client);
}

module.exports = {
  findActiveBySessionId,
  findById,
  findByStripeSessionId,
  findProcessingWithStripeSession,
  findProcessingWithExpiredHold,
  markExpired,
  findOverlappingHold,
  findBookedDateOverlap,
  findOpenPhysicalRental,
  create,
  createWithAvailabilityCheck,
  reholdWithAvailabilityCheck,
  createConfirmed,
  update,
  markAbandoned,
};
