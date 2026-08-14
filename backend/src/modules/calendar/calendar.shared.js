const { publishCalendarUpdated } = require('../realtime/realtime.publisher');

function emitCalendarUpdated({ action, entityType, entityId }) {
  publishCalendarUpdated({ action, entityType, entityId });
}

function createHttpError(code, message, status = 400, extra = {}) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  Object.assign(err, extra);
  return err;
}

function parseRange(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(start < end)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid from/to range.', 422);
  }
  return { start, end };
}

module.exports = {
  emitCalendarUpdated,
  createHttpError,
  parseRange,
};
