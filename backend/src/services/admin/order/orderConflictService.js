/**
 * Conflict checks for admin order booking: calendar overlaps, active holds,
 * and open physical rentals (picked_up / active_rental).
 */
const reservationRepository = require('../../../repositories/reservationRepository');
const { fetchDateBlocksForCar } = require('../../sql/bookingSyncSqlService');
const { extractStoredRange } = require('./orderMapper');
const { OrderFormError } = require('./orderErrors');

const RESERVATION_CONFLICT_MESSAGE =
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

/** @param {string|number} carId @param {Date} start @param {Date} end @param {object|null} [client] */
async function findBookedOverlap(carId, start, end, client) {
  return reservationRepository.findBookedDateOverlap(carId, start, end, client);
}

/** Active (non-expired) online hold overlapping the requested range. */
async function findActiveReservationHold(carId, start, end, client) {
  return reservationRepository.findOverlappingHold(
    {
      carId,
      startDate: start,
      endDate: end,
      now: new Date(),
    },
    client
  );
}

/**
 * Throw OVERLAP if another booking already owns these dates.
 * @param {string|number} carId
 * @param {Date} start
 * @param {Date} end
 * @param {object|null} client
 * @param {string} [message]
 */
async function assertNoBookedOverlap(
  carId,
  start,
  end,
  client,
  message = 'Selected car is already booked in the specified period. Please choose different dates or a different car.'
) {
  const overlap = await findBookedOverlap(carId, start, end, client);
  // Concurrency / overlap guard (race-sensitive).
  if (overlap) {
    throw new OrderFormError('OVERLAP', message);
  }
}

/**
 * Throw RESERVATION_CONFLICT if a checkout hold still covers this range.
 * Prevents admin walk-in orders from stealing a customer's pending hold.
 */
async function assertNoActiveReservationHold(carId, start, end, client) {
  const conflict = await findActiveReservationHold(carId, start, end, client);
  // Concurrency / overlap guard (race-sensitive).
  if (conflict) {
    throw new OrderFormError('RESERVATION_CONFLICT', RESERVATION_CONFLICT_MESSAGE);
  }
}

/**
 * Block new bookings while the car is physically out (picked_up / active_rental).
 * @param {string|number} carId
 * @param {object|null} client
 * @param {object} [options] May excludeReservationId when confirming that rental
 */
async function assertNoOpenPhysicalRental(carId, client, options = {}) {
  const open = await reservationRepository.findOpenPhysicalRental(carId, client, options);
  if (open) {
    throw new OrderFormError(
      'OPEN_PHYSICAL_RENTAL',
      'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
    );
  }
}

/**
 * Locate the stored calendar block for an order's previous range (for removeRange).
 * Falls back to prevStart/prevEnd if date blocks cannot be loaded.
 */
async function resolveStoredDateRange(carId, prevStart, prevEnd, client) {
  // Protected block: isolate failure modes.
  try {
    const blocks = await fetchDateBlocksForCar(carId, client);
    return extractStoredRange(blocks, prevStart, prevEnd);
  } catch {
    return { storedStart: prevStart, storedEnd: prevEnd };
  }
}

/**
 * Non-throwing conflict probe for the availability UI (open rental or date blocks).
 * @param {string|number} carId
 * @param {Date} start
 * @param {Date} end
 */
async function getAvailabilityConflicts(carId, start, end) {
  const openPhysical = await reservationRepository.findOpenPhysicalRental(carId);
  if (openPhysical) {
    return [
      {
        code: 'OPEN_PHYSICAL_RENTAL',
        startDate: new Date(openPhysical.pickupDate).toISOString(),
        endDate: new Date(openPhysical.returnDate).toISOString(),
      },
    ];
  }

  const overlap = await findBookedOverlap(carId, start, end);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!overlap) {
    return [];
  }

  const blocks = await fetchDateBlocksForCar(carId);
  return blocks
    .filter(
      (block) =>
        new Date(block.startDate) < end && new Date(block.endDate) > start
    )
    .map((block) => ({
      startDate: new Date(block.startDate).toISOString(),
      endDate: new Date(block.endDate).toISOString(),
    }));
}

module.exports = {
  RESERVATION_CONFLICT_MESSAGE,
  findBookedOverlap,
  assertNoBookedOverlap,
  assertNoActiveReservationHold,
  assertNoOpenPhysicalRental,
  resolveStoredDateRange,
  getAvailabilityConflicts,
};
