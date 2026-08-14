const { round2 } = require('./pricingMath');

function buildEmptyPriceResult() {
  return {
    currency: 'EUR',
    rentalDays: 0,
    dayPrice: 0,
    unitPrice: 0,
    deliveryPrice: 0,
    returnPrice: 0,
    lines: [],
    totalPrice: 0,
    deposit: 0,
    priceBreakdown: { lines: [], totalPrice: 0, deposit: 0, currency: 'EUR' },
    snapshot: null,
  };
}

function buildPriceResult({
  rentalDays,
  dayPrice,
  deliveryPrice,
  returnPrice,
  lines,
  deposit,
  pickupLocation,
  returnLocation,
  hotelDelivery,
  selectedExtras,
  lateReturn,
  fuelFee,
  bookedAt,
}) {
  const totalPrice = round2(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));

  const snapshot = {
    currency: 'EUR',
    rentalDays,
    dayPrice,
    pickupLocation,
    returnLocation,
    hotelDelivery: Boolean(hotelDelivery),
    selectedExtras,
    lateReturn: Boolean(lateReturn),
    fuelFee: Boolean(fuelFee),
    bookedAt: (bookedAt instanceof Date ? bookedAt : new Date()).toISOString(),
    lines,
    totalPrice,
    deposit,
    deliveryPrice,
    returnPrice,
  };

  return {
    currency: 'EUR',
    rentalDays,
    dayPrice,
    unitPrice: dayPrice,
    deliveryPrice,
    returnPrice,
    lines,
    totalPrice,
    deposit,
    priceBreakdown: { lines, totalPrice, deposit, currency: 'EUR' },
    snapshot,
  };
}

module.exports = {
  buildEmptyPriceResult,
  buildPriceResult,
};
