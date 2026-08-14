const { LOCATION_LABELS } = require('../../constants/locations');
const { formatLocationName } = require('../../utils/dateFormatter');

function locationLabel(id) {
  if (!id) return 'the agreed location';
  return LOCATION_LABELS[id] || formatLocationName(id) || id;
}

function buildPickupInstructions(reservation) {
  const place = locationLabel(reservation.pickupLocation);
  const time = reservation.pickupTime || 'the scheduled time';
  return [
    `Please arrive at ${place} at ${time} with your booking confirmation.`,
    'Bring a valid driving licence held for at least one year and a passport or national ID.',
    'Upload your documents in My Account before pickup when possible.',
    'An employee will complete the pickup checklist with you (fuel, mileage, existing damage, signatures).',
  ];
}

function buildReturnInstructions(reservation) {
  const place = locationLabel(reservation.returnLocation);
  const time = reservation.returnTime || 'the scheduled time';
  return [
    `Return the vehicle to ${place} by ${time}.`,
    'Ensure the fuel level matches the pickup checklist unless otherwise agreed.',
    'Remove personal belongings and report any new damage at return.',
    'Late returns may incur extra fees as recorded on the return checklist.',
  ];
}

module.exports = {
  buildPickupInstructions,
  buildReturnInstructions,
};
