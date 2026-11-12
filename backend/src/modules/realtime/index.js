/**
 * Public entry for the admin realtime (SSE) module.
 */

const { initRealtime, shutdownRealtime } = require('./realtime.listeners');
// Destructure object properties into local variables.
const {
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
// Continue the surrounding logic with this statement.
} = require('./realtime.publisher');
// Require the './realtime.hub' module as hub.
const hub = require('./realtime.hub');
// Require the './realtime.events' module as events.
const events = require('./realtime.events');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  initRealtime,
  // Contribute this line to the enclosing declaration or statement.
  shutdownRealtime,
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
  // Contribute this line to the enclosing declaration or statement.
  hub,
  // Contribute this line to the enclosing declaration or statement.
  events,
};
