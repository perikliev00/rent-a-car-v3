/**
 * Wires reservation status-change listeners into the SSE publisher.
 * Call initRealtime once at process start; shutdownRealtime on graceful exit.
 */

const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { registerStatusChangeListener } = require('../../services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const { publishFromStatusChange } = require('./realtime.publisher');
// Require the './realtime.hub' module as hub.
const hub = require('./realtime.hub');

// Initialize the mutable initialized variable.
let initialized = false;
// Initialize the mutable unsubscribe status variable.
let unsubscribeStatus = null;

/**
 * Forward a domain status-change event into the live-event publisher.
 * @param {object} event Reservation status-change payload
 */
async function onStatusChange(event) {
  // Call publishFromStatusChange to perform this step.
  publishFromStatusChange(event);
}

/**
 * Idempotent bootstrap of status → live event bridge.
 * Safe to call more than once; subsequent calls are no-ops.
 */
function initRealtime() {
  // Evaluate the condition and enter the branch when it is true.
  if (initialized) {
    // Return control to the caller with the following value.
    return;
  }
  // Update initialized with the right-hand side value.
  initialized = true;
  // Update unsubscribeStatus with the right-hand side value.
  unsubscribeStatus = registerStatusChangeListener(onStatusChange);
  // Call logger.info to perform this step.
  logger.info('Admin realtime SSE listeners initialized');
}

/**
 * Unsubscribe listeners and close all SSE connections on graceful shutdown.
 */
function shutdownRealtime() {
  // Detach domain listener first so no new publishes race teardown.
  if (unsubscribeStatus) {
    // Call unsubscribeStatus to perform this step.
    unsubscribeStatus();
    // Update unsubscribeStatus with the right-hand side value.
    unsubscribeStatus = null;
  }
  // Call hub.closeAll to perform this step.
  hub.closeAll();
  // Update initialized with the right-hand side value.
  initialized = false;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  initRealtime,
  // Contribute this line to the enclosing declaration or statement.
  shutdownRealtime,
};
