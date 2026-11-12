/**
 * Conflict checks for admin order booking: calendar overlaps, active holds,
 * and open physical rentals (picked_up / active_rental).
 */
const reservationRepository = require('../../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { fetchDateBlocksForCar } = require('../../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const { extractStoredRange } = require('./orderMapper');
// Destructure object properties into local variables.
const { OrderFormError } = require('./orderErrors');

// Create the reservation conflict message constant.
const RESERVATION_CONFLICT_MESSAGE =
  // Supply the literal value used by the enclosing expression.
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

/** @param {string|number} carId @param {Date} start @param {Date} end @param {object|null} [client] */
async function findBookedOverlap(carId, start, end, client) {
  // Return the resulting value to the caller.
  return reservationRepository.findBookedDateOverlap(carId, start, end, client);
}

/** Active (non-expired) online hold overlapping the requested range. */
async function findActiveReservationHold(carId, start, end, client) {
  // Return the resulting value to the caller.
  return reservationRepository.findOverlappingHold(
    {
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the start date field value.
      startDate: start,
      // Provide the end date field value.
      endDate: end,
      // Provide the now field value.
      now: new Date(),
    },
    // Reference the identifier used by the enclosing expression.
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
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  start,
  // Contribute this line to the enclosing declaration or statement.
  end,
  // Contribute this line to the enclosing declaration or statement.
  client,
  // Update message with the right-hand side value.
  message = 'Selected car is already booked in the specified period. Please choose different dates or a different car.'
// Continue the surrounding logic with this statement.
) {
  // Create the overlap constant.
  const overlap = await findBookedOverlap(carId, start, end, client);
  // Concurrency / overlap guard (race-sensitive).
  if (overlap) {
    // Throw an error to stop the current control flow.
    throw new OrderFormError('OVERLAP', message);
  }
}

/**
 * Throw RESERVATION_CONFLICT if a checkout hold still covers this range.
 * Prevents admin walk-in orders from stealing a customer's pending hold.
 */
async function assertNoActiveReservationHold(carId, start, end, client) {
  // Create the conflict constant.
  const conflict = await findActiveReservationHold(carId, start, end, client);
  // Concurrency / overlap guard (race-sensitive).
  if (conflict) {
    // Throw an error to stop the current control flow.
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
  // Create the open constant.
  const open = await reservationRepository.findOpenPhysicalRental(carId, client, options);
  // Evaluate the condition and enter the branch when it is true.
  if (open) {
    // Throw an error to stop the current control flow.
    throw new OrderFormError(
      // Supply the literal value used by the enclosing expression.
      'OPEN_PHYSICAL_RENTAL',
      // Continue the surrounding logic with this statement.
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
    // Create the blocks constant.
    const blocks = await fetchDateBlocksForCar(carId, client);
    // Return the resulting value to the caller.
    return extractStoredRange(blocks, prevStart, prevEnd);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
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
  // Create the open physical constant.
  const openPhysical = await reservationRepository.findOpenPhysicalRental(carId);
  // Evaluate the condition and enter the branch when it is true.
  if (openPhysical) {
    // Return the resulting value to the caller.
    return [
      {
        // Provide the code field value.
        code: 'OPEN_PHYSICAL_RENTAL',
        // Provide the start date field value.
        startDate: new Date(openPhysical.pickupDate).toISOString(),
        // Provide the end date field value.
        endDate: new Date(openPhysical.returnDate).toISOString(),
      },
    ];
  }

  // Create the overlap constant.
  const overlap = await findBookedOverlap(carId, start, end);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!overlap) {
    // Return the resulting value to the caller.
    return [];
  }

  // Create the blocks constant.
  const blocks = await fetchDateBlocksForCar(carId);
  // Return the resulting value to the caller.
  return blocks
    // Call .filter to perform this step.
    .filter(
      // Continue the surrounding logic with this statement.
      (block) =>
        // Continue the surrounding logic with this statement.
        new Date(block.startDate) < end && new Date(block.endDate) > start
    )
    // Call .map to perform this step.
    .map((block) => ({
      // Provide the start date field value.
      startDate: new Date(block.startDate).toISOString(),
      // Provide the end date field value.
      endDate: new Date(block.endDate).toISOString(),
    }));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_CONFLICT_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  findBookedOverlap,
  // Contribute this line to the enclosing declaration or statement.
  assertNoBookedOverlap,
  // Contribute this line to the enclosing declaration or statement.
  assertNoActiveReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
  // Contribute this line to the enclosing declaration or statement.
  resolveStoredDateRange,
  // Contribute this line to the enclosing declaration or statement.
  getAvailabilityConflicts,
};
