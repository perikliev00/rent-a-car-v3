const reservationSql = require('../services/sql/reservationSqlService');

async function findActiveBySessionId(sessionId, client = null) {
  return reservationSql.findActiveBySessionId(sessionId, client);
}

async function findByStripeSessionId(stripeSessionId, client = null) {
  return reservationSql.findByStripeSessionId(stripeSessionId, client);
}

async function findById(id, client = null) {
  return reservationSql.findById(id, client);
}

async function findOverlappingHold(criteria, client = null) {
  return reservationSql.findOverlappingHold(criteria, client);
}

async function findBookedDateOverlap(carId, startDate, endDate, client = null) {
  return reservationSql.findBookedDateOverlap(carId, startDate, endDate, client);
}

async function create(payload, client = null) {
  return reservationSql.createPendingReservation(payload, client);
}

async function createWithAvailabilityCheck(payload) {
  return reservationSql.createPendingReservationWithAvailabilityCheck(payload);
}

async function createConfirmed(payload, client = null) {
  return reservationSql.createConfirmedReservation(payload, client);
}

async function update(reservation, client = null) {
  return reservationSql.update(reservation, client);
}

async function findProcessingWithStripeSession(client = null) {
  return reservationSql.findProcessingWithStripeSession(client);
}

async function findProcessingWithExpiredHold(now = new Date(), client = null) {
  return reservationSql.findProcessingWithExpiredHold(now, client);
}

async function markExpired(reservationId, now = new Date(), client = null) {
  return reservationSql.markReservationExpired(reservationId, now, client);
}

async function markAbandoned(activeSessionIds, now = new Date(), client = null) {
  return reservationSql.markAbandonedReservations(activeSessionIds, now, client);
}

module.exports = {
  findActiveBySessionId,
  findById,
  findByStripeSessionId,
  findProcessingWithStripeSession,
  findProcessingWithExpiredHold,
  markExpired,
  findOverlappingHold,
  findBookedDateOverlap,
  create,
  createWithAvailabilityCheck,
  createConfirmed,
  update,
  markAbandoned,
};
