/**
 * Booking confirmation bridge from order/payment flows into notifications + realtime.
 *
 * Enqueues customer/admin emails with idempotency, attempts immediate send,
 * and publishes a live new-booking event for the admin UI.
 */

const {
  // Contribute this line to the enclosing declaration or statement.
  enqueueReservationConfirmation,
  // Contribute this line to the enclosing declaration or statement.
  enqueueAdminNewBooking,
// Continue the surrounding logic with this statement.
} = require('./notifications.enqueue');
// Destructure object properties into local variables.
const { sendNowIfEnqueued } = require('./notifications.worker');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');
// Destructure object properties into local variables.
const { publishNewBooking } = require('../realtime/realtime.publisher');

/**
 * Replaces direct bookingEmailService sends: enqueue + send with idempotency.
 * @param {{ order: object, reservation?: object, carName?: string }} args
 */
async function sendBookingConfirmationEmails({ order, reservation, carName }) {
  // Evaluate the condition and enter the branch when it is true.
  if (!order?.email) {
    // Return control to the caller with the following value.
    return;
  }

  // Start a try block for operations that may fail.
  try {
    // Create the customer constant.
    const customer = await enqueueReservationConfirmation({ order, reservation, carName });
    // Wait until the asynchronous operation resolves.
    await sendNowIfEnqueued(customer);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logEvent.error to perform this step.
    logEvent.error('email.confirmation.failed', {
      // Provide the order id field value.
      orderId: order.id,
      // Provide the recipient field value.
      recipient: 'customer',
      // Provide the err field value.
      err: err.message,
    });
    // Call metrics.incrementEmailConfirmationFailures to perform this step.
    metrics.incrementEmailConfirmationFailures();
    // Call logger.error to perform this step.
    logger.error({ err, orderId: order.id }, 'Failed to send customer booking email');
  }

  // Live admin event once per booking (same moment as admin new-booking alert).
  publishNewBooking({ order, reservation, carName });

  // Start a try block for operations that may fail.
  try {
    // Create the admin constant.
    const admin = await enqueueAdminNewBooking({ order, reservation, carName });
    // Wait until the asynchronous operation resolves.
    await sendNowIfEnqueued(admin);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logEvent.error to perform this step.
    logEvent.error('email.confirmation.failed', {
      // Provide the order id field value.
      orderId: order.id,
      // Provide the recipient field value.
      recipient: 'admin',
      // Provide the err field value.
      err: err.message,
    });
    // Call metrics.incrementEmailConfirmationFailures to perform this step.
    metrics.incrementEmailConfirmationFailures();
    // Call logger.error to perform this step.
    logger.error({ err, orderId: order.id }, 'Failed to send admin booking email');
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  sendBookingConfirmationEmails,
};
