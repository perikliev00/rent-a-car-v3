const { clientQuery } = require('../../db/transaction');
const {
  REVENUE_STATUSES,
  OCCUPANCY_STATUSES,
  overlapDaysSql,
} = require('./analytics.domain');

async function getRevenueTotals({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      COALESCE(SUM(o.total_price), 0)::float AS revenue,
      COALESCE(SUM(o.rental_days), 0)::int AS rental_days,
      COUNT(*)::int AS order_count
    FROM orders o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE o.is_deleted = FALSE
      AND r.status = ANY($3::text[])
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    `,
    [from, to, REVENUE_STATUSES]
  );
  return result.rows[0];
}

async function getRevenueSeries({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      (o.created_at AT TIME ZONE 'Europe/Sofia')::date::text AS day,
      COALESCE(SUM(o.total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders
    FROM orders o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE o.is_deleted = FALSE
      AND r.status = ANY($3::text[])
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    GROUP BY 1
    ORDER BY 1
    `,
    [from, to, REVENUE_STATUSES]
  );
  return result.rows;
}

async function getConfirmedBookingsCount({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT COUNT(DISTINCT h.reservation_id)::int AS count
    FROM reservation_status_history h
    WHERE h.new_status = 'confirmed'
      AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    `,
    [from, to]
  );
  return result.rows[0]?.count || 0;
}

async function getBookingsSeries({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      (h.created_at AT TIME ZONE 'Europe/Sofia')::date::text AS day,
      COUNT(DISTINCT h.reservation_id)::int AS bookings
    FROM reservation_status_history h
    WHERE h.new_status = 'confirmed'
      AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    GROUP BY 1
    ORDER BY 1
    `,
    [from, to]
  );
  return result.rows;
}

async function getCancelledBookingsCount({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT COUNT(DISTINCT h.reservation_id)::int AS count
    FROM reservation_status_history h
    WHERE h.new_status = 'cancelled'
      AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    `,
    [from, to]
  );
  return result.rows[0]?.count || 0;
}

async function getFailedPaymentsStats({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE resolved = FALSE)::int AS unresolved
    FROM payment_failures
    WHERE (created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    `,
    [from, to]
  );
  return result.rows[0];
}

async function getConversionStats({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    WITH checkout_starts AS (
      SELECT DISTINCT r.id
      FROM reservations r
      LEFT JOIN reservation_status_history h
        ON h.reservation_id = r.id AND h.new_status = 'processing_payment'
      WHERE (
          h.id IS NOT NULL
          AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
          AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
        )
        OR (
          r.stripe_session_id IS NOT NULL
          AND (r.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
          AND (r.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
        )
    ),
    confirmed AS (
      SELECT DISTINCT h.reservation_id AS id
      FROM reservation_status_history h
      WHERE h.new_status = 'confirmed'
        AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
        AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    ),
    abandoned AS (
      SELECT COUNT(DISTINCT h.reservation_id)::int AS count
      FROM reservation_status_history h
      WHERE h.new_status = 'expired'
        AND h.reason = 'abandoned_hold'
        AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
        AND (h.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    )
    SELECT
      (SELECT COUNT(*)::int FROM checkout_starts) AS checkout_starts,
      (SELECT COUNT(*)::int FROM confirmed) AS successful_bookings,
      (SELECT count FROM abandoned) AS abandoned_holds
    `
  ,
    [from, to]
  );
  return result.rows[0];
}

async function getOccupancyStats({ from, to }, client = null) {
  const overlap = overlapDaysSql('r.pickup_date', 'r.return_date', 1, 2);

  const rented = await clientQuery(
    client,
    `
    SELECT COALESCE(SUM(${overlap}), 0)::float AS rented_days
    FROM reservations r
    WHERE r.status = ANY($3::text[])
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date < ($2::date + 1)
      AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date > $1::date
    `,
    [from, to, OCCUPANCY_STATUSES]
  );

  const fleet = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS active_cars
    FROM cars c
    WHERE c.is_deleted = FALSE
      AND c.status <> 'inactive'
    `
  );

  const maintenance = await clientQuery(
    client,
    `
    SELECT COALESCE(SUM(
      GREATEST(
        0,
        (
          LEAST((b.end_date AT TIME ZONE 'Europe/Sofia')::date, $2::date)
          - GREATEST((b.start_date AT TIME ZONE 'Europe/Sofia')::date, $1::date)
        )
      )
    ), 0)::float AS maintenance_days
    FROM car_date_blocks b
    JOIN cars c ON c.id = b.car_id
    WHERE b.block_type = 'maintenance'
      AND c.is_deleted = FALSE
      AND c.status <> 'inactive'
      AND (b.start_date AT TIME ZONE 'Europe/Sofia')::date < ($2::date + 1)
      AND (b.end_date AT TIME ZONE 'Europe/Sofia')::date > $1::date
    `,
    [from, to]
  );

  return {
    rentedDays: Number(rented.rows[0]?.rented_days || 0),
    activeCars: Number(fleet.rows[0]?.active_cars || 0),
    maintenanceDays: Number(maintenance.rows[0]?.maintenance_days || 0),
  };
}

async function getMostRentedCars({ from, to, limit = 10 }, client = null) {
  const overlap = overlapDaysSql('r.pickup_date', 'r.return_date', 1, 2);
  const result = await clientQuery(
    client,
    `
    SELECT
      c.id AS car_id,
      c.name AS car_name,
      c.registration_number,
      COUNT(DISTINCT r.id)::int AS bookings_count,
      COALESCE(SUM(${overlap}), 0)::float AS rented_days
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status = ANY($3::text[])
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date < ($2::date + 1)
      AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date > $1::date
    GROUP BY c.id, c.name, c.registration_number
    ORDER BY bookings_count DESC, rented_days DESC
    LIMIT $4
    `,
    [from, to, OCCUPANCY_STATUSES, limit]
  );
  return result.rows;
}

async function getRevenueByCar({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      c.id AS car_id,
      c.name AS car_name,
      c.registration_number,
      COALESCE(SUM(o.total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders_count,
      COALESCE(SUM(o.rental_days), 0)::int AS rental_days
    FROM orders o
    JOIN reservations r ON r.id = o.reservation_id
    JOIN cars c ON c.id = o.car_id
    WHERE o.is_deleted = FALSE
      AND r.status = ANY($3::text[])
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    GROUP BY c.id, c.name, c.registration_number
    ORDER BY revenue DESC
    `,
    [from, to, REVENUE_STATUSES]
  );
  return result.rows;
}

async function getRevenueByLocation({ from, to }, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      o.pickup_location AS location,
      COALESCE(SUM(o.total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders_count
    FROM orders o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE o.is_deleted = FALSE
      AND r.status = ANY($3::text[])
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date >= $1::date
      AND (o.created_at AT TIME ZONE 'Europe/Sofia')::date <= $2::date
    GROUP BY o.pickup_location
    ORDER BY revenue DESC
    `,
    [from, to, REVENUE_STATUSES]
  );
  return result.rows;
}

async function getUtilizationByCar({ from, to }, client = null) {
  const overlap = overlapDaysSql('r.pickup_date', 'r.return_date', 1, 2);
  const maintOverlap = `
    GREATEST(
      0,
      (
        LEAST((b.end_date AT TIME ZONE 'Europe/Sofia')::date, $2::date)
        - GREATEST((b.start_date AT TIME ZONE 'Europe/Sofia')::date, $1::date)
      )
    )
  `;

  const result = await clientQuery(
    client,
    `
    WITH active_cars AS (
      SELECT c.id, c.name, c.registration_number
      FROM cars c
      WHERE c.is_deleted = FALSE
        AND c.status <> 'inactive'
    ),
    rented AS (
      SELECT
        r.car_id,
        COALESCE(SUM(${overlap}), 0)::float AS booked_days
      FROM reservations r
      WHERE r.status = ANY($3::text[])
        AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date < ($2::date + 1)
        AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date > $1::date
      GROUP BY r.car_id
    ),
    maint AS (
      SELECT
        b.car_id,
        COALESCE(SUM(${maintOverlap}), 0)::float AS maintenance_days
      FROM car_date_blocks b
      WHERE b.block_type = 'maintenance'
        AND (b.start_date AT TIME ZONE 'Europe/Sofia')::date < ($2::date + 1)
        AND (b.end_date AT TIME ZONE 'Europe/Sofia')::date > $1::date
      GROUP BY b.car_id
    )
    SELECT
      ac.id AS car_id,
      ac.name AS car_name,
      ac.registration_number,
      COALESCE(r.booked_days, 0)::float AS booked_days,
      COALESCE(m.maintenance_days, 0)::float AS maintenance_days
    FROM active_cars ac
    LEFT JOIN rented r ON r.car_id = ac.id
    LEFT JOIN maint m ON m.car_id = ac.id
    ORDER BY booked_days DESC
    `,
    [from, to, OCCUPANCY_STATUSES]
  );
  return result.rows;
}

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
  getRevenueTotals,
  getRevenueSeries,
  getConfirmedBookingsCount,
  getBookingsSeries,
  getCancelledBookingsCount,
  getFailedPaymentsStats,
  getConversionStats,
  getOccupancyStats,
  getMostRentedCars,
  getRevenueByCar,
  getRevenueByLocation,
  getUtilizationByCar,
  getCarPerformance,
  listCarPerformance,
};
