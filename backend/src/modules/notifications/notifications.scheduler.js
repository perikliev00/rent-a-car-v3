const { clientQuery } = require('../../db/transaction');
const { enqueue } = require('./notifications.enqueue');
const { RESERVATION_HOLD_MINUTES } = require('../../config/reservationTiming');
const logger = require('../../utils/logger');

const ABANDONED_REMINDER_MINUTES = Math.max(RESERVATION_HOLD_MINUTES - 10, 15);
const PAID_NOT_CONFIRMED_HOURS = 2;
const INSURANCE_ALERT_DAYS = 14;

async function enqueuePickupReminders() {
  const result = await clientQuery(
    null,
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

  let created = 0;
  for (const row of result.rows) {
    const inserted = await enqueue({
      type: 'pickup_reminder',
      recipientEmail: row.email,
      reservationId: row.id,
      carId: row.car_id,
      payload: {
        reservationId: row.id,
        fullName: row.full_name,
        carName: row.car_name,
        pickupDate: row.pickup_date,
        pickupTime: row.pickup_time,
        pickupLocation: row.pickup_location,
        returnDate: row.return_date,
        returnLocation: row.return_location,
        totalPrice: row.total_price,
      },
      idempotencyKey: `pickup_reminder:${row.id}:${row.pickup_day}`,
    });
    if (inserted) created += 1;
  }
  return created;
}

async function enqueueReturnReminders() {
  const result = await clientQuery(
    null,
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

  let created = 0;
  for (const row of result.rows) {
    const inserted = await enqueue({
      type: 'return_reminder',
      recipientEmail: row.email,
      reservationId: row.id,
      carId: row.car_id,
      payload: {
        reservationId: row.id,
        fullName: row.full_name,
        carName: row.car_name,
        pickupDate: row.pickup_date,
        returnDate: row.return_date,
        returnTime: row.return_time,
        pickupLocation: row.pickup_location,
        returnLocation: row.return_location,
        totalPrice: row.total_price,
      },
      idempotencyKey: `return_reminder:${row.id}:${row.return_day}`,
    });
    if (inserted) created += 1;
  }
  return created;
}

async function enqueueAbandonedCheckoutReminders() {
  const result = await clientQuery(
    null,
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
    [String(ABANDONED_REMINDER_MINUTES)]
  );

  let created = 0;
  for (const row of result.rows) {
    const inserted = await enqueue({
      type: 'abandoned_checkout_reminder',
      recipientEmail: row.email,
      reservationId: row.id,
      carId: row.car_id,
      payload: {
        reservationId: row.id,
        fullName: row.full_name,
        carName: row.car_name,
        pickupDate: row.pickup_date,
        returnDate: row.return_date,
        pickupLocation: row.pickup_location,
        returnLocation: row.return_location,
        totalPrice: row.total_price,
      },
      idempotencyKey: `abandoned_checkout_reminder:${row.id}`,
    });
    if (inserted) created += 1;
  }
  return created;
}

async function enqueueExpiringInsuranceAlerts() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return 0;

  const result = await clientQuery(
    null,
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
    [String(INSURANCE_ALERT_DAYS)]
  );

  let created = 0;
  for (const row of result.rows) {
    const inserted = await enqueue({
      type: 'expiring_insurance_alert',
      recipientEmail: adminEmail,
      carId: row.car_id,
      payload: {
        carId: row.car_id,
        carName: row.car_name,
        itemType: row.item_type,
        itemTitle: row.title,
        expiresAt: row.expires_at,
        complianceId: row.id,
      },
      idempotencyKey: `expiring_insurance_alert:${row.id}:${row.expires_at}`,
    });
    if (inserted) created += 1;
  }
  return created;
}

async function enqueueMaintenanceReminders() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return 0;

  const result = await clientQuery(
    null,
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

  let created = 0;
  for (const row of result.rows) {
    const inserted = await enqueue({
      type: 'maintenance_reminder',
      recipientEmail: adminEmail,
      carId: row.car_id,
      payload: {
        carId: row.car_id,
        carName: row.car_name,
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason,
        blockId: row.id,
      },
      idempotencyKey: `maintenance_reminder:${row.id}:${row.start_day}`,
    });
    if (inserted) created += 1;
  }
  return created;
}

async function enqueuePaidNotConfirmedAlerts() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return 0;

  const result = await clientQuery(
    null,
    `
    SELECT r.id, r.email, r.car_id, r.full_name, r.updated_at, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status = 'paid'
      AND r.updated_at <= NOW() - ($1::text || ' hours')::interval
    `,
    [String(PAID_NOT_CONFIRMED_HOURS)]
  );

  let created = 0;
  for (const row of result.rows) {
    const inserted = await enqueue({
      type: 'paid_but_not_confirmed_alert',
      recipientEmail: adminEmail,
      reservationId: row.id,
      carId: row.car_id,
      payload: {
        reservationId: row.id,
        email: row.email,
        fullName: row.full_name,
        carName: row.car_name,
      },
      idempotencyKey: `paid_but_not_confirmed_alert:${row.id}`,
    });
    if (inserted) created += 1;
  }
  return created;
}

async function runNotificationScheduler() {
  try {
    const counts = {
      pickup: await enqueuePickupReminders(),
      return: await enqueueReturnReminders(),
      abandoned: await enqueueAbandonedCheckoutReminders(),
      insurance: await enqueueExpiringInsuranceAlerts(),
      maintenance: await enqueueMaintenanceReminders(),
      paidNotConfirmed: await enqueuePaidNotConfirmedAlerts(),
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) {
      logger.info({ counts, context: 'notifications.scheduler' }, 'Enqueued notification reminders');
    }
    return counts;
  } catch (err) {
    logger.error({ err, context: 'runNotificationScheduler' }, 'Notification scheduler error');
    return null;
  }
}

module.exports = {
  runNotificationScheduler,
  enqueuePickupReminders,
  enqueueReturnReminders,
  enqueueAbandonedCheckoutReminders,
  enqueueExpiringInsuranceAlerts,
  enqueueMaintenanceReminders,
  enqueuePaidNotConfirmedAlerts,
  ABANDONED_REMINDER_MINUTES,
};
