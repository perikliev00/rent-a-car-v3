/**
 * Per-car performance SQL: revenue, booked days, maintenance, repair/service costs.
 *
 * Combines order revenue (by order create day) with rental overlap days and
 * maintenance blocks so utilization and profitability can be derived in the service.
 */

const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  REVENUE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  OCCUPANCY_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  overlapDaysSql,
// Continue the surrounding logic with this statement.
} = require('../analytics.domain');

/**
 * Performance metrics for one car; returns null if car missing/deleted.
 * @param {{ carId: number, from: string, to: string }} args
 * @param {import('pg').PoolClient|null} [client]
 */
async function getCarPerformance({ carId, from, to }, client = null) {
  // Overlap params: $2=from, $3=to (carId is $1).
  const overlap = overlapDaysSql('r.pickup_date', 'r.return_date', 2, 3);

  // Step 1: resolve car identity; null means missing/deleted.
  const carResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, name, registration_number
    FROM cars
    WHERE id = $1 AND is_deleted = FALSE
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Create the car constant.
  const car = carResult.rows[0];
  // Evaluate the condition and enter the branch when it is true.
  if (!car) return null;

  // Step 2: order revenue for revenue-eligible reservations (by Sofia order day).
  const revenue = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      COALESCE(SUM(o.total_price), 0)::float AS revenue,
      COUNT(*)::int AS bookings_count,
      COALESCE(SUM(o.rental_days), 0)::int AS rental_days
    FROM orders o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE o.is_deleted = FALSE
      AND o.car_id = $1
      AND r.status = ANY($4::text[])
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date >= $2::date
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date <= $3::date
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId, from, to, REVENUE_STATUSES]
  );

  // Step 3: booked overlap days (calendar utilization, not order rental_days).
  const util = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COALESCE(SUM(${overlap}), 0)::float AS booked_days
    FROM reservations r
    WHERE r.car_id = $1
      AND r.status = ANY($4::text[])
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date < ($3::date + 1)
      AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date > $2::date
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId, from, to, OCCUPANCY_STATUSES]
  );

  // Step 4: maintenance block overlap days for this car.
  const maintenance = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COALESCE(SUM(
      GREATEST(
        0,
        (
          LEAST((b.end_date AT TIME ZONE 'Europe/Sofia')::date, $3::date)
          - GREATEST((b.start_date AT TIME ZONE 'Europe/Sofia')::date, $2::date)
        )
      )
    ), 0)::float AS maintenance_days
    FROM car_date_blocks b
    WHERE b.car_id = $1
      AND b.block_type = 'maintenance'
      AND (b.start_date AT TIME ZONE 'Europe/Sofia')::date < ($3::date + 1)
      AND (b.end_date AT TIME ZONE 'Europe/Sofia')::date > $2::date
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId, from, to]
  );

  // Step 5: damage repair costs created in the Sofia day range.
  const repair = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COALESCE(SUM(repair_cost), 0)::float AS repair_cost
    FROM car_damage_reports
    WHERE car_id = $1
      AND (created_at AT TIME ZONE 'Europe/Sofia')::date >= $2::date
      AND (created_at AT TIME ZONE 'Europe/Sofia')::date <= $3::date
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId, from, to]
  );

  // Step 6: service record costs by service_date (date column, not timestamp).
  const service = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COALESCE(SUM(cost), 0)::float AS service_cost
    FROM car_service_records
    WHERE car_id = $1
      AND service_date >= $2::date
      AND service_date <= $3::date
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carId, from, to]
  );

  // Return the resulting value to the caller.
  return {
    // Provide the car id field value.
    carId: String(car.id),
    // Provide the car name field value.
    carName: car.name,
    // Provide the registration number field value.
    registrationNumber: car.registration_number,
    // Provide the revenue field value.
    revenue: Number(revenue.rows[0]?.revenue || 0),
    // Provide the bookings count field value.
    bookingsCount: Number(revenue.rows[0]?.bookings_count || 0),
    // Provide the rental days field value.
    rentalDays: Number(revenue.rows[0]?.rental_days || 0),
    // Provide the booked days field value.
    bookedDays: Number(util.rows[0]?.booked_days || 0),
    // Provide the maintenance days field value.
    maintenanceDays: Number(maintenance.rows[0]?.maintenance_days || 0),
    // Provide the repair cost field value.
    repairCost: Number(repair.rows[0]?.repair_cost || 0),
    // Provide the service cost field value.
    serviceCost: Number(service.rows[0]?.service_cost || 0),
  };
}

/**
 * Fleet-wide performance rows for the period (same metrics as getCarPerformance).
 * @param {{ from: string, to: string }} range
 * @param {import('pg').PoolClient|null} [client]
 */
async function listCarPerformance({ from, to }, client = null) {
  // Load active fleet ids, then reuse per-car query for consistent metrics.
  const cars = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id FROM cars
    WHERE is_deleted = FALSE AND status <> 'inactive'
    ORDER BY id
    `
  );

  // Create the rows constant.
  const rows = [];
  // Iterate using the loop initializer, condition, and step.
  for (const row of cars.rows) {
    // Create the perf constant.
    const perf = await getCarPerformance({ carId: row.id, from, to }, client);
    // Evaluate the condition and enter the branch when it is true.
    if (perf) rows.push(perf);
  }
  // Highest revenue first for fleet performance tables.
  rows.sort((a, b) => b.revenue - a.revenue);
  // Return the resulting value to the caller.
  return rows;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getCarPerformance,
  // Contribute this line to the enclosing declaration or statement.
  listCarPerformance,
};
