/**
 * Write-side fleet alert store: upsert active alerts and resolve stale ones.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapAlertRow).
 * @param {object} row
 * @returns {*}
 */
function mapAlertRow(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Initialize the mutable meta variable.
  let meta = row.meta;
  // Evaluate the condition and enter the branch when it is true.
  if (typeof meta === 'string') {
    // Protected block: isolate failure modes.
    try {
      // Update meta with the right-hand side value.
      meta = JSON.parse(meta);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Update meta with the right-hand side value.
      meta = {};
    }
  }
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the type field value.
    type: row.alert_type,
    // Provide the severity field value.
    severity: row.severity,
    // Provide the status field value.
    status: row.status,
    // Provide the car id field value.
    carId: String(row.car_id),
    // Provide the car name field value.
    carName: row.car_name || `Car #${row.car_id}`,
    // Provide the message field value.
    message: row.message,
    // Provide the meta field value.
    meta: meta && typeof meta === 'object' ? meta : {},
    // Provide the source kind field value.
    sourceKind: row.source_kind,
    // Provide the source id field value.
    sourceId: Number(row.source_id),
    // Provide the detected at field value.
    detectedAt: row.detected_at,
    // Provide the resolved at field value.
    resolvedAt: row.resolved_at || null,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/** Natural key used to match desired vs stored active alerts during reconcile. */
function alertKey(alert) {
  // Return the resulting value to the caller.
  return `${alert.carId}:${alert.type}:${alert.sourceKind}:${alert.sourceId}`;
}

/** Active alerts for non-deleted cars. */
async function listActive(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
  // Return the resulting value to the caller.
  return result.rows.map(mapAlertRow);
}

/**
 * Insert or refresh an active alert by natural key.
 * Uses ON CONFLICT on the partial unique index.
 */
async function upsertActive(alert, client = null) {
  // Create the meta json constant.
  const metaJson = JSON.stringify(alert.meta || {});
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Call Number to perform this step.
      Number(alert.carId),
      // Contribute this line to the enclosing declaration or statement.
      alert.type,
      // Contribute this line to the enclosing declaration or statement.
      alert.severity,
      // Contribute this line to the enclosing declaration or statement.
      alert.sourceKind,
      // Call Number to perform this step.
      Number(alert.sourceId),
      // Contribute this line to the enclosing declaration or statement.
      alert.message,
      // Contribute this line to the enclosing declaration or statement.
      metaJson,
      // Contribute this line to the enclosing declaration or statement.
      alert.detectedAt || null,
    ]
  );
  // Return the resulting value to the caller.
  return mapAlertRow(result.rows[0]);
}

/** Mark specific active alert ids as resolved. */
async function resolveByIds(ids, resolvedAt = null, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ids?.length) return 0;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE car_fleet_alerts
    SET
      status = 'resolved',
      resolved_at = COALESCE($2::timestamptz, NOW()),
      updated_at = NOW()
    WHERE id = ANY($1::bigint[])
      AND status = 'active'
    `,
    // Continue the surrounding logic with this statement.
    [ids.map(Number), resolvedAt]
  );
  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

/**
 * Resolve active alerts whose natural keys are not in keepKeys.
 * keepKeys: Set of "carId:type:sourceKind:sourceId"
 */
async function resolveMissing(keepKeys, resolvedAt = null, client = null) {
  // Create the active constant.
  const active = await listActive(client);
  // Create the to resolve constant.
  const toResolve = active
    // Call .filter to perform this step.
    .filter((a) => !keepKeys.has(alertKey(a)))
    // Call .map to perform this step.
    .map((a) => Number(a.id));
  // Return the resulting value to the caller.
  return resolveByIds(toResolve, resolvedAt, client);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapAlertRow,
  // Contribute this line to the enclosing declaration or statement.
  alertKey,
  // Contribute this line to the enclosing declaration or statement.
  listActive,
  // Contribute this line to the enclosing declaration or statement.
  upsertActive,
  // Contribute this line to the enclosing declaration or statement.
  resolveByIds,
  // Contribute this line to the enclosing declaration or statement.
  resolveMissing,
};
