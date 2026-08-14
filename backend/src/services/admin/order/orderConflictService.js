const reservationRepository = require('../../../repositories/reservationRepository');
const { fetchDateBlocksForCar } = require('../../sql/bookingSyncSqlService');
const { extractStoredRange } = require('./orderMapper');
const { OrderFormError } = require('./orderErrors');

const RESERVATION_CONFLICT_MESSAGE =
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

async function findBookedOverlap(carId, start, end, client) {
  return reservationRepository.findBookedDateOverlap(carId, start, end, client);
}

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

async function assertNoBookedOverlap(
  carId,
  start,
  end,
  client,
  message = 'Selected car is already booked in the specified period. Please choose different dates or a different car.'
) {
  const overlap = await findBookedOverlap(carId, start, end, client);
  if (overlap) {
    throw new OrderFormError('OVERLAP', message);
  }
}

async function assertNoActiveReservationHold(carId, start, end, client) {
  const conflict = await findActiveReservationHold(carId, start, end, client);
  if (conflict) {
    throw new OrderFormError('RESERVATION_CONFLICT', RESERVATION_CONFLICT_MESSAGE);
  }
}

async function resolveStoredDateRange(carId, prevStart, prevEnd, client) {
  try {
    const blocks = await fetchDateBlocksForCar(carId, client);
    return extractStoredRange(blocks, prevStart, prevEnd);
  } catch {
    return { storedStart: prevStart, storedEnd: prevEnd };
  }
}

async function getAvailabilityConflicts(carId, start, end) {
  const overlap = await findBookedOverlap(carId, start, end);
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
  resolveStoredDateRange,
  getAvailabilityConflicts,
};
