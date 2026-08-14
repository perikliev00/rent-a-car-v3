/**
 * Normalize client-selected extras before pricing.
 * If both insurance_basic and insurance_full are present, keep only insurance_full.
 */
function normalizeSelectedExtras(extras) {
  const list = Array.isArray(extras) ? extras.filter(Boolean) : [];
  const unique = [...new Set(list)];
  if (unique.includes('insurance_full') && unique.includes('insurance_basic')) {
    return unique.filter((code) => code !== 'insurance_basic');
  }
  return unique;
}

module.exports = {
  normalizeSelectedExtras,
};
