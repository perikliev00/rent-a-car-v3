/**
 * SQL upsert/find for pickup_checklists tied to reservations.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapChecklist).
 * @param {object} row
 * @returns {*}
 */
function mapChecklist(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the reservation id field value.
    reservationId: String(row.reservation_id),
    // Provide the fuel level field value.
    fuelLevel: row.fuel_level,
    // Provide the mileage field value.
    mileage: Number(row.mileage),
    // Provide the existing damages field value.
    existingDamages: row.existing_damages || null,
    // Provide the photos field value.
    photos: Array.isArray(row.photos) ? row.photos : [],
    // Provide the customer signature key field value.
    customerSignatureKey: row.customer_signature_key || null,
    // Provide the employee signature key field value.
    employeeSignatureKey: row.employee_signature_key || null,
    // Provide the pickup time field value.
    pickupTime: row.pickup_time,
    // Provide the notes field value.
    notes: row.notes || null,
    // Provide the created by user id field value.
    createdByUserId:
      // Continue the surrounding logic with this statement.
      row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/**
 * Find by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByReservationId(reservationId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM reservation_pickup_checklists
    WHERE reservation_id = $1
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(reservationId)]
  );
  // Return the resulting value to the caller.
  return mapChecklist(result.rows[0]);
}

/**
 * Update or upsert row; returns null when not found.
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function upsert(payload, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO reservation_pickup_checklists (
      reservation_id, fuel_level, mileage, existing_damages, photos,
      customer_signature_key, employee_signature_key, pickup_time, notes,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
    ON CONFLICT (reservation_id) DO UPDATE SET
      fuel_level = EXCLUDED.fuel_level,
      mileage = EXCLUDED.mileage,
      existing_damages = EXCLUDED.existing_damages,
      photos = EXCLUDED.photos,
      customer_signature_key = EXCLUDED.customer_signature_key,
      employee_signature_key = EXCLUDED.employee_signature_key,
      pickup_time = EXCLUDED.pickup_time,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(payload.reservationId),
      // Contribute this line to the enclosing declaration or statement.
      payload.fuelLevel,
      // Call Number to perform this step.
      Number(payload.mileage),
      // Contribute this line to the enclosing declaration or statement.
      payload.existingDamages || null,
      // Call JSON.stringify to perform this step.
      JSON.stringify(payload.photos || []),
      // Contribute this line to the enclosing declaration or statement.
      payload.customerSignatureKey || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.employeeSignatureKey || null,
      // Continue the surrounding logic with this statement.
      payload.pickupTime || new Date(),
      // Contribute this line to the enclosing declaration or statement.
      payload.notes || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.createdByUserId ?? null,
    ]
  );
  // Return the resulting value to the caller.
  return mapChecklist(result.rows[0]);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapChecklist,
  // Contribute this line to the enclosing declaration or statement.
  findByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  upsert,
};
