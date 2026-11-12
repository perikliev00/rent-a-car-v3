/**
 * Pickup/return location ids, display labels, and default delivery fees (EUR).
 * Keep ALLOWED_LOCATIONS in sync with DELIVERY_FEES and frontend EJS selects.
 */

/** Canonical pickup/return location ids – keep in sync with FEES and EJS selects. */
const ALLOWED_LOCATIONS = [
  // Supply the literal value used by the enclosing expression.
  'office',
  // Supply the literal value used by the enclosing expression.
  'sunny-beach',
  // Supply the literal value used by the enclosing expression.
  'sveti-vlas',
  // Supply the literal value used by the enclosing expression.
  'nesebar',
  // Supply the literal value used by the enclosing expression.
  'burgas',
  // Supply the literal value used by the enclosing expression.
  'burgas-airport',
  // Supply the literal value used by the enclosing expression.
  'sofia',
  // Supply the literal value used by the enclosing expression.
  'sofia-airport',
  // Supply the literal value used by the enclosing expression.
  'varna',
  // Supply the literal value used by the enclosing expression.
  'varna-airport',
  // Supply the literal value used by the enclosing expression.
  'plovdiv',
  // Supply the literal value used by the enclosing expression.
  'eleni',
  // Supply the literal value used by the enclosing expression.
  'ravda',
];

// Create the location labels constant.
const LOCATION_LABELS = {
  // Provide the office field value.
  office: 'Office',
  // Supply the literal value used by the enclosing expression.
  'sunny-beach': 'Sunny Beach',
  // Supply the literal value used by the enclosing expression.
  'sveti-vlas': 'Sveti Vlas',
  // Provide the nesebar field value.
  nesebar: 'Nesebar',
  // Provide the burgas field value.
  burgas: 'Burgas',
  // Supply the literal value used by the enclosing expression.
  'burgas-airport': 'Burgas Airport',
  // Provide the sofia field value.
  sofia: 'Sofia',
  // Supply the literal value used by the enclosing expression.
  'sofia-airport': 'Sofia Airport',
  // Provide the varna field value.
  varna: 'Varna',
  // Supply the literal value used by the enclosing expression.
  'varna-airport': 'Varna Airport',
  // Provide the plovdiv field value.
  plovdiv: 'Plovdiv',
  // Provide the eleni field value.
  eleni: 'Eleni',
  // Provide the ravda field value.
  ravda: 'Ravda',
};

/** Flat delivery/return fees per location (EUR). */
const DELIVERY_FEES = {
  // Provide the office field value.
  office: 0,
  // Supply the literal value used by the enclosing expression.
  'sunny-beach': 25,
  // Supply the literal value used by the enclosing expression.
  'sveti-vlas': 30,
  // Provide the nesebar field value.
  nesebar: 30,
  // Provide the burgas field value.
  burgas: 40,
  // Supply the literal value used by the enclosing expression.
  'burgas-airport': 50,
  // Provide the sofia field value.
  sofia: 100,
  // Supply the literal value used by the enclosing expression.
  'sofia-airport': 120,
  // Provide the varna field value.
  varna: 80,
  // Supply the literal value used by the enclosing expression.
  'varna-airport': 90,
  // Provide the plovdiv field value.
  plovdiv: 70,
  // Provide the eleni field value.
  eleni: 35,
  // Provide the ravda field value.
  ravda: 20,
};

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_LOCATIONS,
  // Contribute this line to the enclosing declaration or statement.
  LOCATION_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  DELIVERY_FEES,
};
