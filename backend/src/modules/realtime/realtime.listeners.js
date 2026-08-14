const logger = require('../../utils/logger');
const { registerStatusChangeListener } = require('../../services/reservation/reservationStatusService');
const { publishFromStatusChange } = require('./realtime.publisher');
const hub = require('./realtime.hub');

let initialized = false;
let unsubscribeStatus = null;

async function onStatusChange(event) {
  publishFromStatusChange(event);
}

function initRealtime() {
  if (initialized) {
    return;
  }
  initialized = true;
  unsubscribeStatus = registerStatusChangeListener(onStatusChange);
  logger.info('Admin realtime SSE listeners initialized');
}

function shutdownRealtime() {
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
