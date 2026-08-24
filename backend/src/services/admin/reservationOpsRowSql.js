const { clientQuery } = require('../../db/transaction');

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
    refundOperation:
      row.refund_op_id == null
        ? null
        : {
            id: Number(row.refund_op_id),
            status: row.refund_op_status,
            amountCents: Number(row.refund_op_amount_cents),
            currency: row.refund_op_currency,
            failureCode: row.refund_op_failure_code || null,
            failureMessage: row.refund_op_failure_message || null,
            updatedAt: row.refund_op_updated_at || null,
          },
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
  o.id AS order_id,
  refund_op.id AS refund_op_id,
  refund_op.status AS refund_op_status,
  refund_op.amount_cents AS refund_op_amount_cents,
  refund_op.currency AS refund_op_currency,
  refund_op.failure_code AS refund_op_failure_code,
  refund_op.failure_message AS refund_op_failure_message,
  refund_op.updated_at AS refund_op_updated_at
`;

const BASE_FROM = `
  FROM reservations r
  LEFT JOIN cars c ON c.id = r.car_id
  LEFT JOIN orders o ON o.reservation_id = r.id AND o.is_deleted = FALSE
  LEFT JOIN LATERAL (
    SELECT ro.id, ro.status, ro.amount_cents, ro.currency, ro.failure_code, ro.failure_message, ro.updated_at
    FROM refund_operations ro
    WHERE ro.reservation_id = r.id
    ORDER BY ro.id DESC
    LIMIT 1
  ) refund_op ON TRUE
`;

async function querySection(sql, params = []) {
  const result = await clientQuery(null, sql, params);
  return result.rows.map(mapOpsRow).filter(Boolean);
}

module.exports = {
  mapOpsRow,
  BASE_SELECT,
  BASE_FROM,
  querySection,
};
