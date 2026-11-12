/**
 * Guest-facing pickup/return instruction copy for My Account reservation detail.
 */
const { LOCATION_LABELS } = require('../../constants/locations');
// Destructure object properties into local variables.
const { formatLocationName } = require('../../utils/dateFormatter');

/**
 * location label.
 * @param {string|number} id
 * @returns {*}
 */
function locationLabel(id) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!id) return 'the agreed location';
  // Return the resulting value to the caller.
  return LOCATION_LABELS[id] || formatLocationName(id) || id;
}

/**
 * @param {object} reservation
 * @returns {string[]}
 */
function buildPickupInstructions(reservation) {
  // Create the place constant.
  const place = locationLabel(reservation.pickupLocation);
  // Create the time constant.
  const time = reservation.pickupTime || 'the scheduled time';
  // Return the resulting value to the caller.
  return [
    // Continue the surrounding logic with this statement.
    `Please arrive at ${place} at ${time} with your booking confirmation.`,
    // Supply the literal value used by the enclosing expression.
    'Bring a valid driving licence held for at least one year and a passport or national ID.',
    // Supply the literal value used by the enclosing expression.
    'Upload your documents in My Account before pickup when possible.',
    // Continue the surrounding logic with this statement.
    'An employee will complete the pickup checklist with you (fuel, mileage, existing damage, signatures).',
  ];
}

/**
 * @param {object} reservation
 * @returns {string[]}
 */
function buildReturnInstructions(reservation) {
  // Create the place constant.
  const place = locationLabel(reservation.returnLocation);
  // Create the time constant.
  const time = reservation.returnTime || 'the scheduled time';
  // Return the resulting value to the caller.
  return [
    // Continue the surrounding logic with this statement.
    `Return the vehicle to ${place} by ${time}.`,
    // Supply the literal value used by the enclosing expression.
    'Ensure the fuel level matches the pickup checklist unless otherwise agreed.',
    // Continue the surrounding logic with this statement.
    'Remove personal belongings and report any new damage at return.',
    // Apply the TypeScript type assertion for this value.
    'Late returns may incur extra fees as recorded on the return checklist.',
  ];
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildPickupInstructions,
  // Contribute this line to the enclosing declaration or statement.
  buildReturnInstructions,
};
