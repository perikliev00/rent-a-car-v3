const { clientQuery, isUniqueViolation } = require('../../db/transaction');

function mapDocument(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    docType: row.doc_type,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
  };
}

async function listByUserId(userId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM customer_documents
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [Number(userId)]
  );
  return result.rows.map(mapDocument);
}

async function findByIdForUser(docId, userId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM customer_documents
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [Number(docId), Number(userId)]
  );
  return mapDocument(result.rows[0]);
}

async function findById(docId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM customer_documents WHERE id = $1 LIMIT 1
    `,
    [Number(docId)]
  );
  return mapDocument(result.rows[0]);
}

async function upsert(payload, client = null) {
  try {
    if (payload.docType === 'driver_license' || payload.docType === 'passport_id') {
      const existing = await clientQuery(
        client,
        `
        SELECT id FROM customer_documents
        WHERE user_id = $1 AND doc_type = $2
        LIMIT 1
        `,
        [Number(payload.userId), payload.docType]
      );
      if (existing.rows[0]) {
        const result = await clientQuery(
          client,
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
            Number(existing.rows[0].id),
            Number(payload.userId),
            payload.reservationId != null ? Number(payload.reservationId) : null,
            payload.storageKey,
            payload.originalFilename,
            payload.mimeType,
            payload.sizeBytes,
          ]
        );
        return { document: mapDocument(result.rows[0]), replaced: true };
      }
    }

    const result = await clientQuery(
      client,
      `
      INSERT INTO customer_documents (
        user_id, reservation_id, doc_type, storage_key,
        original_filename, mime_type, size_bytes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        Number(payload.userId),
        payload.reservationId != null ? Number(payload.reservationId) : null,
        payload.docType,
        payload.storageKey,
        payload.originalFilename,
        payload.mimeType,
        payload.sizeBytes,
      ]
    );
    return { document: mapDocument(result.rows[0]), replaced: false };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const conflict = new Error('A document of this type already exists.');
      conflict.code = 'CONFLICT';
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function remove(docId, userId, client = null) {
  const result = await clientQuery(
    client,
    `
    DELETE FROM customer_documents
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [Number(docId), Number(userId)]
  );
  return mapDocument(result.rows[0]);
}

module.exports = {
  mapDocument,
  listByUserId,
  findByIdForUser,
  findById,
  upsert,
  remove,
};
