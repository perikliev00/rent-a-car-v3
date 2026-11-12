/**
 * SQL for customer-uploaded identity/documents linked to accounts or bookings.
 */
const { clientQuery, isUniqueViolation } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapDocument).
 * @param {object} row
 * @returns {*}
 */
function mapDocument(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the user id field value.
    userId: String(row.user_id),
    // Provide the reservation id field value.
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    // Provide the doc type field value.
    docType: row.doc_type,
    // Provide the storage key field value.
    storageKey: row.storage_key,
    // Provide the original filename field value.
    originalFilename: row.original_filename,
    // Provide the mime type field value.
    mimeType: row.mime_type,
    // Provide the size bytes field value.
    sizeBytes: Number(row.size_bytes),
    // Provide the created at field value.
    createdAt: row.created_at,
  };
}

/**
 * List by user id from SQL.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listByUserId(userId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM customer_documents
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    // Continue the surrounding logic with this statement.
    [Number(userId)]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapDocument);
}

/**
 * Find by id for user via SQL; returns null when missing.
 * @param {string|number} docId
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByIdForUser(docId, userId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM customer_documents
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(docId), Number(userId)]
  );
  // Return the resulting value to the caller.
  return mapDocument(result.rows[0]);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} docId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(docId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM customer_documents WHERE id = $1 LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(docId)]
  );
  // Return the resulting value to the caller.
  return mapDocument(result.rows[0]);
}

/**
 * Update or upsert row; returns null when not found.
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function upsert(payload, client = null) {
  // Protected block: isolate failure modes.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (payload.docType === 'driver_license' || payload.docType === 'passport_id') {
      // Create the existing constant.
      const existing = await clientQuery(
        // Contribute this line to the enclosing declaration or statement.
        client,
        // Continue the surrounding logic with this statement.
        `
        SELECT id FROM customer_documents
        WHERE user_id = $1 AND doc_type = $2
        LIMIT 1
        `,
        // Continue the surrounding logic with this statement.
        [Number(payload.userId), payload.docType]
      );
      // Evaluate the condition and enter the branch when it is true.
      if (existing.rows[0]) {
        // Create the result constant.
        const result = await clientQuery(
          // Contribute this line to the enclosing declaration or statement.
          client,
          // Continue the surrounding logic with this statement.
          `
          UPDATE customer_documents
          SET
            reservation_id = $3,
            storage_key = $4,
            original_filename = $5,
            mime_type = $6,
            size_bytes = $7,
            created_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING *
          `,
          [
            // Call Number to perform this step.
            Number(existing.rows[0].id),
            // Call Number to perform this step.
            Number(payload.userId),
            // Continue the surrounding logic with this statement.
            payload.reservationId != null ? Number(payload.reservationId) : null,
            // Contribute this line to the enclosing declaration or statement.
            payload.storageKey,
            // Contribute this line to the enclosing declaration or statement.
            payload.originalFilename,
            // Contribute this line to the enclosing declaration or statement.
            payload.mimeType,
            // Contribute this line to the enclosing declaration or statement.
            payload.sizeBytes,
          ]
        );
        // Return the resulting value to the caller.
        return { document: mapDocument(result.rows[0]), replaced: true };
      }
    }

    // Create the result constant.
    const result = await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO customer_documents (
        user_id, reservation_id, doc_type, storage_key,
        original_filename, mime_type, size_bytes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        // Call Number to perform this step.
        Number(payload.userId),
        // Continue the surrounding logic with this statement.
        payload.reservationId != null ? Number(payload.reservationId) : null,
        // Contribute this line to the enclosing declaration or statement.
        payload.docType,
        // Contribute this line to the enclosing declaration or statement.
        payload.storageKey,
        // Contribute this line to the enclosing declaration or statement.
        payload.originalFilename,
        // Contribute this line to the enclosing declaration or statement.
        payload.mimeType,
        // Contribute this line to the enclosing declaration or statement.
        payload.sizeBytes,
      ]
    );
    // Return the resulting value to the caller.
    return { document: mapDocument(result.rows[0]), replaced: false };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (isUniqueViolation(err)) {
      // Create the conflict constant.
      const conflict = new Error('A document of this type already exists.');
      // Update conflict.code with the right-hand side value.
      conflict.code = 'CONFLICT';
      // Update conflict.status with the right-hand side value.
      conflict.status = 409;
      // Throw an error to stop the current control flow.
      throw conflict;
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * Delete row; returns whether a row was affected.
 * @param {string|number} docId
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function remove(docId, userId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM customer_documents
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    // Continue the surrounding logic with this statement.
    [Number(docId), Number(userId)]
  );
  // Return the resulting value to the caller.
  return mapDocument(result.rows[0]);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapDocument,
  // Contribute this line to the enclosing declaration or statement.
  listByUserId,
  // Contribute this line to the enclosing declaration or statement.
  findByIdForUser,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  upsert,
  // Contribute this line to the enclosing declaration or statement.
  remove,
};
