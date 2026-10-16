/**
 * Normalize and validate guest contact fields before checkout persistence.
 */

/** Trim user-entered contact fields before validation/persistence. */
function trimContactDetails(payload = {}) {
  return {
    fullName: (payload.fullName || '').trim(),
    phoneNumber: (payload.phoneNumber || '').trim(),
    email: (payload.email || '').trim(),
    address: (payload.address || '').trim(),
    hotelName: (payload.hotelName || '').trim(),
  };
}

/**
 * Whether required contact fields are missing (fullName, phone, email, address).
 * @param {object} contact
 * @returns {boolean}
 */
function contactFieldsIncomplete(contact) {
  const { fullName, phoneNumber, email, address } = contact || {};
  return [fullName, phoneNumber, email, address].some((value) => !value);
}

module.exports = {
  trimContactDetails,
  contactFieldsIncomplete,
};
