/**
 * Fire-and-forget booking confirmation emails after finalization commits.
 * Must not run inside an open transaction (notifications.order_id FK).
 */
const { sendBookingConfirmationEmails } = require('../email/bookingEmailService');

/** Call only after the finalization transaction has committed (notifications.order_id FK). */
function sendEmailsAfterCommit(result) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result?.finalized || !result.order) return;
  void Promise.resolve(
    sendBookingConfirmationEmails({
      order: result.order,
      reservation: result.reservation,
      carName: result.carName || result.reservation?.carId?.name || null,
    })
  ).catch(() => {});
}

module.exports = {
  sendEmailsAfterCommit,
};
