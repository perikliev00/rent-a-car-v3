/**
 * Enumerations for fleet cars: transmission, fuel, status, compliance, and fleet alerts.
 * Values are aligned with the admin car form and the `cars` table.
 */

/** Values aligned with admin car form and cars table usage. */
const TRANSMISSIONS = ['Automatic', 'Manual'];
// Create the fuel types constant.
const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];
// Create the car name max length constant.
const CAR_NAME_MAX_LENGTH = 255;
// Create the car seats min constant.
const CAR_SEATS_MIN = 2;
// Create the car seats max constant.
const CAR_SEATS_MAX = 9;

// Create the car statuses constant.
const CAR_STATUSES = [
  // Supply the literal value used by the enclosing expression.
  'available',
  // Supply the literal value used by the enclosing expression.
  'reserved',
  // Supply the literal value used by the enclosing expression.
  'rented',
  // Supply the literal value used by the enclosing expression.
  'needs_cleaning',
  // Supply the literal value used by the enclosing expression.
  'needs_inspection',
  // Supply the literal value used by the enclosing expression.
  'in_maintenance',
  // Supply the literal value used by the enclosing expression.
  'damaged',
  // Supply the literal value used by the enclosing expression.
  'inactive',
];

/** Ops statuses that block booking regardless of calendar dates (aligned with conflict engine). */
const HARD_UNBOOKABLE_STATUSES = ['in_maintenance', 'damaged', 'inactive'];

/**
 * Fleet statuses still eligible for public date search.
 * Calendar blocks + payment holds decide period conflicts; reserved/rented/cleaning
 * must not unlist the car for non-overlapping future ranges.
 */
const BOOKABLE_STATUSES = CAR_STATUSES.filter(
  // Continue the surrounding logic with this statement.
  (status) => !HARD_UNBOOKABLE_STATUSES.includes(status)
);

// Create the fuel levels constant.
const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarters', 'full'];

// Create the service types constant.
const SERVICE_TYPES = ['oil_change', 'tires', 'brakes', 'inspection', 'bodywork', 'other'];

// Create the damage statuses constant.
const DAMAGE_STATUSES = ['unresolved', 'resolved'];

// Create the compliance types constant.
const COMPLIANCE_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'civil_insurance',
  // Supply the literal value used by the enclosing expression.
  'casco',
  // Supply the literal value used by the enclosing expression.
  'vignette',
  // Supply the literal value used by the enclosing expression.
  'technical_inspection',
  // Supply the literal value used by the enclosing expression.
  'vehicle_tax',
  // Supply the literal value used by the enclosing expression.
  'registration_certificate',
  // Supply the literal value used by the enclosing expression.
  'fire_extinguisher',
  // Supply the literal value used by the enclosing expression.
  'first_aid_kit',
  // Supply the literal value used by the enclosing expression.
  'warning_triangle',
  // Supply the literal value used by the enclosing expression.
  'leasing',
  // Supply the literal value used by the enclosing expression.
  'other',
];

// Create the compliance type labels constant.
const COMPLIANCE_TYPE_LABELS = {
  // Provide the civil insurance field value.
  civil_insurance: 'Гражданска отговорност',
  // Provide the casco field value.
  casco: 'Каско',
  // Provide the vignette field value.
  vignette: 'Винетка',
  // Provide the technical inspection field value.
  technical_inspection: 'ГТП / технически преглед',
  // Provide the vehicle tax field value.
  vehicle_tax: 'Данък МПС',
  // Provide the registration certificate field value.
  registration_certificate: 'Талон / регистрация',
  // Provide the fire extinguisher field value.
  fire_extinguisher: 'Пожарогасител',
  // Provide the first aid kit field value.
  first_aid_kit: 'Аптечка',
  // Provide the warning triangle field value.
  warning_triangle: 'Триъгълник',
  // Provide the leasing field value.
  leasing: 'Лизинг / договор',
  // Provide the other field value.
  other: 'Друго',
};

// Create the compliance statuses constant.
const COMPLIANCE_STATUSES = ['valid', 'expired', 'missing'];

/** Compliance types covered by the persisted fleet-alert reconcile job. */
const FLEET_ALERT_COMPLIANCE_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'civil_insurance',
  // Supply the literal value used by the enclosing expression.
  'casco',
  // Supply the literal value used by the enclosing expression.
  'vignette',
  // Supply the literal value used by the enclosing expression.
  'technical_inspection',
];

// Create the fleet alert expiry window days constant.
const FLEET_ALERT_EXPIRY_WINDOW_DAYS = 7;

// Create the fleet alert types constant.
const FLEET_ALERT_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'insurance_expired',
  // Supply the literal value used by the enclosing expression.
  'insurance_expiring_soon',
  // Supply the literal value used by the enclosing expression.
  'casco_expired',
  // Supply the literal value used by the enclosing expression.
  'casco_expiring_soon',
  // Supply the literal value used by the enclosing expression.
  'vignette_expired',
  // Supply the literal value used by the enclosing expression.
  'vignette_expiring_soon',
  // Supply the literal value used by the enclosing expression.
  'inspection_expired',
  // Supply the literal value used by the enclosing expression.
  'inspection_expiring_soon',
  // Supply the literal value used by the enclosing expression.
  'unresolved_damage',
];

// Create the fleet alert severities constant.
const FLEET_ALERT_SEVERITIES = ['critical', 'warning', 'info'];

// Create the fleet alert statuses constant.
const FLEET_ALERT_STATUSES = ['active', 'resolved'];

// Create the fleet alert source kinds constant.
const FLEET_ALERT_SOURCE_KINDS = ['compliance_item', 'damage_report'];

// Create the active rental reservation statuses constant.
const ACTIVE_RENTAL_RESERVATION_STATUSES = [
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'picked_up',
  // Supply the literal value used by the enclosing expression.
  'active_rental',
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  TRANSMISSIONS,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  CAR_NAME_MAX_LENGTH,
  // Contribute this line to the enclosing declaration or statement.
  CAR_SEATS_MIN,
  // Contribute this line to the enclosing declaration or statement.
  CAR_SEATS_MAX,
  // Contribute this line to the enclosing declaration or statement.
  CAR_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  HARD_UNBOOKABLE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  BOOKABLE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_LEVELS,
  // Contribute this line to the enclosing declaration or statement.
  SERVICE_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  DAMAGE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_TYPE_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_COMPLIANCE_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_SEVERITIES,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  FLEET_ALERT_SOURCE_KINDS,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_RENTAL_RESERVATION_STATUSES,
};
