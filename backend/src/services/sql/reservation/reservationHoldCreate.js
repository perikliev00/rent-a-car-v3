const {
  acquireCarAdvisoryLocks,
  acquireSessionAdvisoryLock,
  clientQuery,
  isActiveSessionHoldUniqueViolation,
  isReservationHoldOverlapViolation,
  isUniqueViolation,
  runWithTransaction,
} = require('../../../db/transaction');
const { HOLD_WINDOW_MS } = require('../../../utils/reservationHelpers');
const { mapSqlReservation, normalizeCarId } = require('./reservationMapper');
const {
  findActiveBySessionId,
  findOverlappingHold,
  findBookedDateOverlap,
} = require('./reservationReadRepository');
const { emptyCreateResult, findSessionHoldRows } = require('./reservationHoldHelpers');
const {
  expireStaleHoldsForCar,
  expireStaleHoldsForSession,
} = require('./reservationHoldExpiry');

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
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session id');
  }

  return runWithTransaction(async (client) => {
    await acquireSessionAdvisoryLock(client, sessionId);

    const sessionHolds = await findSessionHoldRows(sessionId, client);
    await acquireCarAdvisoryLocks(client, [
      ...sessionHolds.map((row) => row.car_id),
      normalizedCarId,
    ]);
    await expireStaleHoldsForSession(sessionId, now, client);

    const existingActiveReservation = await findActiveBySessionId(sessionId, client);
    if (existingActiveReservation) {
      return emptyCreateResult({ existingActiveReservation });
    }

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
      return emptyCreateResult({ overlappingReservation });
    }

    const bookedOverlap = await findBookedDateOverlap(
      normalizedCarId,
      startDate,
      endDate,
      client
    );
    if (bookedOverlap) {
      return emptyCreateResult({ bookedOverlap });
    }

    await client.query('SAVEPOINT hold_insert');
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
      await client.query('RELEASE SAVEPOINT hold_insert');
      return emptyCreateResult({ reservation });
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT hold_insert');

      if (isActiveSessionHoldUniqueViolation(err) || isUniqueViolation(err)) {
        const existing = await findActiveBySessionId(sessionId, client);
        if (existing) {
          return emptyCreateResult({ existingActiveReservation: existing });
        }
      }

      if (isReservationHoldOverlapViolation(err) || isUniqueViolation(err)) {
        const conflictingHold = await findOverlappingHold(holdCriteria, client);
        return emptyCreateResult({
          overlappingReservation: conflictingHold || { id: String(normalizedCarId) },
        });
      }

      throw err;
    }
  });
}

module.exports = {
  createPendingReservation,
  createPendingReservationWithAvailabilityCheck,
};
