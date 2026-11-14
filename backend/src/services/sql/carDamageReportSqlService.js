/**
 * SQL for car_damage_reports (list/create/resolve/remove).
 */
const { clientQuery, runWithTransaction, ADVISORY_LOCK_NS } = require('../../db/transaction');

const DAMAGE_SOURCES = Object.freeze({
  MANUAL: 'manual',
  RETURN_CHECKLIST: 'return_checklist',
});

/**
 * Map a DB/API row into the domain shape used by callers (mapDamageReport).
 * @param {object} row
 * @returns {*}
 */
function mapDamageReport(row) {
  if (!row) return null;
  let photos = row.photos;
  if (typeof photos === 'string') {
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = [];
    }
  }
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
    source: row.source || DAMAGE_SOURCES.MANUAL,
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
  const source = payload.source || DAMAGE_SOURCES.MANUAL;
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
      status,
      source
    )
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'unresolved', $7)
    RETURNING *
    `,
    [
      Number(carId),
      payload.reservationId ? Number(payload.reservationId) : null,
      payload.description,
      JSON.stringify(payload.photos || []),
      payload.repairCost ?? null,
      payload.reportedByUserId ?? null,
      source,
    ]
  );
  return mapDamageReport(result.rows[0]);
}

/**
 * Idempotent damage write for return-checklist retries: update the existing
 * unresolved auto row for the reservation (including description/cost edits),
 * otherwise insert. Manual reports are never matched or mutated.
 * @param {string|number} carId
 * @param {object} payload
 * @param {object|null} [client]
 */
async function upsertForReservation(carId, payload, client = null) {
  const reservationId = payload.reservationId ? Number(payload.reservationId) : null;
  if (!reservationId) {
    return create(carId, { ...payload, source: DAMAGE_SOURCES.RETURN_CHECKLIST }, client);
  }
  // Serialize per reservation so a concurrent double submit cannot insert twice.
  if (client) {
    await acquireDamageReportLock(client, reservationId);
    return upsertForReservationLocked(carId, payload, client);
  }
  return runWithTransaction(async (txClient) => {
    await acquireDamageReportLock(txClient, reservationId);
    return upsertForReservationLocked(carId, payload, txClient);
  });
}

/**
 * Transaction-scoped advisory lock keyed on reservation id.
 * @param {object} client
 * @param {number} reservationId
 */
async function acquireDamageReportLock(client, reservationId) {
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [
    ADVISORY_LOCK_NS.DAMAGE_REPORT,
    reservationId,
  ]);
}

async function upsertForReservationLocked(carId, payload, client) {
  const reservationId = Number(payload.reservationId);
  const description = String(payload.description || '');
  {
    const existing = await clientQuery(
      client,
      `
      SELECT id
      FROM car_damage_reports
      WHERE car_id = $1
        AND reservation_id = $2
        AND source = $3
        AND status = 'unresolved'
      ORDER BY id ASC
      LIMIT 1
      `,
      [Number(carId), reservationId, DAMAGE_SOURCES.RETURN_CHECKLIST]
    );
    if (existing.rows[0]) {
      const updated = await clientQuery(
        client,
        `
        UPDATE car_damage_reports
        SET
          description = $2,
          photos = CASE WHEN jsonb_array_length($3::jsonb) > 0 THEN $3::jsonb ELSE photos END,
          repair_cost = COALESCE($4, repair_cost),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          Number(existing.rows[0].id),
          description,
          JSON.stringify(payload.photos || []),
          payload.repairCost ?? null,
        ]
      );
      return mapDamageReport(updated.rows[0]);
    }
  }
  return create(
    carId,
    { ...payload, source: DAMAGE_SOURCES.RETURN_CHECKLIST },
    client
  );
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
  if (!result.rowCount) return null;
  return mapDamageReport({ ...result.rows[0], car_id: carId, description: '', status: 'resolved' });
}

module.exports = {
  DAMAGE_SOURCES,
  listByCarId,
  findById,
  countUnresolved,
  create,
  upsertForReservation,
  resolve,
  remove,
};
