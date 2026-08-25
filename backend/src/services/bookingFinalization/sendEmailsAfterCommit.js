const { sendBookingConfirmationEmails } = require('../email/bookingEmailService');
const reservationClaimService = require('../account/reservationClaimService');

/**
 * A guest booking gets a claim token so its owner can later attach it to an account. The
 * token is mailed separately from the queued confirmation, because the notifications queue
 * persists its payload and would store the raw token in the database.
 */
function sendClaimInvite(result) {
  const reservationId = result.reservation?.id || result.order?.reservationId || null;
  const bookingEmail = result.order?.email || result.reservation?.email || null;

  // Bookings already tied to an account need no claim link.
  if (!reservationId || !bookingEmail || result.reservation?.userId) {
    return;
  }

  void Promise.resolve(
    reservationClaimService.issueAndSendClaimToken({ reservationId, bookingEmail })
  ).catch(() => {});
}

/** Call only after the finalization transaction has committed (notifications.order_id FK). */
function sendEmailsAfterCommit(result) {
  if (!result?.finalized || !result.order) return;
  void Promise.resolve(
    sendBookingConfirmationEmails({
      order: result.order,
      reservation: result.reservation,
      carName: result.carName || result.reservation?.carId?.name || null,
    })
  ).catch(() => {});

  sendClaimInvite(result);
}

module.exports = {
  sendEmailsAfterCommit,
};
