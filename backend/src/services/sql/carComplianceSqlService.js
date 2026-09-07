const { clientQuery } = require('../../db/transaction');
const { COMPLIANCE_TYPE_LABELS } = require('../../constants/carEnums');

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

function deriveComplianceStatus({ expiresAt, statusHint = null, todayStr = null }) {
  if (statusHint === 'missing') return 'missing';
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const expires = toDateOnly(expiresAt);
  if (expires && expires < today) return 'expired';
  if (statusHint === 'expired' && !expires) return 'expired';
  return 'valid';
}

function mapComplianceItem(row) {
  if (!row) return null;
  const itemType = row.item_type;
  const documentStorageKey = row.document_storage_key || null;
  const documentUrl = row.document_url || null;
  return {
    id: Number(row.id),
    carId: String(row.car_id),
    itemType,
    label: row.title || COMPLIANCE_TYPE_LABELS[itemType] || itemType,
    title: row.title || null,
    referenceNumber: row.reference_number || null,
    issuedAt: toDateOnly(row.issued_at),
    expiresAt: toDateOnly(row.expires_at),
    notes: row.notes || null,
    documentStorageKey,
    documentUrl,
    hasDocument: Boolean(documentStorageKey || documentUrl),
    status: row.status,
    createdByUserId: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicComplianceItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    carId: item.carId,
    itemType: item.itemType,
    label: item.label,
    title: item.title,
    referenceNumber: item.referenceNumber,
    issuedAt: item.issuedAt,
    expiresAt: item.expiresAt,
    notes: item.notes,
    hasDocument: item.hasDocument,
    status: item.status,
    createdByUserId: item.createdByUserId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function listByCarId(carId, client = null) {
  const result = await clientQuery(
    client,
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
    [Number(carId)]
  );
  return result.rows.map(mapComplianceItem);
}

async function findById(carId, itemId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_compliance_items
    WHERE id = $1 AND car_id = $2
    LIMIT 1
    `,
    [Number(itemId), Number(carId)]
  );
  return mapComplianceItem(result.rows[0]);
}

async function findLatestByType(carId, itemType, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM car_compliance_items
    WHERE car_id = $1 AND item_type = $2
    ORDER BY expires_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    [Number(carId), itemType]
  );
  return mapComplianceItem(result.rows[0]);
}

async function create(carId, payload, client = null) {
  const status = deriveComplianceStatus({
    expiresAt: payload.expiresAt,
    statusHint: payload.status,
  });

  const result = await clientQuery(
    client,
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
      Number(carId),
      payload.itemType,
      payload.title || null,
      payload.referenceNumber || null,
      payload.issuedAt || null,
      payload.expiresAt || null,
      payload.notes || null,
      payload.documentUrl || null,
      payload.documentStorageKey || null,
      status,
      payload.createdByUserId ?? null,
    ]
  );
  return mapComplianceItem(result.rows[0]);
}

async function update(carId, itemId, payload, client = null) {
  const status = deriveComplianceStatus({
    expiresAt: payload.expiresAt,
    statusHint: payload.status,
  });

  const result = await clientQuery(
    client,
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
      Number(itemId),
      Number(carId),
      payload.itemType,
      payload.title || null,
      payload.referenceNumber || null,
      payload.issuedAt || null,
      payload.expiresAt || null,
      payload.notes || null,
      payload.documentUrl || null,
      payload.documentStorageKey || null,
      status,
    ]
  );
  return mapComplianceItem(result.rows[0]);
}

async function upsertByType(carId, itemType, payload, client = null) {
  const existing = await findLatestByType(carId, itemType, client);
  if (existing) {
    return update(
      carId,
      existing.id,
      {
        itemType,
        title: payload.title !== undefined ? payload.title : existing.title,
        referenceNumber:
          payload.referenceNumber !== undefined
            ? payload.referenceNumber
            : existing.referenceNumber,
        issuedAt: payload.issuedAt !== undefined ? payload.issuedAt : existing.issuedAt,
        expiresAt: payload.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
        notes: payload.notes !== undefined ? payload.notes : existing.notes,
        documentUrl: payload.documentUrl,
        documentStorageKey: payload.documentStorageKey,
        status: payload.status,
      },
      client
    );
  }
  return create(
    carId,
    {
      itemType,
      title: payload.title || null,
      referenceNumber: payload.referenceNumber || null,
      issuedAt: payload.issuedAt || null,
      expiresAt: payload.expiresAt || null,
      notes: payload.notes || null,
      documentUrl: payload.documentUrl || null,
      documentStorageKey: payload.documentStorageKey || null,
      status: payload.status,
      createdByUserId: payload.createdByUserId ?? null,
    },
    client
  );
}

async function remove(carId, itemId, client = null) {
  const result = await clientQuery(
    client,
    `
    DELETE FROM car_compliance_items
    WHERE id = $1 AND car_id = $2
    RETURNING *
    `,
    [Number(itemId), Number(carId)]
  );
  return mapComplianceItem(result.rows[0]);
}

async function syncCarExpiryCache(carId, client = null) {
  const insurance = await findLatestByType(carId, 'civil_insurance', client);
  const inspection = await findLatestByType(carId, 'technical_inspection', client);

  await clientQuery(
    client,
    `
    UPDATE cars
    SET
      insurance_expiry = $2,
      technical_inspection_expiry = $3,
      updated_at = NOW()
    WHERE id = $1
    `,
    [Number(carId), insurance?.expiresAt || null, inspection?.expiresAt || null]
  );
}

async function listOpenComplianceForAlerts(client = null) {
  const result = await clientQuery(
    client,
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
  return result.rows;
}

module.exports = {
  deriveComplianceStatus,
  mapComplianceItem,
  toPublicComplianceItem,
  listByCarId,
  findById,
  findLatestByType,
  create,
  update,
  upsertByType,
  remove,
  syncCarExpiryCache,
  listOpenComplianceForAlerts,
  COMPLIANCE_TYPE_LABELS,
};
