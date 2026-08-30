const { clientQuery } = require('../../../db/transaction');

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

module.exports = {
  getConfirmedBookingsCount,
  getBookingsSeries,
  getCancelledBookingsCount,
  getFailedPaymentsStats,
  getConversionStats,
};
