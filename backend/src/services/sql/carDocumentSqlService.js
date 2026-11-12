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
  // Create the storage key constant.
  const storageKey = row.storage_key || null;
  // Create the legacy url constant.
  const legacyUrl = row.url || null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the car id field value.
    carId: String(row.car_id),
    // Provide the name field value.
    name: row.name,
    // Contribute this line to the enclosing declaration or statement.
    storageKey,
    // Contribute this line to the enclosing declaration or statement.
    legacyUrl,
    // Provide the original filename field value.
    originalFilename: row.original_filename || row.name || 'document',
    // Provide the mime type field value.
    mimeType: row.mime_type || 'application/octet-stream',
    // Provide the size bytes field value.
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    // Provide the has file field value.
    hasFile: Boolean(storageKey || legacyUrl),
    // Provide the uploaded by user id field value.
    uploadedByUserId: row.uploaded_by_user_id != null ? Number(row.uploaded_by_user_id) : null,
    // Provide the created at field value.
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
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: doc.id,
    // Provide the car id field value.
    carId: doc.carId,
    // Provide the name field value.
    name: doc.name,
    // Provide the original filename field value.
    originalFilename: doc.originalFilename,
    // Provide the mime type field value.
    mimeType: doc.mimeType,
    // Provide the size bytes field value.
    sizeBytes: doc.sizeBytes,
    // Provide the has file field value.
    hasFile: doc.hasFile,
    // Provide the uploaded by user id field value.
    uploadedByUserId: doc.uploadedByUserId,
    // Provide the created at field value.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_documents
    WHERE car_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId)]
  );
  // Return the resulting value to the caller.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_documents
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(docId), Number(carId)]
  );
  // Return the resulting value to the caller.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Call Number to perform this step.
      Number(carId),
      // Contribute this line to the enclosing declaration or statement.
      payload.name,
      // Contribute this line to the enclosing declaration or statement.
      payload.storageKey,
      // Contribute this line to the enclosing declaration or statement.
      payload.originalFilename || payload.name || 'document',
      // Contribute this line to the enclosing declaration or statement.
      payload.mimeType || 'application/octet-stream',
      // Contribute this line to the enclosing declaration or statement.
      payload.sizeBytes,
      // Contribute this line to the enclosing declaration or statement.
      payload.uploadedByUserId ?? null,
    ]
  );
  // Return the resulting value to the caller.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_documents
    WHERE id = $1 AND car_id = $2
    RETURNING *
    `,
    // Continue the surrounding logic with this statement.
    [Number(docId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return mapDocument(result.rows[0]);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listByCarId,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  create,
  // Contribute this line to the enclosing declaration or statement.
  remove,
  // Contribute this line to the enclosing declaration or statement.
  toPublicDocument,
};
