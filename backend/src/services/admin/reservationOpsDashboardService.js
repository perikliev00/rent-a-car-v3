const { clientQuery } = require('../../db/transaction');
const { getSofiaIsoDateString } = require('../../utils/date/timezone');

const DEFAULT_LIMIT = 20;

function mapOpsRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    status: row.status,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    returnDate: row.return_date,
    returnTime: row.return_time,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    carName: row.car_name,
    orderId: row.order_id != null ? String(row.order_id) : null,
    totalPrice: row.total_price != null ? Number(row.total_price) : null,
    cancelReason: row.cancel_reason || null,
    updatedAt: row.updated_at,
  };
}

const BASE_SELECT = `
  r.id,
  r.status,
  r.pickup_date,
  r.pickup_time,
  r.return_date,
  r.return_time,
  r.full_name,
  r.email,
  r.phone_number,
  r.total_price,
  r.updated_at,
  c.name AS car_name,
  o.id AS order_id
`;

const BASE_FROM = `
  FROM reservations r
  LEFT JOIN cars c ON c.id = r.car_id
  LEFT JOIN orders o ON o.reservation_id = r.id AND o.is_deleted = FALSE
`;

async function querySection(sql, params = []) {
  const result = await clientQuery(null, sql, params);
  return result.rows.map(mapOpsRow).filter(Boolean);
}

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
