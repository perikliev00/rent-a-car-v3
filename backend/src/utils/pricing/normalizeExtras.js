/**
 * Normalize client-selected extras before pricing.
 * If both insurance_basic and insurance_full are present, keep only insurance_full
 * so the customer is not charged for overlapping coverages.
 */

/**
 * Deduplicate selected extra codes and collapse basic+full insurance to full only.
 *
 * @param {unknown} extras - Client-supplied list of extra codes (may be non-array)
 * @returns {string[]} Unique active codes with insurance_basic removed when insurance_full is present
 * @throws {never}
 */
function normalizeSelectedExtras(extras) {
  // Drop falsy entries; non-arrays become an empty selection.
  const list = Array.isArray(extras) ? extras.filter(Boolean) : [];
  // Deduplicate while preserving first-seen order.
  const unique = [...new Set(list)];
  // Full insurance supersedes basic when both were selected.
  if (unique.includes('insurance_full') && unique.includes('insurance_basic')) {
    return unique.filter((code) => code !== 'insurance_basic');
  }
  return unique;
}

module.exports = {
  normalizeSelectedExtras,
};
