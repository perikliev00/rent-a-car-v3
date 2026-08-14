const { clientQuery } = require('../../db/transaction');

function mapServiceRecord(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    carId: String(row.car_id),
    serviceType: row.service_type,
    description: row.description || null,
    cost: row.cost != null ? Number(row.cost) : null,
    mileage: row.mileage != null ? Number(row.mileage) : null,
    serviceDate: row.service_date
      ? String(row.service_date).slice(0, 10)
      : null,
    nextServiceDate: row.next_service_date
      ? String(row.next_service_date).slice(0, 10)
      : null,
    createdByUserId: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listByCarId(carId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_service_records
    WHERE car_id = $1
    ORDER BY service_date DESC, id DESC
    `,
    [Number(carId)]
  );
  return result.rows.map(mapServiceRecord);
}

async function findById(carId, recordId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_service_records
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    [Number(recordId), Number(carId)]
  );
  return mapServiceRecord(result.rows[0]);
}

async function create(carId, payload, client = null) {
  const result = await clientQuery(
    client,
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
      Number(carId),
      payload.serviceType,
      payload.description || null,
      payload.cost ?? null,
      payload.mileage ?? null,
      payload.serviceDate,
      payload.nextServiceDate || null,
      payload.createdByUserId ?? null,
    ]
  );
  return mapServiceRecord(result.rows[0]);
}

async function update(carId, recordId, payload, client = null) {
  const result = await clientQuery(
    client,
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
      Number(recordId),
      Number(carId),
      payload.serviceType,
      payload.description || null,
      payload.cost ?? null,
      payload.mileage ?? null,
      payload.serviceDate,
      payload.nextServiceDate || null,
    ]
  );
  return mapServiceRecord(result.rows[0]);
}

async function remove(carId, recordId, client = null) {
  const result = await clientQuery(
    client,
    `
    DELETE FROM car_service_records
    WHERE id = $1 AND car_id = $2
    RETURNING id
    `,
    [Number(recordId), Number(carId)]
  );
  return result.rowCount > 0;
}

module.exports = {
  listByCarId,
  findById,
  create,
  update,
  remove,
};
