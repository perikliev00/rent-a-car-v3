const { clientQuery } = require('../../../db/transaction');
const { TERMINAL_STATUSES } = require('../../../domain/reservationStatus');

async function listReservationsInRange({ from, to, carIds = null, statuses = null }, client = null) {
  const params = [from, to];
  const where = [
    `r.pickup_date < $2`,
    `r.return_date > $1`,
    `r.status <> ALL($${params.push(TERMINAL_STATUSES)}::text[])`,
  ];

  if (Array.isArray(carIds) && carIds.length > 0) {
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    where.push(`r.car_id = ANY($${params.length}::bigint[])`);
  }
  if (Array.isArray(statuses) && statuses.length > 0) {
    params.push(statuses);
    where.push(`r.status = ANY($${params.length}::text[])`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      r.id, r.car_id, r.status, r.pickup_date, r.return_date,
      r.pickup_time, r.return_time, r.pickup_location, r.return_location,
      r.full_name, r.email, r.phone_number, r.total_price,
      c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE ${where.join(' AND ')}
    ORDER BY r.pickup_date ASC
    `,
    params
  );
  return result.rows;
}

async function findReservationById(reservationId, client = null) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await clientQuery(
    client,
    `
    SELECT r.*, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.id = $1
    LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function getDayReservationSections(dateIso, client = null) {
  const pickups = await clientQuery(
    client,
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.return_date, r.full_name, r.email,
           r.phone_number, c.name AS car_name, c.status AS car_status
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      AND r.status NOT IN ('cancelled','expired','refunded','no_show','completed')
    ORDER BY r.pickup_date ASC
    `,
    [dateIso]
  );
  const returns = await clientQuery(
    client,
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.return_date, r.full_name, r.email,
           r.phone_number, c.name AS car_name, c.status AS car_status
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE (r.return_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      AND r.status NOT IN ('cancelled','expired','refunded','no_show','completed')
    ORDER BY r.return_date ASC
    `,
    [dateIso]
  );
  const paidNotConfirmed = await clientQuery(
    client,
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.full_name, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status = 'paid'
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date <= ($1::date + INTERVAL '3 days')
    ORDER BY r.pickup_date ASC
    LIMIT 50
    `,
    [dateIso]
  );

  return {
    pickups: pickups.rows,
    returns: returns.rows,
    paidNotConfirmed: paidNotConfirmed.rows,
  };
}

module.exports = {
  listReservationsInRange,
  findReservationById,
  getDayReservationSections,
};
