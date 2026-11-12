/**
 * Normalize and validate guest contact fields before checkout persistence.
 */

/** Trim user-entered contact fields before validation/persistence. */
function trimContactDetails(payload = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the full name field value.
    fullName: (payload.fullName || '').trim(),
    // Provide the phone number field value.
    phoneNumber: (payload.phoneNumber || '').trim(),
    // Provide the email field value.
    email: (payload.email || '').trim(),
    // Provide the address field value.
    address: (payload.address || '').trim(),
    // Provide the hotel name field value.
    hotelName: (payload.hotelName || '').trim(),
  };
}

/**
 * Whether required contact fields are missing (fullName, phone, email, address).
 * @param {object} contact
 * @returns {boolean}
 */
function contactFieldsIncomplete(contact) {
  // Destructure object properties into local variables.
  const { fullName, phoneNumber, email, address } = contact || {};
  // Return the resulting value to the caller.
  return [fullName, phoneNumber, email, address].some((value) => !value);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  trimContactDetails,
  // Contribute this line to the enclosing declaration or statement.
  contactFieldsIncomplete,
};
