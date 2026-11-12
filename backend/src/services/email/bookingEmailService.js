/**
 * Booking confirmation emails — thin facade over the notifications module
 * (persist + send with idempotency so duplicate finalizations do not spam guests).
 */
const {
  sendBookingConfirmationEmails,
} = require('../../modules/notifications/notifications.bookingBridge');

module.exports = {
  sendBookingConfirmationEmails,
};
