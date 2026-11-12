/**
 * Car listing queries for calendar resource columns and day-ops warnings.
 */

const { clientQuery } = require('../../../db/transaction');

/**
 * List non-deleted cars for the calendar grid, optionally scoped by carIds/filters.
 * @param {{ filters?: object, carIds?: Array<string|number>|null }} [opts]
 * @param {import('pg').PoolClient|null} [client]
 */
async function listCarsForCalendar({ filters = {}, carIds = null } = {}, client = null) {
  // Create the where constant.
  const where = ['c.is_deleted = FALSE'];
  // Create the params constant.
  const params = [];

  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(carIds) && carIds.length > 0) {
    // Call params.push to perform this step.
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    // Call where.push to perform this step.
    where.push(`c.id = ANY($${params.length}::bigint[])`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (filters.categoryId) {
    // Call params.push to perform this step.
    params.push(Number(filters.categoryId));
    // Call where.push to perform this step.
    where.push(`c.category_id = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (filters.transmission) {
    // Call params.push to perform this step.
    params.push(filters.transmission);
    // Call where.push to perform this step.
    where.push(`c.transmission = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (filters.fuelType) {
    // Call params.push to perform this step.
    params.push(filters.fuelType);
    // Call where.push to perform this step.
    where.push(`c.fuel_type = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (filters.carStatus) {
    // Call params.push to perform this step.
    params.push(filters.carStatus);
    // Call where.push to perform this step.
    where.push(`c.status = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (filters.location) {
    // Call params.push to perform this step.
    params.push(`%${filters.location}%`);
    // Call where.push to perform this step.
    where.push(`c.current_location ILIKE $${params.length}`);
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      c.id, c.name, c.transmission, c.fuel_type, c.status,
      c.current_location, c.insurance_expiry, c.technical_inspection_expiry,
      c.category_id, cat.name AS category_name
    FROM cars c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY c.name ASC
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => ({
    // Provide the id field value.
    id: String(row.id),
    // Provide the name field value.
    name: row.name,
    // Provide the transmission field value.
    transmission: row.transmission,
    // Provide the fuel type field value.
    fuelType: row.fuel_type,
    // Provide the status field value.
    status: row.status,
    // Provide the current location field value.
    currentLocation: row.current_location || null,
    // Provide the insurance expiry field value.
    insuranceExpiry: row.insurance_expiry,
    // Provide the technical inspection expiry field value.
    technicalInspectionExpiry: row.technical_inspection_expiry,
    // Provide the category id field value.
    categoryId: row.category_id != null ? String(row.category_id) : null,
    // Provide the category name field value.
    categoryName: row.category_name || null,
  }));
}

/**
 * Cars with insurance or technical inspection expiring within 14 days of dateIso.
 * @param {string} dateIso YYYY-MM-DD
 */
async function listInsuranceWarnings(dateIso, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, name, insurance_expiry, technical_inspection_expiry, status
    FROM cars
    WHERE is_deleted = FALSE
      AND (
        (insurance_expiry IS NOT NULL AND insurance_expiry <= ($1::date + INTERVAL '14 days'))
        OR (technical_inspection_expiry IS NOT NULL AND technical_inspection_expiry <= ($1::date + INTERVAL '14 days'))
      )
    ORDER BY name ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [dateIso]
  );
  // Return the resulting value to the caller.
  return result.rows;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCarsForCalendar,
  // Contribute this line to the enclosing declaration or statement.
  listInsuranceWarnings,
};
