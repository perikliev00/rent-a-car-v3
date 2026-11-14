/**
 * Enumerations for fleet cars: transmission, fuel, status, compliance, and fleet alerts.
 * Values are aligned with the admin car form and the `cars` table.
 */

/** Values aligned with admin car form and cars table usage. */
const TRANSMISSIONS = ['Automatic', 'Manual'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];
const CAR_NAME_MAX_LENGTH = 255;
const CAR_SEATS_MIN = 2;
const CAR_SEATS_MAX = 9;

const CAR_STATUSES = [
  'available',
  'reserved',
  'rented',
  'needs_cleaning',
  'needs_inspection',
  'in_maintenance',
  'damaged',
  'inactive',
];

/** Ops statuses that block booking regardless of calendar dates (aligned with conflict engine). */
const HARD_UNBOOKABLE_STATUSES = ['in_maintenance', 'damaged', 'inactive'];

const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarters', 'full'];

const SERVICE_TYPES = ['oil_change', 'tires', 'brakes', 'inspection', 'bodywork', 'other'];

const COMPLIANCE_TYPES = [
  'civil_insurance',
  'casco',
  'vignette',
  'technical_inspection',
  'vehicle_tax',
  'registration_certificate',
  'fire_extinguisher',
  'first_aid_kit',
  'warning_triangle',
  'leasing',
  'other',
];

const COMPLIANCE_TYPE_LABELS = {
  civil_insurance: 'Гражданска отговорност',
  casco: 'Каско',
  vignette: 'Винетка',
  technical_inspection: 'ГТП / технически преглед',
  vehicle_tax: 'Данък МПС',
  registration_certificate: 'Талон / регистрация',
  fire_extinguisher: 'Пожарогасител',
  first_aid_kit: 'Аптечка',
  warning_triangle: 'Триъгълник',
  leasing: 'Лизинг / договор',
  other: 'Друго',
};

const COMPLIANCE_STATUSES = ['valid', 'expired', 'missing'];

/** Compliance types covered by the persisted fleet-alert reconcile job. */
const FLEET_ALERT_COMPLIANCE_TYPES = [
  'civil_insurance',
  'casco',
  'vignette',
  'technical_inspection',
];

const FLEET_ALERT_EXPIRY_WINDOW_DAYS = 7;

module.exports = {
  TRANSMISSIONS,
  FUEL_TYPES,
  CAR_NAME_MAX_LENGTH,
  CAR_SEATS_MIN,
  CAR_SEATS_MAX,
  CAR_STATUSES,
  HARD_UNBOOKABLE_STATUSES,
  FUEL_LEVELS,
  SERVICE_TYPES,
  COMPLIANCE_TYPES,
  COMPLIANCE_TYPE_LABELS,
  COMPLIANCE_STATUSES,
  FLEET_ALERT_COMPLIANCE_TYPES,
  FLEET_ALERT_EXPIRY_WINDOW_DAYS,
};
