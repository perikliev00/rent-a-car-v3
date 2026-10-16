/**
 * Wires reservation status-change listeners into the SSE publisher.
 * Call initRealtime once at process start; shutdownRealtime on graceful exit.
 */

const logger = require('../../utils/logger');
const { registerStatusChangeListener } = require('../../services/reservation/reservationStatusService');
const { publishFromStatusChange } = require('./realtime.publisher');
const hub = require('./realtime.hub');

let initialized = false;
let unsubscribeStatus = null;

/**
 * Forward a domain status-change event into the live-event publisher.
 * @param {object} event Reservation status-change payload
 */
async function onStatusChange(event) {
  publishFromStatusChange(event);
}

/**
 * Idempotent bootstrap of status → live event bridge.
 * Safe to call more than once; subsequent calls are no-ops.
 */
function initRealtime() {
  if (initialized) {
    return;
  }
  initialized = true;
  unsubscribeStatus = registerStatusChangeListener(onStatusChange);
  logger.info('Admin realtime SSE listeners initialized');
}

/**
 * Unsubscribe listeners and close all SSE connections on graceful shutdown.
 */
function shutdownRealtime() {
  // Detach domain listener first so no new publishes race teardown.
  if (unsubscribeStatus) {
    unsubscribeStatus();
    unsubscribeStatus = null;
  }
  hub.closeAll();
  initialized = false;
}

module.exports = {
  initRealtime,
  shutdownRealtime,
};
