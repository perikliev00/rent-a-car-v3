const { clientQuery } = require('../../db/transaction');

function mapAlertRow(row) {
  if (!row) return null;
  let meta = row.meta;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  return {
    id: String(row.id),
    type: row.alert_type,
    severity: row.severity,
    status: row.status,
    carId: String(row.car_id),
    carName: row.car_name || `Car #${row.car_id}`,
    message: row.message,
    meta: meta && typeof meta === 'object' ? meta : {},
    sourceKind: row.source_kind,
    sourceId: Number(row.source_id),
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function alertKey(alert) {
  return `${alert.carId}:${alert.type}:${alert.sourceKind}:${alert.sourceId}`;
}

async function listActive(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      a.*,
      c.name AS car_name
    FROM car_fleet_alerts a
    INNER JOIN cars c ON c.id = a.car_id
    WHERE a.status = 'active'
      AND c.is_deleted = FALSE
    ORDER BY a.detected_at DESC, a.id DESC
    `
  );
  return result.rows.map(mapAlertRow);
}

/**
 * Insert or refresh an active alert by natural key.
 * Uses ON CONFLICT on the partial unique index.
 */
async function upsertActive(alert, client = null) {
  const metaJson = JSON.stringify(alert.meta || {});
  const result = await clientQuery(
    client,
    `
    INSERT INTO car_fleet_alerts (
      car_id,
      alert_type,
      severity,
      status,
      source_kind,
      source_id,
      message,
      meta,
      detected_at,
      updated_at
    )
    VALUES ($1, $2, $3, 'active', $4, $5, $6, $7::jsonb, COALESCE($8::timestamptz, NOW()), NOW())
    ON CONFLICT (car_id, alert_type, source_kind, source_id)
      WHERE status = 'active'
    DO UPDATE SET
      severity = EXCLUDED.severity,
      message = EXCLUDED.message,
      meta = EXCLUDED.meta,
      updated_at = NOW()
    RETURNING *
    `,
    [
      Number(alert.carId),
      alert.type,
      alert.severity,
      alert.sourceKind,
      Number(alert.sourceId),
      alert.message,
      metaJson,
      alert.detectedAt || null,
    ]
  );
  return mapAlertRow(result.rows[0]);
}

async function resolveByIds(ids, resolvedAt = null, client = null) {
  if (!ids?.length) return 0;
  const result = await clientQuery(
    client,
    `
    UPDATE car_fleet_alerts
    SET
      status = 'resolved',
      resolved_at = COALESCE($2::timestamptz, NOW()),
      updated_at = NOW()
    WHERE id = ANY($1::bigint[])
      AND status = 'active'
    `,
    [ids.map(Number), resolvedAt]
  );
  return result.rowCount || 0;
}

/**
 * Resolve active alerts whose natural keys are not in keepKeys.
 * keepKeys: Set of "carId:type:sourceKind:sourceId"
 */
async function resolveMissing(keepKeys, resolvedAt = null, client = null) {
  const active = await listActive(client);
  const toResolve = active
    .filter((a) => !keepKeys.has(alertKey(a)))
    .map((a) => Number(a.id));
  return resolveByIds(toResolve, resolvedAt, client);
}

module.exports = {
  mapAlertRow,
  alertKey,
  listActive,
  upsertActive,
  resolveByIds,
  resolveMissing,
};
