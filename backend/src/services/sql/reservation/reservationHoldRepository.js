const {
  acquireCarAdvisoryLock,
  clientQuery,
  isReservationHoldOverlapViolation,
  runWithTransaction,
} = require('../../../db/transaction');
const {
  ACTIVE_RESERVATION_STATUSES,
  HOLD_WINDOW_MS,
} = require('../../../utils/reservationHelpers');
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');
const {
  findOverlappingHold,
  findBookedDateOverlap,
} = require('./reservationReadRepository');

/** Marks expired holds for one car so they leave the partial exclusion constraint. */
async function expireStaleHoldsForCar(carId, now = new Date(), client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE car_id = $1
        AND status = ANY($3::text[])
        AND hold_expires_at <= $2
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'hold_expired'
    FROM updated
    RETURNING reservation_id
    `,
    [normalizedCarId, now, ACTIVE_RESERVATION_STATUSES]
  );

  return result.rowCount || 0;
}

async function createPendingReservation(
  {
    carId,
    sessionId,
    startDate,
    endDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pricing,
    contact = {},
    userId = null,
  },
  client = null
) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const {
    fullName = '',
    phoneNumber = '',
    email = '',
    address = '',
    hotelName = '',
  } = contact;

  const rawUserId = userId != null ? Number(userId) : Number(contact.userId);
  const normalizedUserId =
    Number.isInteger(rawUserId) && rawUserId > 0 ? rawUserId : null;

  const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
  const snapshotJson = pricing.snapshot ? JSON.stringify(pricing.snapshot) : null;
  const extrasJson = JSON.stringify(
    pricing.snapshot?.selectedExtras || pricing.selectedExtras || []
  );

  const result = await clientQuery(
    client,
    `
    INSERT INTO reservations (
      car_id,
      session_id,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      pickup_location,
      return_location,
      rental_days,
      delivery_price,
      return_price,
      total_price,
      deposit,
      price_snapshot,
      selected_extras,
      hotel_delivery,
      full_name,
      phone_number,
      email,
      address,
      hotel_name,
      user_id,
      status,
      hold_expires_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16,
      $17, $18, $19, $20, $21, $22,
      'pending_payment', $23
    )
    RETURNING *
    `,
    [
      normalizedCarId,
      sessionId,
      startDate,
      pickupTime || null,
      endDate,
      returnTime || null,
      pickupLocation,
      returnLocation,
      pricing.rentalDays,
      pricing.deliveryPrice ?? 0,
      pricing.returnPrice ?? 0,
      pricing.totalPrice,
      pricing.deposit ?? 0,
      snapshotJson,
      extrasJson,
      Boolean(pricing.snapshot?.hotelDelivery || pricing.hotelDelivery),
      fullName || null,
      phoneNumber || null,
      email || null,
      address || null,
      hotelName || null,
      normalizedUserId,
      holdExpiresAt,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

async function createPendingReservationWithAvailabilityCheck({
  carId,
  sessionId,
  startDate,
  endDate,
  pickupTime,
  returnTime,
  pickupLocation,
  returnLocation,
  pricing,
  contact = {},
  userId = null,
  now = new Date(),
  excludeSessionId = null,
}) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  return runWithTransaction(async (client) => {
    await acquireCarAdvisoryLock(client, normalizedCarId);
    await expireStaleHoldsForCar(normalizedCarId, now, client);

    const holdCriteria = {
      carId: normalizedCarId,
      startDate,
      endDate,
      now,
      excludeSessionId,
    };

    const overlappingReservation = await findOverlappingHold(holdCriteria, client);
    if (overlappingReservation) {
      return { reservation: null, overlappingReservation, bookedOverlap: null };
    }

    const bookedOverlap = await findBookedDateOverlap(
      normalizedCarId,
      startDate,
      endDate,
      client
    );
    if (bookedOverlap) {
      return { reservation: null, overlappingReservation: null, bookedOverlap };
    }

    try {
      const reservation = await createPendingReservation(
        {
          carId: normalizedCarId,
          sessionId,
          startDate,
          endDate,
          pickupTime,
          returnTime,
          pickupLocation,
          returnLocation,
          pricing,
          contact,
          userId,
        },
        client
      );

      return { reservation, overlappingReservation: null, bookedOverlap: null };
    } catch (err) {
      if (!isReservationHoldOverlapViolation(err)) {
        throw err;
      }

      const conflictingHold = await findOverlappingHold(holdCriteria, client);
      return {
        reservation: null,
        overlappingReservation: conflictingHold || { id: String(normalizedCarId) },
        bookedOverlap: null,
      };
    }
  });
}

async function markReservationExpired(reservationId, now = new Date(), client = null) {
  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT id, status AS old_status
      FROM reservations
      WHERE id = $1
        AND status = 'processing_payment'
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'stripe_session_expired'
    FROM updated
    RETURNING reservation_id
    `,
    [reservationId, now]
  );

  return (result.rowCount || 0) > 0;
}

async function markAbandonedReservations(activeSessionIds, now = new Date(), client = null) {
  const params = [ACTIVE_RESERVATION_STATUSES, now];
  const abandonConditions = ['r.hold_expires_at <= $2', 'r.session_id IS NULL'];

  if (activeSessionIds.length) {
    params.push(activeSessionIds);
    abandonConditions.push(`r.session_id <> ALL($${params.length}::text[])`);
  }

  const result = await clientQuery(
    client,
    `
    WITH to_expire AS (
      SELECT r.id, r.status AS old_status
      FROM reservations r
      WHERE r.status = ANY($1::text[])
        AND NOT (r.status = 'processing_payment' AND r.stripe_session_id IS NOT NULL)
        AND (${abandonConditions.join(' OR ')})
      FOR UPDATE
    ),
    updated AS (
      UPDATE reservations r
      SET status = 'expired',
          hold_expires_at = $2,
          updated_at = $2
      FROM to_expire t
      WHERE r.id = t.id
      RETURNING r.id, t.old_status
    )
    INSERT INTO reservation_status_history (
      reservation_id, old_status, new_status, changed_by_system, reason
    )
    SELECT id, old_status, 'expired', TRUE, 'abandoned_hold'
    FROM updated
    RETURNING reservation_id
    `,
    params
  );

  const reservationIds = (result.rows || [])
    .map((row) => (row.reservation_id != null ? String(row.reservation_id) : null))
    .filter(Boolean);

  return { count: reservationIds.length || result.rowCount || 0, reservationIds };
}

module.exports = {
  expireStaleHoldsForCar,
  createPendingReservation,
  createPendingReservationWithAvailabilityCheck,
  markReservationExpired,
  markAbandonedReservations,
};
