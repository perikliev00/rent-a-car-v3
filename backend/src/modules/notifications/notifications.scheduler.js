/**
 * Cron/scheduler jobs that discover due operational alerts and enqueue them.
 *
 * Uses Sofia-local dates for pickup/return/maintenance windows. Idempotency
 * keys include entity + day (or expiry) so daily runs do not duplicate mail.
 */

const { clientQuery } = require('../../db/transaction');
// Destructure object properties into local variables.
const { enqueue } = require('./notifications.enqueue');
// Destructure object properties into local variables.
const { RESERVATION_HOLD_MINUTES } = require('../../config/reservationTiming');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');

/** Remind while hold is still valid, ~10 minutes before hold expiry (floor 15m). */
const ABANDONED_REMINDER_MINUTES = Math.max(RESERVATION_HOLD_MINUTES - 10, 15);
// Create the paid not confirmed hours constant.
const PAID_NOT_CONFIRMED_HOURS = 2;
// Create the insurance alert days constant.
const INSURANCE_ALERT_DAYS = 14;

/**
 * Confirmed pickups tomorrow (Sofia calendar day).
 * @returns {Promise<number>} Newly inserted notification count
 */
async function enqueuePickupReminders() {
  // Find confirmed/prepared reservations with pickup tomorrow (Sofia).
  const result = await clientQuery(
    // Supply the literal value used by the enclosing expression.
    null,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.email, r.car_id, r.full_name, r.pickup_date, r.pickup_time,
           r.pickup_location, r.return_date, r.return_location, r.total_price,
           c.name AS car_name,
           (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date AS pickup_day
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status IN ('confirmed', 'car_prepared')
      AND r.email IS NOT NULL
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date
          = ((NOW() AT TIME ZONE 'Europe/Sofia')::date + 1)
    `
  );

  // Initialize the mutable created variable.
  let created = 0;
  // Idempotency key includes pickup day so a rebooked day can notify again.
  for (const row of result.rows) {
    // Create the inserted constant.
    const inserted = await enqueue({
      // Provide the type field value.
      type: 'pickup_reminder',
      // Provide the recipient email field value.
      recipientEmail: row.email,
      // Provide the reservation id field value.
      reservationId: row.id,
      // Provide the car id field value.
      carId: row.car_id,
      // Provide the payload field value.
      payload: {
        // Provide the reservation id field value.
        reservationId: row.id,
        // Provide the full name field value.
        fullName: row.full_name,
        // Provide the car name field value.
        carName: row.car_name,
        // Provide the pickup date field value.
        pickupDate: row.pickup_date,
        // Provide the pickup time field value.
        pickupTime: row.pickup_time,
        // Provide the pickup location field value.
        pickupLocation: row.pickup_location,
        // Provide the return date field value.
        returnDate: row.return_date,
        // Provide the return location field value.
        returnLocation: row.return_location,
        // Provide the total price field value.
        totalPrice: row.total_price,
      },
      // Provide the idempotency key field value.
      idempotencyKey: `pickup_reminder:${row.id}:${row.pickup_day}`,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (inserted) created += 1;
  }
  // Return the resulting value to the caller.
  return created;
}

/**
 * Active rentals returning tomorrow (Sofia calendar day).
 * @returns {Promise<number>} Newly inserted notification count
 */
async function enqueueReturnReminders() {
  // Find picked_up/active_rental rows with return tomorrow (Sofia).
  const result = await clientQuery(
    // Supply the literal value used by the enclosing expression.
    null,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.email, r.car_id, r.full_name, r.pickup_date, r.return_date, r.return_time,
           r.pickup_location, r.return_location, r.total_price,
           c.name AS car_name,
           (r.return_date AT TIME ZONE 'Europe/Sofia')::date AS return_day
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status IN ('picked_up', 'active_rental')
      AND r.email IS NOT NULL
      AND (r.return_date AT TIME ZONE 'Europe/Sofia')::date
          = ((NOW() AT TIME ZONE 'Europe/Sofia')::date + 1)
    `
  );

  // Initialize the mutable created variable.
  let created = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the inserted constant.
    const inserted = await enqueue({
      // Provide the type field value.
      type: 'return_reminder',
      // Provide the recipient email field value.
      recipientEmail: row.email,
      // Provide the reservation id field value.
      reservationId: row.id,
      // Provide the car id field value.
      carId: row.car_id,
      // Provide the payload field value.
      payload: {
        // Provide the reservation id field value.
        reservationId: row.id,
        // Provide the full name field value.
        fullName: row.full_name,
        // Provide the car name field value.
        carName: row.car_name,
        // Provide the pickup date field value.
        pickupDate: row.pickup_date,
        // Provide the return date field value.
        returnDate: row.return_date,
        // Provide the return time field value.
        returnTime: row.return_time,
        // Provide the pickup location field value.
        pickupLocation: row.pickup_location,
        // Provide the return location field value.
        returnLocation: row.return_location,
        // Provide the total price field value.
        totalPrice: row.total_price,
      },
      // Provide the idempotency key field value.
      idempotencyKey: `return_reminder:${row.id}:${row.return_day}`,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (inserted) created += 1;
  }
  // Return the resulting value to the caller.
  return created;
}

/**
 * Pending payment holds that are aging but not yet expired.
 * @returns {Promise<number>} Newly inserted notification count
 */
async function enqueueAbandonedCheckoutReminders() {
  // Hold aged past reminder window but still has time before hold_expires_at.
  const result = await clientQuery(
    // Supply the literal value used by the enclosing expression.
    null,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.email, r.car_id, r.full_name, r.pickup_date, r.return_date,
           r.pickup_location, r.return_location, r.total_price, r.created_at,
           c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status IN ('pending_payment', 'processing_payment')
      AND r.email IS NOT NULL
      AND r.created_at <= NOW() - ($1::text || ' minutes')::interval
      AND r.hold_expires_at > NOW()
    `,
    // Continue the surrounding logic with this statement.
    [String(ABANDONED_REMINDER_MINUTES)]
  );

  // Initialize the mutable created variable.
  let created = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the inserted constant.
    const inserted = await enqueue({
      // Provide the type field value.
      type: 'abandoned_checkout_reminder',
      // Provide the recipient email field value.
      recipientEmail: row.email,
      // Provide the reservation id field value.
      reservationId: row.id,
      // Provide the car id field value.
      carId: row.car_id,
      // Provide the payload field value.
      payload: {
        // Provide the reservation id field value.
        reservationId: row.id,
        // Provide the full name field value.
        fullName: row.full_name,
        // Provide the car name field value.
        carName: row.car_name,
        // Provide the pickup date field value.
        pickupDate: row.pickup_date,
        // Provide the return date field value.
        returnDate: row.return_date,
        // Provide the pickup location field value.
        pickupLocation: row.pickup_location,
        // Provide the return location field value.
        returnLocation: row.return_location,
        // Provide the total price field value.
        totalPrice: row.total_price,
      },
      // Provide the idempotency key field value.
      idempotencyKey: `abandoned_checkout_reminder:${row.id}`,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (inserted) created += 1;
  }
  // Return the resulting value to the caller.
  return created;
}

/**
 * Admin alerts for civil/casco compliance items expiring within INSURANCE_ALERT_DAYS.
 * @returns {Promise<number>} Newly inserted notification count
 */
async function enqueueExpiringInsuranceAlerts() {
  // No ADMIN_EMAIL configured → skip (local/dev without ops mailbox).
  const adminEmail = process.env.ADMIN_EMAIL;
  // Evaluate the condition and enter the branch when it is true.
  if (!adminEmail) return 0;

  // Compliance items expiring between today and +INSURANCE_ALERT_DAYS.
  const result = await clientQuery(
    // Supply the literal value used by the enclosing expression.
    null,
    // Continue the surrounding logic with this statement.
    `
    SELECT ci.id, ci.car_id, ci.item_type, ci.title, ci.expires_at, c.name AS car_name
    FROM car_compliance_items ci
    JOIN cars c ON c.id = ci.car_id
    WHERE c.is_deleted = FALSE
      AND ci.expires_at IS NOT NULL
      AND ci.expires_at <= (CURRENT_DATE + ($1::text || ' days')::interval)::date
      AND ci.expires_at >= CURRENT_DATE
      AND ci.item_type IN ('civil_insurance', 'casco')
    `,
    // Continue the surrounding logic with this statement.
    [String(INSURANCE_ALERT_DAYS)]
  );

  // Initialize the mutable created variable.
  let created = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the inserted constant.
    const inserted = await enqueue({
      // Provide the type field value.
      type: 'expiring_insurance_alert',
      // Provide the recipient email field value.
      recipientEmail: adminEmail,
      // Provide the car id field value.
      carId: row.car_id,
      // Provide the payload field value.
      payload: {
        // Provide the car id field value.
        carId: row.car_id,
        // Provide the car name field value.
        carName: row.car_name,
        // Provide the item type field value.
        itemType: row.item_type,
        // Provide the item title field value.
        itemTitle: row.title,
        // Provide the expires at field value.
        expiresAt: row.expires_at,
        // Provide the compliance id field value.
        complianceId: row.id,
      },
      // Provide the idempotency key field value.
      idempotencyKey: `expiring_insurance_alert:${row.id}:${row.expires_at}`,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (inserted) created += 1;
  }
  // Return the resulting value to the caller.
  return created;
}

/**
 * Admin alerts for maintenance blocks starting within the next 3 Sofia days.
 * @returns {Promise<number>} Newly inserted notification count
 */
async function enqueueMaintenanceReminders() {
  // Create the admin email constant.
  const adminEmail = process.env.ADMIN_EMAIL;
  // Evaluate the condition and enter the branch when it is true.
  if (!adminEmail) return 0;

  // Maintenance blocks whose Sofia start day is within [today, today+3].
  const result = await clientQuery(
    // Supply the literal value used by the enclosing expression.
    null,
    // Continue the surrounding logic with this statement.
    `
    SELECT b.id, b.car_id, b.start_date, b.end_date, b.reason, c.name AS car_name,
           (b.start_date AT TIME ZONE 'Europe/Sofia')::date AS start_day
    FROM car_date_blocks b
    JOIN cars c ON c.id = b.car_id
    WHERE b.block_type = 'maintenance'
      AND c.is_deleted = FALSE
      AND (b.start_date AT TIME ZONE 'Europe/Sofia')::date
          BETWEEN (NOW() AT TIME ZONE 'Europe/Sofia')::date
              AND ((NOW() AT TIME ZONE 'Europe/Sofia')::date + 3)
    `
  );

  // Initialize the mutable created variable.
  let created = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the inserted constant.
    const inserted = await enqueue({
      // Provide the type field value.
      type: 'maintenance_reminder',
      // Provide the recipient email field value.
      recipientEmail: adminEmail,
      // Provide the car id field value.
      carId: row.car_id,
      // Provide the payload field value.
      payload: {
        // Provide the car id field value.
        carId: row.car_id,
        // Provide the car name field value.
        carName: row.car_name,
        // Provide the start date field value.
        startDate: row.start_date,
        // Provide the end date field value.
        endDate: row.end_date,
        // Provide the reason field value.
        reason: row.reason,
        // Provide the block id field value.
        blockId: row.id,
      },
      // Provide the idempotency key field value.
      idempotencyKey: `maintenance_reminder:${row.id}:${row.start_day}`,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (inserted) created += 1;
  }
  // Return the resulting value to the caller.
  return created;
}

/**
 * Admin alerts for reservations stuck in paid status past PAID_NOT_CONFIRMED_HOURS.
 * @returns {Promise<number>} Newly inserted notification count
 */
async function enqueuePaidNotConfirmedAlerts() {
  // Create the admin email constant.
  const adminEmail = process.env.ADMIN_EMAIL;
  // Evaluate the condition and enter the branch when it is true.
  if (!adminEmail) return 0;

  // Paid but not confirmed for longer than the ops SLA window.
  const result = await clientQuery(
    // Supply the literal value used by the enclosing expression.
    null,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id, r.email, r.car_id, r.full_name, r.updated_at, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status = 'paid'
      AND r.updated_at <= NOW() - ($1::text || ' hours')::interval
    `,
    // Continue the surrounding logic with this statement.
    [String(PAID_NOT_CONFIRMED_HOURS)]
  );

  // Initialize the mutable created variable.
  let created = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the inserted constant.
    const inserted = await enqueue({
      // Provide the type field value.
      type: 'paid_but_not_confirmed_alert',
      // Provide the recipient email field value.
      recipientEmail: adminEmail,
      // Provide the reservation id field value.
      reservationId: row.id,
      // Provide the car id field value.
      carId: row.car_id,
      // Provide the payload field value.
      payload: {
        // Provide the reservation id field value.
        reservationId: row.id,
        // Provide the email field value.
        email: row.email,
        // Provide the full name field value.
        fullName: row.full_name,
        // Provide the car name field value.
        carName: row.car_name,
      },
      // Provide the idempotency key field value.
      idempotencyKey: `paid_but_not_confirmed_alert:${row.id}`,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (inserted) created += 1;
  }
  // Return the resulting value to the caller.
  return created;
}

/**
 * Run all enqueue scanners once; returns per-type insert counts (or null on error).
 */
async function runNotificationScheduler() {
  // Start a try block for operations that may fail.
  try {
    // Run scanners sequentially so one slow query does not starve others under pool pressure.
    const counts = {
      // Provide the pickup field value.
      pickup: await enqueuePickupReminders(),
      // Return the resulting value to the caller.
      return: await enqueueReturnReminders(),
      // Provide the abandoned field value.
      abandoned: await enqueueAbandonedCheckoutReminders(),
      // Provide the insurance field value.
      insurance: await enqueueExpiringInsuranceAlerts(),
      // Provide the maintenance field value.
      maintenance: await enqueueMaintenanceReminders(),
      // Provide the paid not confirmed field value.
      paidNotConfirmed: await enqueuePaidNotConfirmedAlerts(),
    };
    // Create the total constant.
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // Evaluate the condition and enter the branch when it is true.
    if (total > 0) {
      // Call logger.info to perform this step.
      logger.info({ counts, context: 'notifications.scheduler' }, 'Enqueued notification reminders');
    }
    // Return the resulting value to the caller.
    return counts;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Fail closed for this tick; cron will retry on the next schedule.
    logger.error({ err, context: 'runNotificationScheduler' }, 'Notification scheduler error');
    // Return the resulting value to the caller.
    return null;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  runNotificationScheduler,
  // Contribute this line to the enclosing declaration or statement.
  enqueuePickupReminders,
  // Contribute this line to the enclosing declaration or statement.
  enqueueReturnReminders,
  // Contribute this line to the enclosing declaration or statement.
  enqueueAbandonedCheckoutReminders,
  // Contribute this line to the enclosing declaration or statement.
  enqueueExpiringInsuranceAlerts,
  // Contribute this line to the enclosing declaration or statement.
  enqueueMaintenanceReminders,
  // Contribute this line to the enclosing declaration or statement.
  enqueuePaidNotConfirmedAlerts,
  // Contribute this line to the enclosing declaration or statement.
  ABANDONED_REMINDER_MINUTES,
};
