/** Canonical pickup/return location ids – keep in sync with FEES and EJS selects. */
const ALLOWED_LOCATIONS = [
  'office',
  'sunny-beach',
  'sveti-vlas',
  'nesebar',
  'burgas',
  'burgas-airport',
  'sofia',
  'sofia-airport',
  'varna',
  'varna-airport',
  'plovdiv',
  'eleni',
  'ravda',
];

const LOCATION_LABELS = {
  office: 'Office',
  'sunny-beach': 'Sunny Beach',
  'sveti-vlas': 'Sveti Vlas',
  nesebar: 'Nesebar',
  burgas: 'Burgas',
  'burgas-airport': 'Burgas Airport',
  sofia: 'Sofia',
  'sofia-airport': 'Sofia Airport',
  varna: 'Varna',
  'varna-airport': 'Varna Airport',
  plovdiv: 'Plovdiv',
  eleni: 'Eleni',
  ravda: 'Ravda',
};

/** Flat delivery/return fees per location (EUR). */
const DELIVERY_FEES = {
  office: 0,
  'sunny-beach': 25,
  'sveti-vlas': 30,
  nesebar: 30,
  burgas: 40,
  'burgas-airport': 50,
  sofia: 100,
  'sofia-airport': 120,
  varna: 80,
  'varna-airport': 90,
  plovdiv: 70,
  eleni: 35,
  ravda: 20,
};

module.exports = {
  ALLOWED_LOCATIONS,
  LOCATION_LABELS,
  DELIVERY_FEES,
};
