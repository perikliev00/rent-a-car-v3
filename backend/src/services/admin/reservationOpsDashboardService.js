/**
 * Reservation ops dashboard widgets (today's pickups/returns, overdue,
 * manual review, paid-not-confirmed, cancellations, failed payments).
 * "Today" is Europe/Sofia so desk staff see local business-day buckets.
 */
const { getSofiaIsoDateString } = require('../../utils/date/timezone');
// Destructure object properties into local variables.
const { BASE_SELECT, BASE_FROM, querySection } = require('./reservationOpsRowSql');

// Create the default limit constant.
const DEFAULT_LIMIT = 20;

/**
 * Parallel widget queries for the ops home screen.
 * @param {{limit?: number}} [opts]
 */
async function getOpsDashboard({ limit = DEFAULT_LIMIT } = {}) {
  // Create the section limit constant.
  const sectionLimit = Math.min(50, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  // Create the today sofia constant.
  const todaySofia = getSofiaIsoDateString(new Date());

  // Destructure array values into local variables.
  const [
    // Contribute this line to the enclosing declaration or statement.
    todaysPickups,
    // Contribute this line to the enclosing declaration or statement.
    todaysReturns,
    // Contribute this line to the enclosing declaration or statement.
    activeRentals,
    // Contribute this line to the enclosing declaration or statement.
    overdueReturns,
    // Contribute this line to the enclosing declaration or statement.
    manualReview,
    // Contribute this line to the enclosing declaration or statement.
    paidNotConfirmed,
    // Contribute this line to the enclosing declaration or statement.
    cancelled,
    // Contribute this line to the enclosing declaration or statement.
    failedPayments,
  // Store the awaited result in ].
  ] = await Promise.all([
    // Confirmed/prepared pickups scheduled for Sofia today; overdue flag if past NOW.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT},
        (r.pickup_date < NOW() AND r.status IN ('confirmed', 'car_prepared')) AS overdue
      ${BASE_FROM}
      WHERE r.status IN ('confirmed', 'car_prepared')
        AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      ORDER BY r.pickup_date ASC
      LIMIT $2
      `,
      // Contribute this line to the enclosing declaration or statement.
      [todaySofia, sectionLimit]
    ),
    // Call querySection to perform this step.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT},
        (r.return_date < NOW() AND r.status IN ('picked_up', 'active_rental')) AS overdue
      ${BASE_FROM}
      WHERE r.status IN ('picked_up', 'active_rental')
        AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      ORDER BY r.return_date ASC
      LIMIT $2
      `,
      // Contribute this line to the enclosing declaration or statement.
      [todaySofia, sectionLimit]
    ),
    // Call querySection to perform this step.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT},
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.return_date - NOW())) / 86400.0))::int AS remaining_days
      ${BASE_FROM}
      WHERE r.status IN ('picked_up', 'active_rental')
      ORDER BY r.return_date ASC
      LIMIT $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [sectionLimit]
    ),
    // Call querySection to perform this step.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status IN ('picked_up', 'active_rental')
        AND r.return_date < NOW()
      ORDER BY r.return_date ASC
      LIMIT $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [sectionLimit]
    ),
    // Call querySection to perform this step.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status = 'manual_review'
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [sectionLimit]
    ),
    // Paid but not yet confirmed — needs desk follow-up.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status = 'paid'
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [sectionLimit]
    ),
    // Call querySection to perform this step.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT},
        (
          SELECT h.reason
          FROM reservation_status_history h
          WHERE h.reservation_id = r.id AND h.new_status = 'cancelled'
          ORDER BY h.created_at DESC
          LIMIT 1
        ) AS cancel_reason
      ${BASE_FROM}
      WHERE r.status = 'cancelled'
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [sectionLimit]
    ),
    // Call querySection to perform this step.
    querySection(
      // Continue the surrounding logic with this statement.
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status IN ('pending_payment', 'processing_payment', 'expired')
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [sectionLimit]
    ),
  ]);

  // Return the resulting value to the caller.
  return {
    // Provide the today field value.
    today: todaySofia,
    // Provide the limit field value.
    limit: sectionLimit,
    // Provide the widgets field value.
    widgets: {
      // Contribute this line to the enclosing declaration or statement.
      todaysPickups,
      // Contribute this line to the enclosing declaration or statement.
      todaysReturns,
      // Contribute this line to the enclosing declaration or statement.
      activeRentals,
      // Contribute this line to the enclosing declaration or statement.
      overdueReturns,
      // Contribute this line to the enclosing declaration or statement.
      manualReview,
      // Contribute this line to the enclosing declaration or statement.
      paidNotConfirmed,
      // Contribute this line to the enclosing declaration or statement.
      cancelled,
      // Contribute this line to the enclosing declaration or statement.
      failedPayments,
    },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getOpsDashboard,
};
