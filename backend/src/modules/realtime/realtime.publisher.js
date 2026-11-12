/**
 * Safe publish API for domain callers (booking, payments, calendar, status).
 *
 * All helpers swallow errors so realtime never breaks transactional flows.
 */

const logger = require('../../utils/logger');
// Require the './realtime.hub' module as hub.
const hub = require('./realtime.hub');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildNewBookingEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildPaymentFailedEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildCalendarUpdatedEvent,
  // Contribute this line to the enclosing declaration or statement.
  mapStatusChangeToEvents,
  // Contribute this line to the enclosing declaration or statement.
  LIVE_EVENT_TYPES,
// Continue the surrounding logic with this statement.
} = require('./realtime.events');

/**
 * Fire-and-forget publish — never throws into domain callers.
 * Accepts a type string + partial, or a pre-built event object.
 */
function publishLiveEvent(typeOrEvent, partial) {
  // Start a try block for operations that may fail.
  try {
    // Reserve the event variable for later assignment.
    let event;
    // Evaluate the condition and enter the branch when it is true.
    if (typeof typeOrEvent === 'string') {
      // Update event with the right-hand side value.
      event = buildLiveEvent(typeOrEvent, partial || {});
    // Continue the surrounding logic with this statement.
    } else if (typeOrEvent && typeof typeOrEvent === 'object' && typeOrEvent.type) {
      // Update event with the right-hand side value.
      event = typeOrEvent.id
        // Contribute this line to the enclosing declaration or statement.
        ? typeOrEvent
        // Continue the surrounding logic with this statement.
        : buildLiveEvent(typeOrEvent.type, typeOrEvent);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Return the resulting value to the caller.
      return null;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (!LIVE_EVENT_TYPES.includes(event.type)) {
      // Call logger.warn to perform this step.
      logger.warn({ type: event.type }, 'Ignored unknown live event type');
      // Return the resulting value to the caller.
      return null;
    }

    // Return the resulting value to the caller.
    return hub.publish(event);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'publishLiveEvent' }, 'Failed to publish live admin event');
    // Return the resulting value to the caller.
    return null;
  }
}

/** Expand a reservation status-change into one or more live events and publish. */
function publishFromStatusChange(statusEvent) {
  // Start a try block for operations that may fail.
  try {
    // Create the events constant.
    const events = mapStatusChangeToEvents(statusEvent);
    // Iterate using the loop initializer, condition, and step.
    for (const event of events) {
      // Call hub.publish to perform this step.
      hub.publish(event);
    }
    // Return the resulting value to the caller.
    return events;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error(
      // Contribute this line to the enclosing declaration or statement.
      { err, context: 'publishFromStatusChange' },
      // Supply the literal value used by the enclosing expression.
      'Failed to publish status-change live events'
    );
    // Return the resulting value to the caller.
    return [];
  }
}

/** Publish new_booking after confirmation emails enqueue. */
function publishNewBooking(ctx) {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return hub.publish(buildNewBookingEvent(ctx));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'publishNewBooking' }, 'Failed to publish new_booking');
    // Return the resulting value to the caller.
    return null;
  }
}

/** Publish payment_failed for Stripe / checkout failures. */
function publishPaymentFailed(ctx) {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return hub.publish(buildPaymentFailedEvent(ctx));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'publishPaymentFailed' }, 'Failed to publish payment_failed');
    // Return the resulting value to the caller.
    return null;
  }
}

/** Publish calendar_updated so open calendars can refetch. */
function publishCalendarUpdated(ctx) {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return hub.publish(buildCalendarUpdatedEvent(ctx || {}));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'publishCalendarUpdated' }, 'Failed to publish calendar_updated');
    // Return the resulting value to the caller.
    return null;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  publishLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  publishFromStatusChange,
  // Contribute this line to the enclosing declaration or statement.
  publishNewBooking,
  // Contribute this line to the enclosing declaration or statement.
  publishPaymentFailed,
  // Contribute this line to the enclosing declaration or statement.
  publishCalendarUpdated,
};
