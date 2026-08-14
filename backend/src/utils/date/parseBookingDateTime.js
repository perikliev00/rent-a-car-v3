const { parseSofiaDate, getTodayInSofia } = require('./timezone');
const { computeRentalDays } = require('./calculateRentalDays');

function validateBookingDates({
  pickupDate,
  returnDate,
  pickupTime = '00:00',
  returnTime = '23:59',
  now = new Date(),
}) {
  const errors = [];
  const start = parseSofiaDate(pickupDate, pickupTime);
  const end = parseSofiaDate(returnDate, returnTime);

  if (
    !start ||
    Number.isNaN(start.getTime()) ||
    !end ||
    Number.isNaN(end.getTime())
  ) {
    errors.push('Invalid date format.');
    return {
      isValid: false,
      errors,
      startDate: null,
      endDate: null,
      rentalDays: null,
    };
  }

  if (start <= now) {
    errors.push('Pick-up time must be later than the current time today');
  }

  const today = getTodayInSofia(now);

  if (start < today || end < today) {
    errors.push('Pick-up and return dates cannot be in the past.');
  }

  if (end <= start) {
    errors.push('Return date must be after pick-up date.');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      startDate: start,
      endDate: end,
      rentalDays: null,
    };
  }

  const rentalDays = computeRentalDays(start, end);

  return {
    isValid: true,
    errors: [],
    startDate: start,
    endDate: end,
    rentalDays,
  };
}

module.exports = {
  validateBookingDates,
};
