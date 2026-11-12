/**
 * Shared SQL fragments and row mapper for reservation ops / payment queues.
 * Soft-deleted orders are excluded so ops never latches onto a tombstoned order.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a raw ops SQL row to the camelCase API shape (incl. latest refund op).
 * @param {object|null} row
 */
function mapOpsRow(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the status field value.
    status: row.status,
    // Provide the pickup date field value.
    pickupDate: row.pickup_date,
    // Provide the pickup time field value.
    pickupTime: row.pickup_time,
    // Provide the return date field value.
    returnDate: row.return_date,
    // Provide the return time field value.
    returnTime: row.return_time,
    // Provide the full name field value.
    fullName: row.full_name,
    // Provide the email field value.
    email: row.email,
    // Provide the phone number field value.
    phoneNumber: row.phone_number,
    // Provide the car name field value.
    carName: row.car_name,
    // Provide the order id field value.
    orderId: row.order_id != null ? String(row.order_id) : null,
    // Provide the total price field value.
    totalPrice: row.total_price != null ? Number(row.total_price) : null,
    // Provide the cancel reason field value.
    cancelReason: row.cancel_reason || null,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
    // Provide the refund operation field value.
    refundOperation:
      // Update row.refund_op_id with the right-hand side value.
      row.refund_op_id == null
        // Contribute this line to the enclosing declaration or statement.
        ? null
        // Contribute this line to the enclosing declaration or statement.
        : {
            // Provide the id field value.
            id: Number(row.refund_op_id),
            // Provide the status field value.
            status: row.refund_op_status,
            // Provide the amount cents field value.
            amountCents: Number(row.refund_op_amount_cents),
            // Provide the currency field value.
            currency: row.refund_op_currency,
            // Provide the failure code field value.
            failureCode: row.refund_op_failure_code || null,
            // Provide the failure message field value.
            failureMessage: row.refund_op_failure_message || null,
            // Provide the updated at field value.
            updatedAt: row.refund_op_updated_at || null,
          },
  };
}

/** Core reservation + car + non-deleted order + latest refund_operation columns. */
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

/**
 * Shared FROM/JOIN: car name, active order, and latest refund_operation via
 * LATERAL (ORDER BY id DESC LIMIT 1) so multi-refund history stays deterministic.
 */
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

/**
 * Run a widget/section query and map rows to ops DTOs.
 * @param {string} sql
 * @param {unknown[]} [params]
 */
async function querySection(sql, params = []) {
  // Create the result constant.
  const result = await clientQuery(null, sql, params);
  // Return the resulting value to the caller.
  return result.rows.map(mapOpsRow).filter(Boolean);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapOpsRow,
  // Contribute this line to the enclosing declaration or statement.
  BASE_SELECT,
  // Contribute this line to the enclosing declaration or statement.
  BASE_FROM,
  // Contribute this line to the enclosing declaration or statement.
  querySection,
};
