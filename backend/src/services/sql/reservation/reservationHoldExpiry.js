/**
 * Expire stale reservation holds and release related calendar pressure.
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { normalizeCarId } = require('./reservationMapper');

/** Marks expired holds for one car so they leave the partial exclusion constraint. */
async function expireStaleHoldsForCar(carId, now = new Date(), client = null) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Return the resulting value to the caller.
    return 0;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE car_id = $1
        AND status = ANY($3::text[])
        AND hold_expires_at <= $2
      ORDER BY id
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'hold_expired'
    FROM updated
    RETURNING reservation_id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedCarId, now, ACTIVE_RESERVATION_STATUSES]
  );

  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

/**
 * Same as expireStaleHoldsForCar but scoped to one browser/checkout session_id.
 * @param {string} sessionId
 * @param {Date} [now]
 * @param {object|null} [client]
 */
async function expireStaleHoldsForSession(sessionId, now = new Date(), client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionId) {
    // Return the resulting value to the caller.
    return 0;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE session_id = $1
        AND status = ANY($3::text[])
        AND hold_expires_at <= $2
      ORDER BY id
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'hold_expired'
    FROM updated
    RETURNING reservation_id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [sessionId, now, ACTIVE_RESERVATION_STATUSES]
  );

  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

/**
 * mark reservation expired — mutates persisted state when applicable.
 * @param {string|number} reservationId
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function markReservationExpired(reservationId, now = new Date(), client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE id = $1
        AND status = 'processing_payment'
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'stripe_session_expired'
    FROM updated
    RETURNING reservation_id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId, now]
  );

  // Return the resulting value to the caller.
  return (result.rowCount || 0) > 0;
}

/**
 * mark abandoned reservations — mutates persisted state when applicable.
 * @param {Array<*>} activeSessionIds
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function markAbandonedReservations(activeSessionIds, now = new Date(), client = null) {
  // Create the params constant.
  const params = [ACTIVE_RESERVATION_STATUSES, now];
  // Create the abandon conditions constant.
  const abandonConditions = ['r.hold_expires_at <= $2', 'r.session_id IS NULL'];

  // Evaluate the condition and enter the branch when it is true.
  if (activeSessionIds.length) {
    // Call params.push to perform this step.
    params.push(activeSessionIds);
    // Call abandonConditions.push to perform this step.
    abandonConditions.push(`r.session_id <> ALL($${params.length}::text[])`);
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    WITH to_expire AS (
      SELECT r.id, r.status AS old_status
      FROM reservations r
      WHERE r.status = ANY($1::text[])
        AND NOT (r.status = 'processing_payment' AND r.stripe_session_id IS NOT NULL)
        AND (${abandonConditions.join(' OR ')})
      ORDER BY r.id
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'abandoned_hold'
    FROM updated
    RETURNING reservation_id
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Create the reservation ids constant.
  const reservationIds = (result.rows || [])
    // Call .map to perform this step.
    .map((row) => (row.reservation_id != null ? String(row.reservation_id) : null))
    // Call .filter to perform this step.
    .filter(Boolean);

  // Return the resulting value to the caller.
  return { count: reservationIds.length || result.rowCount || 0, reservationIds };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForCar,
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForSession,
  // Contribute this line to the enclosing declaration or statement.
  markReservationExpired,
  // Contribute this line to the enclosing declaration or statement.
  markAbandonedReservations,
};
