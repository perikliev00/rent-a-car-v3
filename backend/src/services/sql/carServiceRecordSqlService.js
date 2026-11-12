/**
 * SQL for car service/maintenance history records.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapServiceRecord).
 * @param {object} row
 * @returns {*}
 */
function mapServiceRecord(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the car id field value.
    carId: String(row.car_id),
    // Provide the service type field value.
    serviceType: row.service_type,
    // Provide the description field value.
    description: row.description || null,
    // Provide the cost field value.
    cost: row.cost != null ? Number(row.cost) : null,
    // Provide the mileage field value.
    mileage: row.mileage != null ? Number(row.mileage) : null,
    // Provide the service date field value.
    serviceDate: row.service_date
      // Continue the surrounding logic with this statement.
      ? String(row.service_date).slice(0, 10)
      // Contribute this line to the enclosing declaration or statement.
      : null,
    // Provide the next service date field value.
    nextServiceDate: row.next_service_date
      // Continue the surrounding logic with this statement.
      ? String(row.next_service_date).slice(0, 10)
      // Contribute this line to the enclosing declaration or statement.
      : null,
    // Provide the created by user id field value.
    createdByUserId: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
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
    FROM car_service_records
    WHERE car_id = $1
    ORDER BY service_date DESC, id DESC
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId)]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapServiceRecord);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {string|number} recordId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(carId, recordId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_service_records
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(recordId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return mapServiceRecord(result.rows[0]);
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
    INSERT INTO car_service_records (
      car_id,
      service_type,
      description,
      cost,
      mileage,
      service_date,
      next_service_date,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(carId),
      // Contribute this line to the enclosing declaration or statement.
      payload.serviceType,
      // Contribute this line to the enclosing declaration or statement.
      payload.description || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.cost ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.mileage ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.serviceDate,
      // Contribute this line to the enclosing declaration or statement.
      payload.nextServiceDate || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.createdByUserId ?? null,
    ]
  );
  // Return the resulting value to the caller.
  return mapServiceRecord(result.rows[0]);
}

/**
 * Update or upsert row; returns null when not found.
 * @param {string|number} carId
 * @param {string|number} recordId
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function update(carId, recordId, payload, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE car_service_records
    SET
      service_type = $3,
      description = $4,
      cost = $5,
      mileage = $6,
      service_date = $7,
      next_service_date = $8,
      updated_at = NOW()
    WHERE id = $1 AND car_id = $2
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(recordId),
      // Call Number to perform this step.
      Number(carId),
      // Contribute this line to the enclosing declaration or statement.
      payload.serviceType,
      // Contribute this line to the enclosing declaration or statement.
      payload.description || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.cost ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.mileage ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.serviceDate,
      // Contribute this line to the enclosing declaration or statement.
      payload.nextServiceDate || null,
    ]
  );
  // Return the resulting value to the caller.
  return mapServiceRecord(result.rows[0]);
}

/**
 * Delete row; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} recordId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function remove(carId, recordId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_service_records
    WHERE id = $1 AND car_id = $2
    RETURNING id
    `,
    // Continue the surrounding logic with this statement.
    [Number(recordId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return result.rowCount > 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listByCarId,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  create,
  // Contribute this line to the enclosing declaration or statement.
  update,
  // Contribute this line to the enclosing declaration or statement.
  remove,
};
