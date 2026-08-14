const { clientQuery } = require('../../db/transaction');

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null,
  };
}

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
  listByCarId,
  findById,
  countUnresolved,
  create,
  resolve,
  remove,
};
