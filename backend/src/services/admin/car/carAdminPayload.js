/**
 * Build create/update car payloads and form redisplay state from admin form bodies.
 * Bridges legacy availability checkbox ↔ fleet status enum.
 */
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

/**
 * Resolve fleet status from explicit status or legacy availability toggle.
 * Turning availability off forces inactive; turning it on only promotes inactive → available
 * so operational statuses (rented, damaged, etc.) are not clobbered.
 * @param {object} payload
 * @param {object|null} [existingCar]
 */
function resolveFleetStatus(payload, existingCar) {
  // Status / lifecycle guard before mutating domain state.
  if (payload.status && CAR_STATUSES.includes(payload.status)) {
    return payload.status;
  }

  const hasAvailability = Object.prototype.hasOwnProperty.call(payload, 'availability');
  const availabilityOn = hasAvailability
    ? payload.availability === 'on' || payload.availability === true || payload.availability === 'true'
    : null;

  // Idempotency guard: return early when work was already applied.
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

/**
 * Merge body over existing car for form redisplay after validation errors.
 * @param {object} [body]
 * @param {object|null} [existingCar]
 */
function buildCarFormState(body = {}, existingCar = null) {
  const car = existingCar ?? {};

  const pick = (key, fallback = '') => {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== '') {
      return body[key];
    }
    // Idempotency guard: return early when work was already applied.
    if (existingCar && car[key] !== undefined) {
      return car[key];
    }
    return fallback;
  };

  const pickAvailability = () => {
    if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
      return body.availability === 'on';
    }
    // Idempotency guard: return early when work was already applied.
    if (existingCar) return !!car.availability;
    return true;
  };

  const pickTier = (key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key] === '' ? undefined : body[key];
    }
    // Idempotency guard: return early when work was already applied.
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

/**
 * Validate and assemble the repository create/update payload (tiers, image, fleet fields).
 * @param {object} payload
 * @param {object|null} file
 * @param {object|null} [existingCar]
 */
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
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error('Seats must be a positive number.');
  }

  const price =
    derivedBase !== undefined
      ? derivedBase
      : existingCar
        ? existingCar.price
        : undefined;

  // Guard: early-return or throw when required input is missing/invalid.
  if (price === undefined) {
    throw new Error('At least one price tier is required.');
  }

  const image = file
    ? buildImagePath(file)
    : existingCar
      ? existingCar.image
      : buildImagePath(file);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!image) {
    throw new Error('Car image is required.');
  }

  const status = resolveFleetStatus(payload, existingCar);
  const fuelLevel = emptyToNull(payload.fuelLevel);
  // Guard: early-return or throw when required input is missing/invalid.
  if (fuelLevel && !FUEL_LEVELS.includes(fuelLevel)) {
    throw new Error('Invalid fuel level.');
  }

  const pickFleet = (key, existingKey = key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      return emptyToNull(payload[key]);
    }
    // Idempotency guard: return early when work was already applied.
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
