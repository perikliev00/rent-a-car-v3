/**
 * Build create/update car payloads and form redisplay state from admin form bodies.
 * Bridges legacy availability checkbox ↔ fleet status enum.
 */
const { CAR_STATUSES, FUEL_LEVELS } = require('../../../constants/carEnums');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parsePriceTier,
  // Contribute this line to the enclosing declaration or statement.
  parseCategoryId,
  // Contribute this line to the enclosing declaration or statement.
  resolveCategoryId,
  // Contribute this line to the enclosing declaration or statement.
  deriveBasePrice,
  // Contribute this line to the enclosing declaration or statement.
  buildImagePath,
  // Contribute this line to the enclosing declaration or statement.
  emptyToNull,
  // Contribute this line to the enclosing declaration or statement.
  parseOptionalInt,
// Continue the surrounding logic with this statement.
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
    // Return the resulting value to the caller.
    return payload.status;
  }

  // Create the has availability constant.
  const hasAvailability = Object.prototype.hasOwnProperty.call(payload, 'availability');
  // Create the availability on constant.
  const availabilityOn = hasAvailability
    // Continue the surrounding logic with this statement.
    ? payload.availability === 'on' || payload.availability === true || payload.availability === 'true'
    // Contribute this line to the enclosing declaration or statement.
    : null;

  // Idempotency guard: return early when work was already applied.
  if (existingCar) {
    // Create the current constant.
    const current = existingCar.status || (existingCar.availability ? 'available' : 'inactive');
    // Evaluate the condition and enter the branch when it is true.
    if (availabilityOn === false) return 'inactive';
    // Evaluate the condition and enter the branch when it is true.
    if (availabilityOn === true) {
      // Evaluate the condition and enter the branch when it is true.
      if (current === 'inactive') return 'available';
      // Return the resulting value to the caller.
      return current;
    }
    // Return the resulting value to the caller.
    return current;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (availabilityOn === false) return 'inactive';
  // Return the resulting value to the caller.
  return 'available';
}

/**
 * Merge body over existing car for form redisplay after validation errors.
 * @param {object} [body]
 * @param {object|null} [existingCar]
 */
function buildCarFormState(body = {}, existingCar = null) {
  // Create the car constant.
  const car = existingCar ?? {};

  // Create the pick constant.
  const pick = (key, fallback = '') => {
    // Evaluate the condition and enter the branch when it is true.
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== '') {
      // Return the resulting value to the caller.
      return body[key];
    }
    // Idempotency guard: return early when work was already applied.
    if (existingCar && car[key] !== undefined) {
      // Return the resulting value to the caller.
      return car[key];
    }
    // Return the resulting value to the caller.
    return fallback;
  };

  // Create the pick availability constant.
  const pickAvailability = () => {
    // Evaluate the condition and enter the branch when it is true.
    if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
      // Return the resulting value to the caller.
      return body.availability === 'on';
    }
    // Idempotency guard: return early when work was already applied.
    if (existingCar) return !!car.availability;
    // Return the resulting value to the caller.
    return true;
  };

  // Create the pick tier constant.
  const pickTier = (key) => {
    // Evaluate the condition and enter the branch when it is true.
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      // Return the resulting value to the caller.
      return body[key] === '' ? undefined : body[key];
    }
    // Idempotency guard: return early when work was already applied.
    if (existingCar && car[key] !== undefined) return car[key];
    // Return the resulting value to the caller.
    return undefined;
  };

  // Create the base constant.
  const base = existingCar
    // Contribute this line to the enclosing declaration or statement.
    ? { id: car.id, image: car.image, price: car.price }
    // Contribute this line to the enclosing declaration or statement.
    : {};

  // Return the resulting value to the caller.
  return {
    // Spread base into the surrounding structure.
    ...base,
    // Provide the name field value.
    name: pick('name', ''),
    // Provide the transmission field value.
    transmission: pick('transmission', ''),
    // Provide the seats field value.
    seats: pick('seats', ''),
    // Provide the fuel type field value.
    fuelType: pick('fuelType', ''),
    // Provide the availability field value.
    availability: pickAvailability(),
    // Provide the price tier 1 3 field value.
    priceTier_1_3: pickTier('priceTier_1_3'),
    // Provide the price tier 7 31 field value.
    priceTier_7_31: pickTier('priceTier_7_31'),
    // Provide the price tier 31 plus field value.
    priceTier_31_plus: pickTier('priceTier_31_plus'),
    // Provide the category id field value.
    categoryId: Object.prototype.hasOwnProperty.call(body, 'categoryId')
      // Continue the surrounding logic with this statement.
      ? parseCategoryId(body.categoryId)
      // Contribute this line to the enclosing declaration or statement.
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
  // Create the tier short constant.
  const tierShort = parsePriceTier(payload.priceTier_1_3);
  // Create the tier medium constant.
  const tierMedium = parsePriceTier(payload.priceTier_7_31);
  // Create the tier long constant.
  const tierLong = parsePriceTier(payload.priceTier_31_plus);

  // Create the final tier short constant.
  const finalTierShort =
    // Continue the surrounding logic with this statement.
    tierShort !== undefined
      // Contribute this line to the enclosing declaration or statement.
      ? tierShort
      // Contribute this line to the enclosing declaration or statement.
      : existingCar
        // Contribute this line to the enclosing declaration or statement.
        ? existingCar.priceTier_1_3
        // Contribute this line to the enclosing declaration or statement.
        : undefined;
  // Create the final tier medium constant.
  const finalTierMedium =
    // Continue the surrounding logic with this statement.
    tierMedium !== undefined
      // Contribute this line to the enclosing declaration or statement.
      ? tierMedium
      // Contribute this line to the enclosing declaration or statement.
      : existingCar
        // Contribute this line to the enclosing declaration or statement.
        ? existingCar.priceTier_7_31
        // Contribute this line to the enclosing declaration or statement.
        : undefined;
  // Create the final tier long constant.
  const finalTierLong =
    // Continue the surrounding logic with this statement.
    tierLong !== undefined
      // Contribute this line to the enclosing declaration or statement.
      ? tierLong
      // Contribute this line to the enclosing declaration or statement.
      : existingCar
        // Contribute this line to the enclosing declaration or statement.
        ? existingCar.priceTier_31_plus
        // Contribute this line to the enclosing declaration or statement.
        : undefined;

  // Create the derived base constant.
  const derivedBase = deriveBasePrice({
    // Provide the tier short field value.
    tierShort: finalTierShort,
    // Provide the tier medium field value.
    tierMedium: finalTierMedium,
    // Provide the tier long field value.
    tierLong: finalTierLong,
  });

  // Create the seats constant.
  const seats = parseInt(payload.seats, 10);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(seats) || seats <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Seats must be a positive number.');
  }

  // Create the price constant.
  const price =
    // Continue the surrounding logic with this statement.
    derivedBase !== undefined
      // Contribute this line to the enclosing declaration or statement.
      ? derivedBase
      // Contribute this line to the enclosing declaration or statement.
      : existingCar
        // Contribute this line to the enclosing declaration or statement.
        ? existingCar.price
        // Contribute this line to the enclosing declaration or statement.
        : undefined;

  // Guard: early-return or throw when required input is missing/invalid.
  if (price === undefined) {
    // Throw an error to stop the current control flow.
    throw new Error('At least one price tier is required.');
  }

  // Create the image constant.
  const image = file
    // Continue the surrounding logic with this statement.
    ? buildImagePath(file)
    // Contribute this line to the enclosing declaration or statement.
    : existingCar
      // Contribute this line to the enclosing declaration or statement.
      ? existingCar.image
      // Continue the surrounding logic with this statement.
      : buildImagePath(file);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!image) {
    // Throw an error to stop the current control flow.
    throw new Error('Car image is required.');
  }

  // Create the status constant.
  const status = resolveFleetStatus(payload, existingCar);
  // Create the fuel level constant.
  const fuelLevel = emptyToNull(payload.fuelLevel);
  // Guard: early-return or throw when required input is missing/invalid.
  if (fuelLevel && !FUEL_LEVELS.includes(fuelLevel)) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid fuel level.');
  }

  // Create the pick fleet constant.
  const pickFleet = (key, existingKey = key) => {
    // Evaluate the condition and enter the branch when it is true.
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      // Return the resulting value to the caller.
      return emptyToNull(payload[key]);
    }
    // Idempotency guard: return early when work was already applied.
    if (existingCar && existingCar[existingKey] !== undefined) {
      // Return the resulting value to the caller.
      return existingCar[existingKey] ?? null;
    }
    // Return the resulting value to the caller.
    return null;
  };

  // Return the resulting value to the caller.
  return {
    // Provide the name field value.
    name: payload.name,
    // Provide the transmission field value.
    transmission: payload.transmission,
    // Contribute this line to the enclosing declaration or statement.
    seats,
    // Provide the fuel type field value.
    fuelType: payload.fuelType,
    // Contribute this line to the enclosing declaration or statement.
    price,
    // Provide the price tier 1 3 field value.
    priceTier_1_3: finalTierShort,
    // Provide the price tier 7 31 field value.
    priceTier_7_31: finalTierMedium,
    // Provide the price tier 31 plus field value.
    priceTier_31_plus: finalTierLong,
    // Contribute this line to the enclosing declaration or statement.
    image,
    // Contribute this line to the enclosing declaration or statement.
    status,
    // Provide the availability field value.
    availability: status === 'available',
    // Provide the registration number field value.
    registrationNumber: pickFleet('registrationNumber'),
    // Provide the vin field value.
    vin: pickFleet('vin'),
    // Provide the mileage field value.
    mileage: Object.prototype.hasOwnProperty.call(payload, 'mileage')
      // Continue the surrounding logic with this statement.
      ? parseOptionalInt(payload.mileage)
      // Contribute this line to the enclosing declaration or statement.
      : existingCar?.mileage ?? null,
    // Provide the fuel level field value.
    fuelLevel: Object.prototype.hasOwnProperty.call(payload, 'fuelLevel')
      // Contribute this line to the enclosing declaration or statement.
      ? fuelLevel
      // Contribute this line to the enclosing declaration or statement.
      : existingCar?.fuelLevel ?? null,
    // Provide the current location field value.
    currentLocation: pickFleet('currentLocation'),
    // Provide the insurance expiry field value.
    insuranceExpiry: pickFleet('insuranceExpiry'),
    // Provide the technical inspection expiry field value.
    technicalInspectionExpiry: pickFleet('technicalInspectionExpiry'),
    // Provide the category id field value.
    categoryId: resolveCategoryId(payload, existingCar),
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolveFleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  buildCarFormState,
  // Contribute this line to the enclosing declaration or statement.
  buildCarPayload,
};
