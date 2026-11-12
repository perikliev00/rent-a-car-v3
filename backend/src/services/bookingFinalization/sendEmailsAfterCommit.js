/**
 * Fire-and-forget booking confirmation emails after finalization commits.
 * Must not run inside an open transaction (notifications.order_id FK).
 */
const { sendBookingConfirmationEmails } = require('../email/bookingEmailService');

/** Call only after the finalization transaction has committed (notifications.order_id FK). */
function sendEmailsAfterCommit(result) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result?.finalized || !result.order) return;
  // Continue the surrounding logic with this statement.
  void Promise.resolve(
    // Call sendBookingConfirmationEmails to perform this step.
    sendBookingConfirmationEmails({
      // Provide the order field value.
      order: result.order,
      // Provide the reservation field value.
      reservation: result.reservation,
      // Provide the car name field value.
      carName: result.carName || result.reservation?.carId?.name || null,
    })
  // Continue the surrounding logic with this statement.
  ).catch(() => {});
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  sendEmailsAfterCommit,
};
