/**
 * SQL for car_damage_reports (list/create/resolve/remove).
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapDamageReport).
 * @param {object} row
 * @returns {*}
 */
function mapDamageReport(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Initialize the mutable photos variable.
  let photos = row.photos;
  // Evaluate the condition and enter the branch when it is true.
  if (typeof photos === 'string') {
    // Protected block: isolate failure modes.
    try {
      // Update photos with the right-hand side value.
      photos = JSON.parse(photos);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Update photos with the right-hand side value.
      photos = [];
    }
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Array.isArray(photos)) photos = [];

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the car id field value.
    carId: String(row.car_id),
    // Provide the reservation id field value.
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    // Provide the description field value.
    description: row.description,
    // Contribute this line to the enclosing declaration or statement.
    photos,
    // Provide the repair cost field value.
    repairCost: row.repair_cost != null ? Number(row.repair_cost) : null,
    // Provide the reported by user id field value.
    reportedByUserId: row.reported_by_user_id != null ? Number(row.reported_by_user_id) : null,
    // Provide the status field value.
    status: row.status,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
    // Provide the resolved at field value.
    resolvedAt: row.resolved_at || null,
  };
}

/**
 * List by car id from SQL.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listByCarId(carId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_damage_reports
    WHERE car_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId)]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapDamageReport);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {string|number} reportId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(carId, reportId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_damage_reports
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(reportId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return mapDamageReport(result.rows[0]);
}

/**
 * count unresolved.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function countUnresolved(carId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM car_damage_reports
    WHERE car_id = $1 AND status = 'unresolved'
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId)]
  );
  // Return the resulting value to the caller.
  return result.rows[0]?.count ?? 0;
}

/**
 * Insert a new row and return the mapped result.
 * @param {string|number} carId
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function create(carId, payload, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO car_damage_reports (
      car_id,
      reservation_id,
      description,
      photos,
      repair_cost,
      reported_by_user_id,
      status
    )
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'unresolved')
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(carId),
      // Continue the surrounding logic with this statement.
      payload.reservationId ? Number(payload.reservationId) : null,
      // Contribute this line to the enclosing declaration or statement.
      payload.description,
      // Call JSON.stringify to perform this step.
      JSON.stringify(payload.photos || []),
      // Contribute this line to the enclosing declaration or statement.
      payload.repairCost ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.reportedByUserId ?? null,
    ]
  );
  // Return the resulting value to the caller.
  return mapDamageReport(result.rows[0]);
}

/**
 * Resolve  from inputs / Stripe / DB.
 * @param {string|number} carId
 * @param {string|number} reportId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function resolve(carId, reportId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE car_damage_reports
    SET
      status = 'resolved',
      resolved_at = NOW(),
      updated_at = NOW()
    WHERE id = $1 AND car_id = $2 AND status = 'unresolved'
    RETURNING *
    `,
    // Continue the surrounding logic with this statement.
    [Number(reportId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return mapDamageReport(result.rows[0]);
}

/**
 * Delete row; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} reportId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function remove(carId, reportId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_damage_reports
    WHERE id = $1 AND car_id = $2
    RETURNING id, photos
    `,
    // Continue the surrounding logic with this statement.
    [Number(reportId), Number(carId)]
  );
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) return null;
  // Return the resulting value to the caller.
  return mapDamageReport({ ...result.rows[0], car_id: carId, description: '', status: 'resolved' });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listByCarId,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  countUnresolved,
  // Contribute this line to the enclosing declaration or statement.
  create,
  // Contribute this line to the enclosing declaration or statement.
  resolve,
  // Contribute this line to the enclosing declaration or statement.
  remove,
};
