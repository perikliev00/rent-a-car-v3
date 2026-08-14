const {
  enqueueReservationConfirmation,
  enqueueAdminNewBooking,
} = require('./notifications.enqueue');
const { sendNowIfEnqueued } = require('./notifications.worker');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');
const { publishNewBooking } = require('../realtime/realtime.publisher');

/**
 * Replaces direct bookingEmailService sends: enqueue + send with idempotency.
 */
async function sendBookingConfirmationEmails({ order, reservation, carName }) {
  if (!order?.email) {
    return;
  }

  try {
    const customer = await enqueueReservationConfirmation({ order, reservation, carName });
    await sendNowIfEnqueued(customer);
  } catch (err) {
    logEvent.error('email.confirmation.failed', {
      orderId: order.id,
      recipient: 'customer',
      err: err.message,
    });
    metrics.incrementEmailConfirmationFailures();
    logger.error({ err, orderId: order.id }, 'Failed to send customer booking email');
  }

  // Live admin event once per booking (same moment as admin new-booking alert).
  publishNewBooking({ order, reservation, carName });

  try {
    const admin = await enqueueAdminNewBooking({ order, reservation, carName });
    await sendNowIfEnqueued(admin);
  } catch (err) {
    logEvent.error('email.confirmation.failed', {
      orderId: order.id,
      recipient: 'admin',
      err: err.message,
    });
    metrics.incrementEmailConfirmationFailures();
    logger.error({ err, orderId: order.id }, 'Failed to send admin booking email');
  }
}

module.exports = {
  sendBookingConfirmationEmails,
};
