/**
 * Reservation SQL for calendar range queries and day-ops sections.
 *
 * Day sections use Europe/Sofia date casting so local pickup/return days match ops.
 */

const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { TERMINAL_STATUSES } = require('../../../domain/reservationStatus');

/**
 * Active (non-terminal) reservations overlapping [from, to).
 * @param {{ from: Date|string, to: Date|string, carIds?: Array|null, statuses?: string[]|null }} opts
 */
async function listReservationsInRange({ from, to, carIds = null, statuses = null }, client = null) {
  // Create the params constant.
  const params = [from, to];
  // Create the where constant.
  const where = [
    // Continue the surrounding logic with this statement.
    `r.pickup_date < $2`,
    // Continue the surrounding logic with this statement.
    `r.return_date > $1`,
    // Continue the surrounding logic with this statement.
    `r.status <> ALL($${params.push(TERMINAL_STATUSES)}::text[])`,
  ];

  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(carIds) && carIds.length > 0) {
    // Call params.push to perform this step.
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    // Call where.push to perform this step.
    where.push(`r.car_id = ANY($${params.length}::bigint[])`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(statuses) && statuses.length > 0) {
    // Call params.push to perform this step.
    params.push(statuses);
    // Call where.push to perform this step.
    where.push(`r.status = ANY($${params.length}::text[])`);
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/** @param {string|number} reservationId */
async function findReservationById(reservationId, client = null) {
  // Create the id constant.
  const id = Number(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(id) || id <= 0) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.*, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * Day board sections: Sofia-local pickups/returns plus paid-not-confirmed near term.
 * @param {string} dateIso YYYY-MM-DD
 */
async function getDayReservationSections(dateIso, client = null) {
  // Create the pickups constant.
  const pickups = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.return_date, r.full_name, r.email,
           r.phone_number, c.name AS car_name, c.status AS car_status
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      AND r.status NOT IN ('cancelled','expired','refunded','no_show','completed')
    ORDER BY r.pickup_date ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [dateIso]
  );
  // Create the returns constant.
  const returns = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.return_date, r.full_name, r.email,
           r.phone_number, c.name AS car_name, c.status AS car_status
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE (r.return_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      AND r.status NOT IN ('cancelled','expired','refunded','no_show','completed')
    ORDER BY r.return_date ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [dateIso]
  );
  // Create the paid not confirmed constant.
  const paidNotConfirmed = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.full_name, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status = 'paid'
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date <= ($1::date + INTERVAL '3 days')
    ORDER BY r.pickup_date ASC
    LIMIT 50
    `,
    // Contribute this line to the enclosing declaration or statement.
    [dateIso]
  );

  // Return the resulting value to the caller.
  return {
    // Provide the pickups field value.
    pickups: pickups.rows,
    // Provide the returns field value.
    returns: returns.rows,
    // Provide the paid not confirmed field value.
    paidNotConfirmed: paidNotConfirmed.rows,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listReservationsInRange,
  // Contribute this line to the enclosing declaration or statement.
  findReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getDayReservationSections,
};
