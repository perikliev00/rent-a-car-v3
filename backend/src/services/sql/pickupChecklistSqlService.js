const { clientQuery } = require('../../db/transaction');

function mapChecklist(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    reservationId: String(row.reservation_id),
    fuelLevel: row.fuel_level,
    mileage: Number(row.mileage),
    existingDamages: row.existing_damages || null,
    photos: Array.isArray(row.photos) ? row.photos : [],
    customerSignatureKey: row.customer_signature_key || null,
    employeeSignatureKey: row.employee_signature_key || null,
    pickupTime: row.pickup_time,
    notes: row.notes || null,
    createdByUserId:
      row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findByReservationId(reservationId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM reservation_pickup_checklists
    WHERE reservation_id = $1
    LIMIT 1
    `,
    [Number(reservationId)]
  );
  return mapChecklist(result.rows[0]);
}

async function upsert(payload, client = null) {
  const result = await clientQuery(
    client,
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
      Number(payload.reservationId),
      payload.fuelLevel,
      Number(payload.mileage),
      payload.existingDamages || null,
      JSON.stringify(payload.photos || []),
      payload.customerSignatureKey || null,
      payload.employeeSignatureKey || null,
      payload.pickupTime || new Date(),
      payload.notes || null,
      payload.createdByUserId ?? null,
    ]
  );
  return mapChecklist(result.rows[0]);
}

module.exports = {
  mapChecklist,
  findByReservationId,
  upsert,
};
