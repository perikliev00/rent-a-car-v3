/**
 * Expire stale reservation holds and release related calendar pressure.
 */
const { clientQuery } = require('../../../db/transaction');
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
const { normalizeCarId } = require('./reservationMapper');

/** Marks expired holds for one car so they leave the partial exclusion constraint. */
async function expireStaleHoldsForCar(carId, now = new Date(), client = null) {
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    return 0;
  }

  const result = await clientQuery(
    client,
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
    [normalizedCarId, now, ACTIVE_RESERVATION_STATUSES]
  );

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
    return 0;
  }

  const result = await clientQuery(
    client,
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
    [sessionId, now, ACTIVE_RESERVATION_STATUSES]
  );

  return result.rowCount || 0;
}

/**
 * mark reservation expired — mutates persisted state when applicable.
 * @param {string|number} reservationId
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function markReservationExpired(reservationId, now = new Date(), client = null) {
  const result = await clientQuery(
    client,
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
    [reservationId, now]
  );

  return (result.rowCount || 0) > 0;
}

/**
 * mark abandoned reservations — mutates persisted state when applicable.
 * @param {Array<*>} activeSessionIds
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function markAbandonedReservations(activeSessionIds, now = new Date(), client = null) {
  const params = [ACTIVE_RESERVATION_STATUSES, now];
  const abandonConditions = ['r.hold_expires_at <= $2', 'r.session_id IS NULL'];

  if (activeSessionIds.length) {
    params.push(activeSessionIds);
    abandonConditions.push(`r.session_id <> ALL($${params.length}::text[])`);
  }

  const result = await clientQuery(
    client,
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
    params
  );

  const reservationIds = (result.rows || [])
    .map((row) => (row.reservation_id != null ? String(row.reservation_id) : null))
    .filter(Boolean);

  return { count: reservationIds.length || result.rowCount || 0, reservationIds };
}

module.exports = {
  expireStaleHoldsForCar,
  expireStaleHoldsForSession,
  markReservationExpired,
  markAbandonedReservations,
};
