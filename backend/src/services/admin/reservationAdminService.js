const orderSql = require('../sql/orderSqlService');
const { addRange } = require('../sql/bookingSyncSqlService');
const {
  changeStatus,
} = require('../reservation/reservationStatusService');
const { ADMIN_OPS_STATUSES, isValidStatus } = require('../../domain/reservationStatus');
const historySql = require('../sql/reservationStatusHistorySqlService');
const reservationRepository = require('../../repositories/reservationRepository');
const { runWithTransaction } = require('../../db/transaction');
const rbacService = require('../rbac/rbacService');

function sessionAccess(req) {
  const user = req?.session?.user || {};
  return {
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

async function confirmManualReviewReservation(req, reservation, reason) {
  return runWithTransaction(async (client) => {
    const carId = reservation.carId?.id || reservation.carId;

    await addRange(carId, reservation.pickupDate, reservation.returnDate, client);

    const order = await orderSql.createOrderFromReservation(
      {
        ...reservation,
        stripeSessionId:
          reservation.stripeSessionId || `admin-confirm-${reservation.id}`,
      },
      carId,
      client
    );

    const { reservation: updated } = await changeStatus({
      reservationId: reservation.id,
      newStatus: 'confirmed',
      reason: reason || 'admin_manual_review_confirm',
      actor: {
        type: 'admin',
        req,
        userId: req?.session?.user?.id ?? null,
      },
      metadata: { source: 'admin_api', orderId: order.id },
      client,
    });

    return {
      reservation: updated,
      changed: true,
      oldStatus: 'manual_review',
      newStatus: 'confirmed',
      order,
    };
  });
}

async function changeReservationStatus(req, { reservationId, status, reason }) {
  if (!isValidStatus(status)) {
    const err = new Error('Invalid reservation status');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  if (!ADMIN_OPS_STATUSES.includes(status)) {
    const err = new Error('Status is not allowed for admin ops transitions');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  // Refunds require finance permission (receptionist can change ops status but not refund).
  if (status === 'refunded') {
    const access = sessionAccess(req);
    if (!rbacService.userHasPermission(access, 'can_refund_payments')) {
      const err = new Error('You do not have permission to refund reservations.');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }
  }

  const existing = await reservationRepository.findById(reservationId);
  if (!existing) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (existing.status === 'manual_review' && status === 'confirmed') {
    return confirmManualReviewReservation(req, existing, reason);
  }

  const result = await changeStatus({
    reservationId,
    newStatus: status,
    reason: reason || 'admin_status_change',
    actor: {
      type: 'admin',
      req,
      userId: req?.session?.user?.id ?? null,
    },
    metadata: { source: 'admin_api' },
  });

  return result;
}

async function getReservationDetail(reservationId) {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const history = await historySql.listHistoryForReservation(reservationId, { limit: 50 });
  return { reservation, history };
}

module.exports = {
  changeReservationStatus,
  getReservationDetail,
  ADMIN_OPS_STATUSES,
};
