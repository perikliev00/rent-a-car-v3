/**
 * SQL for car_compliance_items and denormalized car expiry cache sync.
 */
const { clientQuery } = require('../../db/transaction');
// Destructure object properties into local variables.
const { COMPLIANCE_TYPE_LABELS } = require('../../constants/carEnums');

/**
 * Transform helper: to date only.
 * @param {*} value
 * @returns {*}
 */
function toDateOnly(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!value) return null;
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Create the str constant.
  const str = String(value);
  // Return the resulting value to the caller.
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/**
 * derive compliance status.
 * @param {object} params
 * @returns {*}
 */
function deriveComplianceStatus({ expiresAt, statusHint = null, todayStr = null }) {
  // Status / lifecycle guard before mutating domain state.
  if (statusHint === 'missing') return 'missing';
  // Create the today constant.
  const today = todayStr || new Date().toISOString().slice(0, 10);
  // Create the expires constant.
  const expires = toDateOnly(expiresAt);
  // Hold-expiry / timing branch.
  if (expires && expires < today) return 'expired';
  // Status / lifecycle guard before mutating domain state.
  if (statusHint === 'expired' && !expires) return 'expired';
  // Return the resulting value to the caller.
  return 'valid';
}

/**
 * Map a DB/API row into the domain shape used by callers (mapComplianceItem).
 * @param {object} row
 * @returns {*}
 */
function mapComplianceItem(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Create the item type constant.
  const itemType = row.item_type;
  // Create the document storage key constant.
  const documentStorageKey = row.document_storage_key || null;
  // Create the document url constant.
  const documentUrl = row.document_url || null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the car id field value.
    carId: String(row.car_id),
    // Contribute this line to the enclosing declaration or statement.
    itemType,
    // Provide the label field value.
    label: row.title || COMPLIANCE_TYPE_LABELS[itemType] || itemType,
    // Provide the title field value.
    title: row.title || null,
    // Provide the reference number field value.
    referenceNumber: row.reference_number || null,
    // Provide the issued at field value.
    issuedAt: toDateOnly(row.issued_at),
    // Provide the expires at field value.
    expiresAt: toDateOnly(row.expires_at),
    // Provide the notes field value.
    notes: row.notes || null,
    // Contribute this line to the enclosing declaration or statement.
    documentStorageKey,
    // Contribute this line to the enclosing declaration or statement.
    documentUrl,
    // Provide the has document field value.
    hasDocument: Boolean(documentStorageKey || documentUrl),
    // Provide the status field value.
    status: row.status,
    // Provide the created by user id field value.
    createdByUserId: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/**
 * Transform helper: to public compliance item.
 * @param {*} item
 * @returns {*}
 */
function toPublicComplianceItem(item) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!item) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: item.id,
    // Provide the car id field value.
    carId: item.carId,
    // Provide the item type field value.
    itemType: item.itemType,
    // Provide the label field value.
    label: item.label,
    // Provide the title field value.
    title: item.title,
    // Provide the reference number field value.
    referenceNumber: item.referenceNumber,
    // Provide the issued at field value.
    issuedAt: item.issuedAt,
    // Provide the expires at field value.
    expiresAt: item.expiresAt,
    // Provide the notes field value.
    notes: item.notes,
    // Provide the has document field value.
    hasDocument: item.hasDocument,
    // Provide the status field value.
    status: item.status,
    // Provide the created by user id field value.
    createdByUserId: item.createdByUserId,
    // Provide the created at field value.
    createdAt: item.createdAt,
    // Provide the updated at field value.
    updatedAt: item.updatedAt,
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
    FROM car_compliance_items
    WHERE car_id = $1
    ORDER BY
      CASE status
        WHEN 'expired' THEN 0
        WHEN 'missing' THEN 1
        ELSE 2
      END,
      expires_at ASC NULLS LAST,
      id DESC
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId)]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapComplianceItem);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {string|number} itemId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(carId, itemId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_compliance_items
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(itemId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return mapComplianceItem(result.rows[0]);
}

/**
 * Find latest by type via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {*} itemType
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findLatestByType(carId, itemType, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM car_compliance_items
    WHERE car_id = $1 AND item_type = $2
    ORDER BY expires_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId), itemType]
  );
  // Return the resulting value to the caller.
  return mapComplianceItem(result.rows[0]);
}

/**
 * Insert a new row and return the mapped result.
 * @param {string|number} carId
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function create(carId, payload, client = null) {
  // Create the status constant.
  const status = deriveComplianceStatus({
    // Provide the expires at field value.
    expiresAt: payload.expiresAt,
    // Provide the status hint field value.
    statusHint: payload.status,
  });

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO car_compliance_items (
      car_id,
      item_type,
      title,
      reference_number,
      issued_at,
      expires_at,
      notes,
      document_url,
      document_storage_key,
      status,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(carId),
      // Contribute this line to the enclosing declaration or statement.
      payload.itemType,
      // Contribute this line to the enclosing declaration or statement.
      payload.title || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.referenceNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.issuedAt || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.expiresAt || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.notes || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.documentUrl || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.documentStorageKey || null,
      // Contribute this line to the enclosing declaration or statement.
      status,
      // Contribute this line to the enclosing declaration or statement.
      payload.createdByUserId ?? null,
    ]
  );
  // Return the resulting value to the caller.
  return mapComplianceItem(result.rows[0]);
}

/**
 * Update or upsert row; returns null when not found.
 * @param {string|number} carId
 * @param {string|number} itemId
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function update(carId, itemId, payload, client = null) {
  // Create the status constant.
  const status = deriveComplianceStatus({
    // Provide the expires at field value.
    expiresAt: payload.expiresAt,
    // Provide the status hint field value.
    statusHint: payload.status,
  });

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE car_compliance_items
    SET
      item_type = $3,
      title = $4,
      reference_number = $5,
      issued_at = $6,
      expires_at = $7,
      notes = $8,
      document_url = CASE
        WHEN $10::text IS NOT NULL THEN NULL
        ELSE COALESCE($9, document_url)
      END,
      document_storage_key = COALESCE($10, document_storage_key),
      status = $11,
      updated_at = NOW()
    WHERE id = $1 AND car_id = $2
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(itemId),
      // Call Number to perform this step.
      Number(carId),
      // Contribute this line to the enclosing declaration or statement.
      payload.itemType,
      // Contribute this line to the enclosing declaration or statement.
      payload.title || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.referenceNumber || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.issuedAt || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.expiresAt || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.notes || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.documentUrl || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.documentStorageKey || null,
      // Contribute this line to the enclosing declaration or statement.
      status,
    ]
  );
  // Return the resulting value to the caller.
  return mapComplianceItem(result.rows[0]);
}

/**
 * Update or upsert by type; returns null when not found.
 * @param {string|number} carId
 * @param {*} itemType
 * @param {*} payload
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function upsertByType(carId, itemType, payload, client = null) {
  // Create the existing constant.
  const existing = await findLatestByType(carId, itemType, client);
  // Idempotency guard: return early when work was already applied.
  if (existing) {
    // Return the resulting value to the caller.
    return update(
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      existing.id,
      {
        // Contribute this line to the enclosing declaration or statement.
        itemType,
        // Provide the title field value.
        title: payload.title !== undefined ? payload.title : existing.title,
        // Provide the reference number field value.
        referenceNumber:
          // Continue the surrounding logic with this statement.
          payload.referenceNumber !== undefined
            // Contribute this line to the enclosing declaration or statement.
            ? payload.referenceNumber
            // Contribute this line to the enclosing declaration or statement.
            : existing.referenceNumber,
        // Provide the issued at field value.
        issuedAt: payload.issuedAt !== undefined ? payload.issuedAt : existing.issuedAt,
        // Provide the expires at field value.
        expiresAt: payload.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
        // Provide the notes field value.
        notes: payload.notes !== undefined ? payload.notes : existing.notes,
        // Provide the document url field value.
        documentUrl: payload.documentUrl,
        // Provide the document storage key field value.
        documentStorageKey: payload.documentStorageKey,
        // Provide the status field value.
        status: payload.status,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  }
  // Return the resulting value to the caller.
  return create(
    // Contribute this line to the enclosing declaration or statement.
    carId,
    {
      // Contribute this line to the enclosing declaration or statement.
      itemType,
      // Provide the title field value.
      title: payload.title || null,
      // Provide the reference number field value.
      referenceNumber: payload.referenceNumber || null,
      // Provide the issued at field value.
      issuedAt: payload.issuedAt || null,
      // Provide the expires at field value.
      expiresAt: payload.expiresAt || null,
      // Provide the notes field value.
      notes: payload.notes || null,
      // Provide the document url field value.
      documentUrl: payload.documentUrl || null,
      // Provide the document storage key field value.
      documentStorageKey: payload.documentStorageKey || null,
      // Provide the status field value.
      status: payload.status,
      // Provide the created by user id field value.
      createdByUserId: payload.createdByUserId ?? null,
    },
    // Reference the identifier used by the enclosing expression.
    client
  );
}

/**
 * Delete row; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} itemId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function remove(carId, itemId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_compliance_items
    WHERE id = $1 AND car_id = $2
    RETURNING *
    `,
    // Continue the surrounding logic with this statement.
    [Number(itemId), Number(carId)]
  );
  // Return the resulting value to the caller.
  return mapComplianceItem(result.rows[0]);
}

/**
 * sync car expiry cache.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function syncCarExpiryCache(carId, client = null) {
  // Create the insurance constant.
  const insurance = await findLatestByType(carId, 'civil_insurance', client);
  // Create the inspection constant.
  const inspection = await findLatestByType(carId, 'technical_inspection', client);

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE cars
    SET
      insurance_expiry = $2,
      technical_inspection_expiry = $3,
      updated_at = NOW()
    WHERE id = $1
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId), insurance?.expiresAt || null, inspection?.expiresAt || null]
  );
}

/**
 * List open compliance for alerts from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listOpenComplianceForAlerts(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      i.id,
      i.car_id,
      c.name AS car_name,
      i.item_type,
      i.title,
      i.expires_at,
      i.status,
      CURRENT_DATE::text AS today
    FROM car_compliance_items i
    INNER JOIN cars c ON c.id = i.car_id
    WHERE c.is_deleted = FALSE
      AND (
        i.status = 'missing'
        OR i.status = 'expired'
        OR (i.expires_at IS NOT NULL AND i.expires_at < CURRENT_DATE)
        OR (i.expires_at IS NOT NULL AND i.expires_at <= CURRENT_DATE + INTERVAL '30 days')
      )
    ORDER BY c.name ASC, i.expires_at ASC NULLS LAST
    `
  );
  // Return the resulting value to the caller.
  return result.rows;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  deriveComplianceStatus,
  // Contribute this line to the enclosing declaration or statement.
  mapComplianceItem,
  // Contribute this line to the enclosing declaration or statement.
  toPublicComplianceItem,
  // Contribute this line to the enclosing declaration or statement.
  listByCarId,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  findLatestByType,
  // Contribute this line to the enclosing declaration or statement.
  create,
  // Contribute this line to the enclosing declaration or statement.
  update,
  // Contribute this line to the enclosing declaration or statement.
  upsertByType,
  // Contribute this line to the enclosing declaration or statement.
  remove,
  // Contribute this line to the enclosing declaration or statement.
  syncCarExpiryCache,
  // Contribute this line to the enclosing declaration or statement.
  listOpenComplianceForAlerts,
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_TYPE_LABELS,
};
