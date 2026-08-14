const { trimContactDetails } = require('./contactService');

function normalizeContactDetails(formData = {}) {
  return trimContactDetails(formData);
}

module.exports = {
  normalizeContactDetails,
};
