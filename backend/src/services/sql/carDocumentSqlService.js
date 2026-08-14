const { clientQuery } = require('../../db/transaction');

function mapDocument(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    carId: String(row.car_id),
    name: row.name,
    url: row.url,
    uploadedByUserId: row.uploaded_by_user_id != null ? Number(row.uploaded_by_user_id) : null,
    createdAt: row.created_at,
  };
}

async function listByCarId(carId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_documents
    WHERE car_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [Number(carId)]
  );
  return result.rows.map(mapDocument);
}

async function findById(carId, docId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_documents
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    [Number(docId), Number(carId)]
  );
  return mapDocument(result.rows[0]);
}

async function create(carId, payload, client = null) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO car_documents (car_id, name, url, uploaded_by_user_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [
      Number(carId),
      payload.name,
      payload.url,
      payload.uploadedByUserId ?? null,
    ]
  );
  return mapDocument(result.rows[0]);
}

async function remove(carId, docId, client = null) {
  const result = await clientQuery(
    client,
    `
    DELETE FROM car_documents
    WHERE id = $1 AND car_id = $2
    RETURNING *
    `,
    [Number(docId), Number(carId)]
  );
  return mapDocument(result.rows[0]);
}

module.exports = {
  listByCarId,
  findById,
  create,
  remove,
};
