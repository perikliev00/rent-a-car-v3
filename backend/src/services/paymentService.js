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
  // Return the resulting value to the caller.
  return trimContactDetails(formData);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  normalizeContactDetails,
};
