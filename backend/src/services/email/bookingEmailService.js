/**
 * Booking confirmation emails — delegates to notifications module
 * (persist + send with idempotency).
 */
const {
  sendBookingConfirmationEmails,
} = require('../../modules/notifications/notifications.bookingBridge');

module.exports = {
  sendBookingConfirmationEmails,
};
