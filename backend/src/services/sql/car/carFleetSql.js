/**
 * Fleet status SQL: FOR UPDATE reads, status updates, and active-reservation counts.
 */
const { clientQuery } = require('../../../db/transaction');
const {
  fetchCarRowById,
  mapSqlCar,
  normalizeCarId,
} = require('./carMapper');

/**
 * Update fleet status; availability boolean mirrors status === 'available' for legacy UI.
 * Soft-deleted cars are skipped (is_deleted = FALSE).
 * @param {number|string} id
 * @param {string} status
 * @param {object|null} [client]
 */
async function updateCarStatus(id, status, client = null) {
  const carId = normalizeCarId(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const availability = status === 'available';

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      status = $2,
      availability = $3,
      updated_at = NOW()
    WHERE id = $1
      AND is_deleted = FALSE
    RETURNING id
    `,
    [carId, status, availability]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) {
    return null;
  }

  const row = await fetchCarRowById(carId, client);
  return mapSqlCar(row);
}

/**
 * Lock the car row (FOR UPDATE) before fleet status sync to avoid lost updates.
 * @param {number|string} id
 * @param {object|null} [client]
 */
async function findCarStatusForUpdate(id, client = null) {
  const carId = normalizeCarId(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT id, status, availability, is_deleted
    FROM cars
    WHERE id = $1
    FOR UPDATE
    `,
    [carId]
  );

  const row = result.rows[0];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  return {
    id: String(row.id),
    status: row.status,
    availability: row.availability,
    isDeleted: Boolean(row.is_deleted),
  };
}

/**
 * Count other active fleet-relevant reservations for a car (used before releasing reserved→available).
 * @param {number|string} carId
 * @param {number|string|null} [excludeReservationId]
 * @param {object|null} [client]
 */
async function countActiveFleetReservations(carId, excludeReservationId = null, client = null) {
  const id = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!id) return 0;

  const params = [id];
  let excludeClause = '';
  if (excludeReservationId != null) {
    params.push(Number(excludeReservationId));
    excludeClause = `AND id <> $${params.length}`;
  }

  const result = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE car_id = $1
      AND status IN ('confirmed', 'car_prepared', 'picked_up', 'active_rental')
      ${excludeClause}
    `,
    params
  );

  return result.rows[0]?.count ?? 0;
}

module.exports = {
  updateCarStatus,
  findCarStatusForUpdate,
  countActiveFleetReservations,
};
