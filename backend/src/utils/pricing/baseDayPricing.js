const { round2 } = require('./pricingMath');

function computeDayPrice(car, rentalDays) {
  if (!car) return 0;

  const t1 = car.priceTier_1_3;
  const t7 = car.priceTier_7_31;
  const t31 = car.priceTier_31_plus;

  if (t1 || t7 || t31) {
    if (rentalDays <= 3 && t1) return t1;
    if (rentalDays <= 31 && t7) return t7;
    if (rentalDays > 31 && t31) return t31;
    return car.price || 0;
  }

  return car.price || 0;
}

function buildBaseRentalLine({ dayPrice, rentalDays }) {
  const baseAmount = round2(dayPrice * rentalDays);
  return {
    baseAmount,
    line: {
      code: 'base_rental',
      label: `Base rental (${rentalDays} day${rentalDays === 1 ? '' : 's'} × €${dayPrice})`,
      amount: baseAmount,
      type: 'base',
    },
  };
}

module.exports = {
  computeDayPrice,
  buildBaseRentalLine,
};
