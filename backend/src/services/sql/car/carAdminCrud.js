/**
 * Low-level car admin CRUD SQL (create/update/soft-delete) used by carSqlService.
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
 * Insert admin car and return the mapped result.
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function createAdminCar(payload, client = null) {
  // Create the status constant.
  const status = payload.status || (payload.availability === false ? 'inactive' : 'available');
  // Create the availability constant.
  const availability = status === 'available';

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO cars (
      name,
      image,
      transmission,
      price,
      price_tier_1_3,
      price_tier_7_31,
      price_tier_31_plus,
      seats,
      fuel_type,
      availability,
      status,
      registration_number,
      vin,
      mileage,
      fuel_level,
      current_location,
      insurance_expiry,
      technical_inspection_expiry,
      category_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING id
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      payload.name,
      // Contribute this line to the enclosing declaration or statement.
      payload.image,
      // Contribute this line to the enclosing declaration or statement.
      payload.transmission,
      // Contribute this line to the enclosing declaration or statement.
      payload.price,
      // Contribute this line to the enclosing declaration or statement.
      payload.priceTier_1_3 ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.priceTier_7_31 ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.priceTier_31_plus ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.seats,
      // Contribute this line to the enclosing declaration or statement.
      payload.fuelType,
      // Contribute this line to the enclosing declaration or statement.
      availability,
      // Contribute this line to the enclosing declaration or statement.
      status,
      // Contribute this line to the enclosing declaration or statement.
      payload.registrationNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.vin || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.mileage ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.fuelLevel || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.currentLocation || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.insuranceExpiry || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.technicalInspectionExpiry || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.categoryId ?? null,
    ]
  );

  // Create the row constant.
  const row = await fetchCarRowById(result.rows[0].id, client);
  // Return the resulting value to the caller.
  return mapSqlCar(row);
}

/**
 * Update or upsert admin car; returns null when not found.
 * @param {string|number} id
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function updateAdminCar(id, payload, client = null) {
  // Create the car id constant.
  const carId = normalizeCarId(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the status constant.
  const status =
    // Contribute this line to the enclosing declaration or statement.
    payload.status ||
    // Continue the surrounding logic with this statement.
    (payload.availability === false ? 'inactive' : 'available');
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
      name = $2,
      transmission = $3,
      price = $4,
      price_tier_1_3 = $5,
      price_tier_7_31 = $6,
      price_tier_31_plus = $7,
      seats = $8,
      fuel_type = $9,
      availability = $10,
      image = COALESCE($11, image),
      category_id = $12,
      status = $13,
      registration_number = $14,
      vin = $15,
      mileage = $16,
      fuel_level = $17,
      current_location = $18,
      insurance_expiry = $19,
      technical_inspection_expiry = $20,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      payload.name,
      // Contribute this line to the enclosing declaration or statement.
      payload.transmission,
      // Contribute this line to the enclosing declaration or statement.
      payload.price,
      // Contribute this line to the enclosing declaration or statement.
      payload.priceTier_1_3 ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.priceTier_7_31 ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.priceTier_31_plus ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.seats,
      // Contribute this line to the enclosing declaration or statement.
      payload.fuelType,
      // Contribute this line to the enclosing declaration or statement.
      availability,
      // Contribute this line to the enclosing declaration or statement.
      payload.image || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.categoryId ?? null,
      // Contribute this line to the enclosing declaration or statement.
      status,
      // Contribute this line to the enclosing declaration or statement.
      payload.registrationNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.vin || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.mileage ?? null,
      // Contribute this line to the enclosing declaration or statement.
      payload.fuelLevel || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.currentLocation || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.insuranceExpiry || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.technicalInspectionExpiry || null,
    ]
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
 * Delete car by id; returns whether a row was affected.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function deleteCarById(id, client = null) {
  // Create the car id constant.
  const carId = normalizeCarId(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE cars
    SET
      is_deleted = TRUE,
      deleted_at = NOW(),
      availability = FALSE,
      status = 'inactive',
      updated_at = NOW()
    WHERE id = $1
      AND is_deleted = FALSE
    RETURNING id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );

  // Return the resulting value to the caller.
  return result.rowCount > 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarById,
};
