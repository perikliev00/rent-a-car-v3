const { DELIVERY_FEES } = require('../../constants/locations');
const { round2 } = require('./pricingMath');

function feeFromConfig(config, location) {
  if (!location) return 0;
  if (config?.deliveryFeeMap && config.deliveryFeeMap[location] != null) {
    return Number(config.deliveryFeeMap[location]) || 0;
  }
  return DELIVERY_FEES[location] ?? 0;
}

function globalFee(config, key) {
  return (config.globalFees || []).find((f) => f.feeKey === key && f.active);
}

function applyDeliveryAndExtrasLines({
  cfg,
  pickupLocation,
  returnLocation,
  hotelDelivery,
  rentalDays,
  codes,
}) {
  const lines = [];

  // Delivery / return
  const deliveryPrice = feeFromConfig(cfg, pickupLocation);
  const returnPrice = feeFromConfig(cfg, returnLocation);
  if (deliveryPrice) {
    lines.push({
      code: 'delivery_pickup',
      label: `Delivery (${pickupLocation})`,
      amount: deliveryPrice,
      type: 'fee',
    });
  }
  if (returnPrice) {
    lines.push({
      code: 'delivery_return',
      label: `Return (${returnLocation})`,
      amount: returnPrice,
      type: 'fee',
    });
  }

  // Hotel delivery
  if (hotelDelivery) {
    const hotel = globalFee(cfg, 'hotel_delivery');
    if (hotel) {
      const amount =
        hotel.mode === 'per_day' ? round2(hotel.amount * rentalDays) : round2(hotel.amount);
      if (amount) {
        lines.push({
          code: 'hotel_delivery',
          label: hotel.label,
          amount,
          type: 'fee',
        });
      }
    }
  }

  // Selected extras
  const catalog = cfg.extras || [];
  for (const code of codes) {
    const extra = catalog.find((e) => e.code === code && e.active);
    if (!extra) continue;
    const amount =
      extra.mode === 'per_day' ? round2(extra.amount * rentalDays) : round2(extra.amount);
    if (!amount) continue;
    lines.push({
      code: `extra_${extra.code}`,
      label: extra.label,
      amount,
      type: 'addon',
    });
  }

  return { deliveryPrice, returnPrice, lines };
}

function applyLateAndFuelLines({ cfg, lateReturn, fuelFee, rentalDays }) {
  const lines = [];

  if (lateReturn) {
    const late = globalFee(cfg, 'late_return');
    if (late) {
      const amount =
        late.mode === 'per_day' ? round2(late.amount * rentalDays) : round2(late.amount);
      if (amount) {
        lines.push({ code: 'late_return', label: late.label, amount, type: 'fee' });
      }
    }
  }

  if (fuelFee) {
    const fuel = globalFee(cfg, 'fuel');
    if (fuel) {
      const amount =
        fuel.mode === 'per_day' ? round2(fuel.amount * rentalDays) : round2(fuel.amount);
      if (amount) {
        lines.push({ code: 'fuel', label: fuel.label, amount, type: 'fee' });
      }
    }
  }

  return { lines };
}

module.exports = {
  feeFromConfig,
  applyDeliveryAndExtrasLines,
  applyLateAndFuelLines,
};
