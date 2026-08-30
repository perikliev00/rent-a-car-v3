const { clientQuery } = require('../../../db/transaction');
const { REVENUE_STATUSES } = require('../analytics.domain');

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

module.exports = {
  getRevenueTotals,
  getRevenueSeries,
  getRevenueByCar,
  getRevenueByLocation,
};
