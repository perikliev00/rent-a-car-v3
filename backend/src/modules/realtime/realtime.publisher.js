const logger = require('../../utils/logger');
const hub = require('./realtime.hub');
const {
  buildLiveEvent,
  buildNewBookingEvent,
  buildPaymentFailedEvent,
  buildCalendarUpdatedEvent,
  mapStatusChangeToEvents,
  LIVE_EVENT_TYPES,
} = require('./realtime.events');

/**
 * Fire-and-forget publish — never throws into domain callers.
 */
function publishLiveEvent(typeOrEvent, partial) {
  try {
    let event;
    if (typeof typeOrEvent === 'string') {
      event = buildLiveEvent(typeOrEvent, partial || {});
    } else if (typeOrEvent && typeof typeOrEvent === 'object' && typeOrEvent.type) {
      event = typeOrEvent.id
        ? typeOrEvent
        : buildLiveEvent(typeOrEvent.type, typeOrEvent);
    } else {
      return null;
    }

    if (!LIVE_EVENT_TYPES.includes(event.type)) {
      logger.warn({ type: event.type }, 'Ignored unknown live event type');
      return null;
    }

    return hub.publish(event);
  } catch (err) {
    logger.error({ err, context: 'publishLiveEvent' }, 'Failed to publish live admin event');
    return null;
  }
}

function publishFromStatusChange(statusEvent) {
  try {
    const events = mapStatusChangeToEvents(statusEvent);
    for (const event of events) {
      hub.publish(event);
    }
    return events;
  } catch (err) {
    logger.error(
      { err, context: 'publishFromStatusChange' },
      'Failed to publish status-change live events'
    );
    return [];
  }
}

function publishNewBooking(ctx) {
  try {
    return hub.publish(buildNewBookingEvent(ctx));
  } catch (err) {
    logger.error({ err, context: 'publishNewBooking' }, 'Failed to publish new_booking');
    return null;
  }
}

function publishPaymentFailed(ctx) {
  try {
    return hub.publish(buildPaymentFailedEvent(ctx));
  } catch (err) {
    logger.error({ err, context: 'publishPaymentFailed' }, 'Failed to publish payment_failed');
    return null;
  }
}

function publishCalendarUpdated(ctx) {
  try {
    return hub.publish(buildCalendarUpdatedEvent(ctx || {}));
  } catch (err) {
    logger.error({ err, context: 'publishCalendarUpdated' }, 'Failed to publish calendar_updated');
    return null;
  }
}

module.exports = {
  publishLiveEvent,
  publishFromStatusChange,
  publishNewBooking,
  publishPaymentFailed,
  publishCalendarUpdated,
};
