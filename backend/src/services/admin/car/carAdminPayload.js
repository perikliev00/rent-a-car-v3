const { CAR_STATUSES, FUEL_LEVELS } = require('../../../constants/carEnums');
const {
  parsePriceTier,
  parseCategoryId,
  resolveCategoryId,
  deriveBasePrice,
  buildImagePath,
  emptyToNull,
  parseOptionalInt,
} = require('./carAdminHelpers');

function resolveFleetStatus(payload, existingCar) {
  if (payload.status && CAR_STATUSES.includes(payload.status)) {
    return payload.status;
  }

  const hasAvailability = Object.prototype.hasOwnProperty.call(payload, 'availability');
  const availabilityOn = hasAvailability
    ? payload.availability === 'on' || payload.availability === true || payload.availability === 'true'
    : null;

  if (existingCar) {
    const current = existingCar.status || (existingCar.availability ? 'available' : 'inactive');
    if (availabilityOn === false) return 'inactive';
    if (availabilityOn === true) {
      if (current === 'inactive') return 'available';
      return current;
    }
    return current;
  }

  if (availabilityOn === false) return 'inactive';
  return 'available';
}

function buildCarFormState(body = {}, existingCar = null) {
  const car = existingCar ?? {};

  const pick = (key, fallback = '') => {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== '') {
      return body[key];
    }
    if (existingCar && car[key] !== undefined) {
      return car[key];
    }
    return fallback;
  };

  const pickAvailability = () => {
    if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
      return body.availability === 'on';
    }
    if (existingCar) return !!car.availability;
    return true;
  };

  const pickTier = (key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key] === '' ? undefined : body[key];
    }
    if (existingCar && car[key] !== undefined) return car[key];
    return undefined;
  };

  const base = existingCar
    ? { id: car.id, image: car.image, price: car.price }
    : {};

  return {
    ...base,
    name: pick('name', ''),
    transmission: pick('transmission', ''),
    seats: pick('seats', ''),
    fuelType: pick('fuelType', ''),
    availability: pickAvailability(),
    priceTier_1_3: pickTier('priceTier_1_3'),
    priceTier_7_31: pickTier('priceTier_7_31'),
    priceTier_31_plus: pickTier('priceTier_31_plus'),
    categoryId: Object.prototype.hasOwnProperty.call(body, 'categoryId')
      ? parseCategoryId(body.categoryId)
      : existingCar?.categoryId ?? null,
  };
}

function buildCarPayload(payload, file, existingCar = null) {
  const tierShort = parsePriceTier(payload.priceTier_1_3);
  const tierMedium = parsePriceTier(payload.priceTier_7_31);
  const tierLong = parsePriceTier(payload.priceTier_31_plus);

  const finalTierShort =
    tierShort !== undefined
      ? tierShort
      : existingCar
        ? existingCar.priceTier_1_3
        : undefined;
  const finalTierMedium =
    tierMedium !== undefined
      ? tierMedium
      : existingCar
        ? existingCar.priceTier_7_31
        : undefined;
  const finalTierLong =
    tierLong !== undefined
      ? tierLong
      : existingCar
        ? existingCar.priceTier_31_plus
        : undefined;

  const derivedBase = deriveBasePrice({
    tierShort: finalTierShort,
    tierMedium: finalTierMedium,
    tierLong: finalTierLong,
  });

  const seats = parseInt(payload.seats, 10);
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error('Seats must be a positive number.');
  }

  const price =
    derivedBase !== undefined
      ? derivedBase
      : existingCar
        ? existingCar.price
        : undefined;

  if (price === undefined) {
    throw new Error('At least one price tier is required.');
  }

  const image = file
    ? buildImagePath(file)
    : existingCar
      ? existingCar.image
      : buildImagePath(file);

  if (!image) {
    throw new Error('Car image is required.');
  }

  const status = resolveFleetStatus(payload, existingCar);
  const fuelLevel = emptyToNull(payload.fuelLevel);
  if (fuelLevel && !FUEL_LEVELS.includes(fuelLevel)) {
    throw new Error('Invalid fuel level.');
  }

  const pickFleet = (key, existingKey = key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      return emptyToNull(payload[key]);
    }
    if (existingCar && existingCar[existingKey] !== undefined) {
      return existingCar[existingKey] ?? null;
    }
    return null;
  };

  return {
    name: payload.name,
    transmission: payload.transmission,
    seats,
    fuelType: payload.fuelType,
    price,
    priceTier_1_3: finalTierShort,
    priceTier_7_31: finalTierMedium,
    priceTier_31_plus: finalTierLong,
    image,
    status,
    availability: status === 'available',
    registrationNumber: pickFleet('registrationNumber'),
    vin: pickFleet('vin'),
    mileage: Object.prototype.hasOwnProperty.call(payload, 'mileage')
      ? parseOptionalInt(payload.mileage)
      : existingCar?.mileage ?? null,
    fuelLevel: Object.prototype.hasOwnProperty.call(payload, 'fuelLevel')
      ? fuelLevel
      : existingCar?.fuelLevel ?? null,
    currentLocation: pickFleet('currentLocation'),
    insuranceExpiry: pickFleet('insuranceExpiry'),
    technicalInspectionExpiry: pickFleet('technicalInspectionExpiry'),
    categoryId: resolveCategoryId(payload, existingCar),
  };
}

module.exports = {
  resolveFleetStatus,
  buildCarFormState,
  buildCarPayload,
};
