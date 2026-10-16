/**
 * Thin payment helpers shared with checkout (contact normalization alias).
 */
const { trimContactDetails } = require('./contactService');

/**
 * Normalize contact fields from checkout form data.
 * @param {object} [formData]
 * @returns {object}
 */
function normalizeContactDetails(formData = {}) {
  return trimContactDetails(formData);
}

module.exports = {
  normalizeContactDetails,
};
