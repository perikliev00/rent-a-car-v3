const { getSofiaIsoDateString } = require('../../utils/date/timezone');
const { BASE_SELECT, BASE_FROM, querySection } = require('./reservationOpsRowSql');

const DEFAULT_LIMIT = 20;

async function getOpsDashboard({ limit = DEFAULT_LIMIT } = {}) {
  const sectionLimit = Math.min(50, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  const todaySofia = getSofiaIsoDateString(new Date());

  const [
    todaysPickups,
    todaysReturns,
    activeRentals,
    overdueReturns,
    manualReview,
    paidNotConfirmed,
    cancelled,
    failedPayments,
  ] = await Promise.all([
    querySection(
      `
      SELECT ${BASE_SELECT},
        (r.pickup_date < NOW() AND r.status IN ('confirmed', 'car_prepared')) AS overdue
      ${BASE_FROM}
      WHERE r.status IN ('confirmed', 'car_prepared')
        AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      ORDER BY r.pickup_date ASC
      LIMIT $2
      `,
      [todaySofia, sectionLimit]
    ),
    querySection(
      `
      SELECT ${BASE_SELECT},
        (r.return_date < NOW() AND r.status IN ('picked_up', 'active_rental')) AS overdue
      ${BASE_FROM}
      WHERE r.status IN ('picked_up', 'active_rental')
        AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      ORDER BY r.return_date ASC
      LIMIT $2
      `,
      [todaySofia, sectionLimit]
    ),
    querySection(
      `
      SELECT ${BASE_SELECT},
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.return_date - NOW())) / 86400.0))::int AS remaining_days
      ${BASE_FROM}
      WHERE r.status IN ('picked_up', 'active_rental')
      ORDER BY r.return_date ASC
      LIMIT $1
      `,
      [sectionLimit]
    ),
    querySection(
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status IN ('picked_up', 'active_rental')
        AND r.return_date < NOW()
      ORDER BY r.return_date ASC
      LIMIT $1
      `,
      [sectionLimit]
    ),
    querySection(
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status = 'manual_review'
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      [sectionLimit]
    ),
    querySection(
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status = 'paid'
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      [sectionLimit]
    ),
    querySection(
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
      [sectionLimit]
    ),
    querySection(
      `
      SELECT ${BASE_SELECT}
      ${BASE_FROM}
      WHERE r.status IN ('pending_payment', 'processing_payment', 'expired')
      ORDER BY r.updated_at DESC
      LIMIT $1
      `,
      [sectionLimit]
    ),
  ]);

  return {
    today: todaySofia,
    limit: sectionLimit,
    widgets: {
      todaysPickups,
      todaysReturns,
      activeRentals,
      overdueReturns,
      manualReview,
      paidNotConfirmed,
      cancelled,
      failedPayments,
    },
  };
}

module.exports = {
  getOpsDashboard,
};
