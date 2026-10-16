/**
 * SQL for car private documents (metadata + public DTO mapping).
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapDocument).
 * @param {object} row
 * @returns {*}
 */
function mapDocument(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  const storageKey = row.storage_key || null;
  const legacyUrl = row.url || null;
  return {
    id: Number(row.id),
    carId: String(row.car_id),
    name: row.name,
    storageKey,
    legacyUrl,
    originalFilename: row.original_filename || row.name || 'document',
    mimeType: row.mime_type || 'application/octet-stream',
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    hasFile: Boolean(storageKey || legacyUrl),
    uploadedByUserId: row.uploaded_by_user_id != null ? Number(row.uploaded_by_user_id) : null,
    createdAt: row.created_at,
  };
}

/**
 * Transform helper: to public document.
 * @param {*} doc
 * @returns {*}
 */
function toPublicDocument(doc) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) return null;
  return {
    id: doc.id,
    carId: doc.carId,
    name: doc.name,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    hasFile: doc.hasFile,
    uploadedByUserId: doc.uploadedByUserId,
    createdAt: doc.createdAt,
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
    FROM car_documents
    WHERE car_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [Number(carId)]
  );
  return result.rows.map(mapDocument);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {string|number} docId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
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
    INSERT INTO car_documents (
      car_id,
      name,
      url,
      storage_key,
      original_filename,
      mime_type,
      size_bytes,
      uploaded_by_user_id
    )
    VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      Number(carId),
      payload.name,
      payload.storageKey,
      payload.originalFilename || payload.name || 'document',
      payload.mimeType || 'application/octet-stream',
      payload.sizeBytes,
      payload.uploadedByUserId ?? null,
    ]
  );
  return mapDocument(result.rows[0]);
}

/**
 * Delete row; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} docId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
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
  toPublicDocument,
};
