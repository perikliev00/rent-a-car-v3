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
  let photos = row.photos;
  if (typeof photos === 'string') {
    // Protected block: isolate failure modes.
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = [];
    }
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Array.isArray(photos)) photos = [];

  return {
    id: Number(row.id),
    carId: String(row.car_id),
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    description: row.description,
    photos,
    repairCost: row.repair_cost != null ? Number(row.repair_cost) : null,
    reportedByUserId: row.reported_by_user_id != null ? Number(row.reported_by_user_id) : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_damage_reports
    WHERE car_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [Number(carId)]
  );
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
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_damage_reports
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    [Number(reportId), Number(carId)]
  );
  return mapDamageReport(result.rows[0]);
}

/**
 * count unresolved.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function countUnresolved(carId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS count
    FROM car_damage_reports
    WHERE car_id = $1 AND status = 'unresolved'
    `,
    [Number(carId)]
  );
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
  const result = await clientQuery(
    client,
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
      Number(carId),
      payload.reservationId ? Number(payload.reservationId) : null,
      payload.description,
      JSON.stringify(payload.photos || []),
      payload.repairCost ?? null,
      payload.reportedByUserId ?? null,
    ]
  );
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
  const result = await clientQuery(
    client,
    `
    UPDATE car_damage_reports
    SET
      status = 'resolved',
      resolved_at = NOW(),
      updated_at = NOW()
    WHERE id = $1 AND car_id = $2 AND status = 'unresolved'
    RETURNING *
    `,
    [Number(reportId), Number(carId)]
  );
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
  const result = await clientQuery(
    client,
    `
    DELETE FROM car_damage_reports
    WHERE id = $1 AND car_id = $2
    RETURNING id, photos
    `,
    [Number(reportId), Number(carId)]
  );
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) return null;
  return mapDamageReport({ ...result.rows[0], car_id: carId, description: '', status: 'resolved' });
}

module.exports = {
  listByCarId,
  findById,
  countUnresolved,
  create,
  resolve,
  remove,
};
