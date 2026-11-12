/**
 * Read-side SQL listing active fleet alerts for the admin dashboard.
 */
const { clientQuery } = require('../../db/transaction');
// Require the './carFleetAlertStoreSqlService' module as storeSql.
const storeSql = require('./carFleetAlertStoreSqlService');

// Create the severity order constant.
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

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
 * Build ephemeral alerts from a car row (fleet status + service overdue only).
 * Insurance / vignette / GTP / damage come from persisted car_fleet_alerts.
 */
function buildAlertsForCar(row, todayStr) {
  // Create the car id constant.
  const carId = String(row.id);
  // Create the car name constant.
  const carName = row.name || `Car #${carId}`;
  // Create the alerts constant.
  const alerts = [];
  // Create the status constant.
  const status = row.status || 'available';
  // Create the next service constant.
  const nextService = toDateOnly(row.next_service_date);

  // Status / lifecycle guard before mutating domain state.
  if (status === 'damaged') {
    // Call alerts.push to perform this step.
    alerts.push({
      // Provide the id field value.
      id: `status_damaged:${carId}`,
      // Provide the type field value.
      type: 'status_damaged',
      // Provide the severity field value.
      severity: 'critical',
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      carName,
      // Provide the message field value.
      message: 'Car status is damaged',
      // Provide the meta field value.
      meta: { status },
    });
  // Continue the surrounding logic with this statement.
  } else if (status === 'needs_cleaning') {
    // Call alerts.push to perform this step.
    alerts.push({
      // Provide the id field value.
      id: `status_needs_cleaning:${carId}`,
      // Provide the type field value.
      type: 'status_needs_cleaning',
      // Provide the severity field value.
      severity: 'warning',
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      carName,
      // Provide the message field value.
      message: 'Car needs cleaning',
      // Provide the meta field value.
      meta: { status },
    });
  // Continue the surrounding logic with this statement.
  } else if (status === 'needs_inspection') {
    // Call alerts.push to perform this step.
    alerts.push({
      // Provide the id field value.
      id: `status_needs_inspection:${carId}`,
      // Provide the type field value.
      type: 'status_needs_inspection',
      // Provide the severity field value.
      severity: 'warning',
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      carName,
      // Provide the message field value.
      message: 'Car needs inspection',
      // Provide the meta field value.
      meta: { status },
    });
  // Continue the surrounding logic with this statement.
  } else if (status === 'in_maintenance') {
    // Call alerts.push to perform this step.
    alerts.push({
      // Provide the id field value.
      id: `status_in_maintenance:${carId}`,
      // Provide the type field value.
      type: 'status_in_maintenance',
      // Provide the severity field value.
      severity: 'warning',
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      carName,
      // Provide the message field value.
      message: 'Car is in maintenance',
      // Provide the meta field value.
      meta: { status },
    });
  }

  // Evaluate the condition and enter the branch when it is true.
  if (nextService && nextService < todayStr) {
    // Call alerts.push to perform this step.
    alerts.push({
      // Provide the id field value.
      id: `service_overdue:${carId}`,
      // Provide the type field value.
      type: 'service_overdue',
      // Provide the severity field value.
      severity: 'warning',
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      carName,
      // Provide the message field value.
      message: `Next service was due on ${nextService}`,
      // Provide the meta field value.
      meta: { date: nextService },
    });
  }

  // Return the resulting value to the caller.
  return alerts;
}

/**
 * summarize alerts.
 * @param {*} alerts
 * @returns {*}
 */
function summarizeAlerts(alerts) {
  // Create the summary constant.
  const summary = { total: alerts.length, critical: 0, warning: 0, info: 0 };
  // Iterate using the loop initializer, condition, and step.
  for (const alert of alerts) {
    // Evaluate the condition and enter the branch when it is true.
    if (alert.severity === 'critical') summary.critical += 1;
    // Handle this alternate condition when prior checks failed.
    else if (alert.severity === 'warning') summary.warning += 1;
    // Handle this alternate condition when prior checks failed.
    else if (alert.severity === 'info') summary.info += 1;
  }
  // Return the resulting value to the caller.
  return summary;
}

/**
 * sort alerts.
 * @param {*} alerts
 * @returns {*}
 */
function sortAlerts(alerts) {
  // Return the resulting value to the caller.
  return [...alerts].sort((a, b) => {
    // Create the sev constant.
    const sev = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    // Evaluate the condition and enter the branch when it is true.
    if (sev !== 0) return sev;
    // Return the resulting value to the caller.
    return String(a.carName).localeCompare(String(b.carName));
  });
}

/**
 * Load fleet alert rows.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchFleetAlertRows(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      c.id,
      c.name,
      c.status,
      (
        SELECT s.next_service_date
        FROM car_service_records s
        WHERE s.car_id = c.id
          AND s.next_service_date IS NOT NULL
        ORDER BY s.next_service_date DESC, s.id DESC
        LIMIT 1
      ) AS next_service_date,
      CURRENT_DATE::text AS today
    FROM cars c
    WHERE c.is_deleted = FALSE
    ORDER BY c.name ASC
    `
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/**
 * Map a DB/API row into the domain shape used by callers (mapPersistedForApi).
 * @param {*} alert
 * @returns {*}
 */
function mapPersistedForApi(alert) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: `persisted:${alert.id}`,
    // Provide the type field value.
    type: alert.type,
    // Provide the severity field value.
    severity: alert.severity,
    // Provide the car id field value.
    carId: alert.carId,
    // Provide the car name field value.
    carName: alert.carName,
    // Provide the message field value.
    message: alert.message,
    // Provide the meta field value.
    meta: alert.meta || {},
  };
}

/**
 * List fleet alerts from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listFleetAlerts(client = null) {
  // Create the rows constant.
  const rows = await fetchFleetAlertRows(client);
  // Create the today str constant.
  const todayStr =
    // Contribute this line to the enclosing declaration or statement.
    rows[0]?.today ||
    // Continue the surrounding logic with this statement.
    new Date().toISOString().slice(0, 10);

  // Create the alerts constant.
  const alerts = [];
  // Iterate using the loop initializer, condition, and step.
  for (const row of rows) {
    // Call alerts.push to perform this step.
    alerts.push(...buildAlertsForCar(row, todayStr));
  }

  // Protected block: isolate failure modes.
  try {
    // Create the persisted constant.
    const persisted = await storeSql.listActive(client);
    // Iterate using the loop initializer, condition, and step.
    for (const alert of persisted) {
      // Call alerts.push to perform this step.
      alerts.push(mapPersistedForApi(alert));
    }
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Table may not exist yet during partial deploys
    if (err?.code !== '42P01') {
      // Throw an error to stop the current control flow.
      throw err;
    }
  }

  // Create the sorted constant.
  const sorted = sortAlerts(alerts);
  // Return the resulting value to the caller.
  return {
    // Provide the summary field value.
    summary: summarizeAlerts(sorted),
    // Provide the alerts field value.
    alerts: sorted,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildAlertsForCar,
  // Contribute this line to the enclosing declaration or statement.
  summarizeAlerts,
  // Contribute this line to the enclosing declaration or statement.
  sortAlerts,
  // Contribute this line to the enclosing declaration or statement.
  listFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  fetchFleetAlertRows,
  // Contribute this line to the enclosing declaration or statement.
  mapPersistedForApi,
};
