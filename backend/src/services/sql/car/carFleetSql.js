/**
 * Fleet status SQL: FOR UPDATE reads, status updates, and active-reservation counts.
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  fetchCarRowById,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlCar,
  // Contribute this line to the enclosing declaration or statement.
  normalizeCarId,
// Continue the surrounding logic with this statement.
} = require('./carMapper');

/**
 * Update fleet status; availability boolean mirrors status === 'available' for legacy UI.
 * Soft-deleted cars are skipped (is_deleted = FALSE).
 * @param {number|string} id
 * @param {string} status
 * @param {object|null} [client]
 */
async function updateCarStatus(id, status, client = null) {
  // Create the car id constant.
  const carId = normalizeCarId(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the availability constant.
  const availability = status === 'available';

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [carId, status, availability]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the row constant.
  const row = await fetchCarRowById(carId, client);
  // Return the resulting value to the caller.
  return mapSqlCar(row);
}

/**
 * Lock the car row (FOR UPDATE) before fleet status sync to avoid lost updates.
 * @param {number|string} id
 * @param {object|null} [client]
 */
async function findCarStatusForUpdate(id, client = null) {
  // Create the car id constant.
  const carId = normalizeCarId(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, status, availability, is_deleted
    FROM cars
    WHERE id = $1
    FOR UPDATE
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );

  // Create the row constant.
  const row = result.rows[0];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the status field value.
    status: row.status,
    // Provide the availability field value.
    availability: row.availability,
    // Provide the is deleted field value.
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
  // Create the id constant.
  const id = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!id) return 0;

  // Create the params constant.
  const params = [id];
  // Initialize the mutable exclude clause variable.
  let excludeClause = '';
  // Evaluate the condition and enter the branch when it is true.
  if (excludeReservationId != null) {
    // Call params.push to perform this step.
    params.push(Number(excludeReservationId));
    // Update excludeClause with the right-hand side value.
    excludeClause = `AND id <> $${params.length}`;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    WHERE car_id = $1
      AND status IN ('confirmed', 'car_prepared', 'picked_up', 'active_rental')
      ${excludeClause}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return result.rows[0]?.count ?? 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  updateCarStatus,
  // Contribute this line to the enclosing declaration or statement.
  findCarStatusForUpdate,
  // Contribute this line to the enclosing declaration or statement.
  countActiveFleetReservations,
};
