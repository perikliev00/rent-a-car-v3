const { clientQuery } = require('../../db/transaction');
const storeSql = require('./carFleetAlertStoreSqlService');

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/**
 * Build ephemeral alerts from a car row (fleet status + service overdue only).
 * Insurance / vignette / GTP / damage come from persisted car_fleet_alerts.
 */
function buildAlertsForCar(row, todayStr) {
  const carId = String(row.id);
  const carName = row.name || `Car #${carId}`;
  const alerts = [];
  const status = row.status || 'available';
  const nextService = toDateOnly(row.next_service_date);

  if (status === 'damaged') {
    alerts.push({
      id: `status_damaged:${carId}`,
      type: 'status_damaged',
      severity: 'critical',
      carId,
      carName,
      message: 'Car status is damaged',
      meta: { status },
    });
  } else if (status === 'needs_cleaning') {
    alerts.push({
      id: `status_needs_cleaning:${carId}`,
      type: 'status_needs_cleaning',
      severity: 'warning',
      carId,
      carName,
      message: 'Car needs cleaning',
      meta: { status },
    });
  } else if (status === 'needs_inspection') {
    alerts.push({
      id: `status_needs_inspection:${carId}`,
      type: 'status_needs_inspection',
      severity: 'warning',
      carId,
      carName,
      message: 'Car needs inspection',
      meta: { status },
    });
  } else if (status === 'in_maintenance') {
    alerts.push({
      id: `status_in_maintenance:${carId}`,
      type: 'status_in_maintenance',
      severity: 'warning',
      carId,
      carName,
      message: 'Car is in maintenance',
      meta: { status },
    });
  }

  if (nextService && nextService < todayStr) {
    alerts.push({
      id: `service_overdue:${carId}`,
      type: 'service_overdue',
      severity: 'warning',
      carId,
      carName,
      message: `Next service was due on ${nextService}`,
      meta: { date: nextService },
    });
  }

  return alerts;
}

function summarizeAlerts(alerts) {
  const summary = { total: alerts.length, critical: 0, warning: 0, info: 0 };
  for (const alert of alerts) {
    if (alert.severity === 'critical') summary.critical += 1;
    else if (alert.severity === 'warning') summary.warning += 1;
    else if (alert.severity === 'info') summary.info += 1;
  }
  return summary;
}

function sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const sev = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    if (sev !== 0) return sev;
    return String(a.carName).localeCompare(String(b.carName));
  });
}

async function fetchFleetAlertRows(client = null) {
  const result = await clientQuery(
    client,
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
  return result.rows;
}

function mapPersistedForApi(alert) {
  return {
    id: `persisted:${alert.id}`,
    type: alert.type,
    severity: alert.severity,
    carId: alert.carId,
    carName: alert.carName,
    message: alert.message,
    meta: alert.meta || {},
  };
}

async function listFleetAlerts(client = null) {
  const rows = await fetchFleetAlertRows(client);
  const todayStr =
    rows[0]?.today ||
    new Date().toISOString().slice(0, 10);

  const alerts = [];
  for (const row of rows) {
    alerts.push(...buildAlertsForCar(row, todayStr));
  }

  try {
    const persisted = await storeSql.listActive(client);
    for (const alert of persisted) {
      alerts.push(mapPersistedForApi(alert));
    }
  } catch (err) {
    // Table may not exist yet during partial deploys
    if (err?.code !== '42P01') {
      throw err;
    }
  }

  const sorted = sortAlerts(alerts);
  return {
    summary: summarizeAlerts(sorted),
    alerts: sorted,
  };
}

module.exports = {
  buildAlertsForCar,
  summarizeAlerts,
  sortAlerts,
  listFleetAlerts,
  fetchFleetAlertRows,
  mapPersistedForApi,
};
