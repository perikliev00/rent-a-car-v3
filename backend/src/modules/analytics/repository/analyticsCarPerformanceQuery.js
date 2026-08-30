const { clientQuery } = require('../../../db/transaction');
const {
  REVENUE_STATUSES,
  OCCUPANCY_STATUSES,
  overlapDaysSql,
} = require('../analytics.domain');

async function getCarPerformance({ carId, from, to }, client = null) {
  const overlap = overlapDaysSql('r.pickup_date', 'r.return_date', 2, 3);

  const carResult = await clientQuery(
    client,
    `
    SELECT id, name, registration_number
    FROM cars
    WHERE id = $1 AND is_deleted = FALSE
    `,
    [carId]
  );
  const car = carResult.rows[0];
  if (!car) return null;

  const revenue = await clientQuery(
    client,
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
    [carId, from, to, REVENUE_STATUSES]
  );

  const util = await clientQuery(
    client,
    `
    SELECT COALESCE(SUM(${overlap}), 0)::float AS booked_days
    FROM reservations r
    WHERE r.car_id = $1
      AND r.status = ANY($4::text[])
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date < ($3::date + 1)
      AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date > $2::date
    `,
    [carId, from, to, OCCUPANCY_STATUSES]
  );

  const maintenance = await clientQuery(
    client,
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
    [carId, from, to]
  );

  const repair = await clientQuery(
    client,
    `
    SELECT COALESCE(SUM(repair_cost), 0)::float AS repair_cost
    FROM car_damage_reports
    WHERE car_id = $1
      AND (created_at AT TIME ZONE 'Europe/Sofia')::date >= $2::date
      AND (created_at AT TIME ZONE 'Europe/Sofia')::date <= $3::date
    `,
    [carId, from, to]
  );

  const service = await clientQuery(
    client,
    `
    SELECT COALESCE(SUM(cost), 0)::float AS service_cost
    FROM car_service_records
    WHERE car_id = $1
      AND service_date >= $2::date
      AND service_date <= $3::date
    `,
    [carId, from, to]
  );

  return {
    carId: String(car.id),
    carName: car.name,
    registrationNumber: car.registration_number,
    revenue: Number(revenue.rows[0]?.revenue || 0),
    bookingsCount: Number(revenue.rows[0]?.bookings_count || 0),
    rentalDays: Number(revenue.rows[0]?.rental_days || 0),
    bookedDays: Number(util.rows[0]?.booked_days || 0),
    maintenanceDays: Number(maintenance.rows[0]?.maintenance_days || 0),
    repairCost: Number(repair.rows[0]?.repair_cost || 0),
    serviceCost: Number(service.rows[0]?.service_cost || 0),
  };
}

async function listCarPerformance({ from, to }, client = null) {
  const cars = await clientQuery(
    client,
    `
    SELECT id FROM cars
    WHERE is_deleted = FALSE AND status <> 'inactive'
    ORDER BY id
    `
  );

  const rows = [];
  for (const row of cars.rows) {
    const perf = await getCarPerformance({ carId: row.id, from, to }, client);
    if (perf) rows.push(perf);
  }
  rows.sort((a, b) => b.revenue - a.revenue);
  return rows;
}

module.exports = {
  getCarPerformance,
  listCarPerformance,
};
