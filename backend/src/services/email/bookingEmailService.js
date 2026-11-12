/**
 * Booking confirmation emails — thin facade over the notifications module
 * (persist + send with idempotency so duplicate finalizations do not spam guests).
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  sendBookingConfirmationEmails,
// Continue the surrounding logic with this statement.
} = require('../../modules/notifications/notifications.bookingBridge');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  sendBookingConfirmationEmails,
};
