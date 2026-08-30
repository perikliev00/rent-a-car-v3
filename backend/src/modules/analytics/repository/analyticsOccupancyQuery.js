const { clientQuery } = require('../../../db/transaction');
const { OCCUPANCY_STATUSES, overlapDaysSql } = require('../analytics.domain');

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

module.exports = {
  getOccupancyStats,
  getMostRentedCars,
  getUtilizationByCar,
};
