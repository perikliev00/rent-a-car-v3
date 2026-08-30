const cancellationSql = require('../../sql/cancellationRequestSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { logAdminAction } = require('../adminAuditService');
const { REFUNDABLE_STATUSES } = require('../../payment/refund/refundPolicy');
const { requestReservationRefund } = require('../../payment/refund/reservationRefundService');

async function listCancellationRequests() {
  return cancellationSql.listPending({ limit: 50 });
}

async function reviewCancellationRequest(req, requestId, { approve, adminNote }) {
  const existing = await cancellationSql.findById(requestId);
  if (!existing || existing.status !== 'pending') {
    const err = new Error('Cancellation request not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!approve) {
    const reviewed = await cancellationSql.review({
      id: requestId,
      status: 'rejected',
      adminNote,
      reviewedByUserId: req.session?.user?.id ?? null,
    });
    const reservation = await reservationSql.findById(existing.reservationId);
    await logAdminAction(req, {
      action: 'admin.cancellation_request_rejected',
      entityType: 'reservation',
      entityId: existing.reservationId,
      metadata: { requestId, adminNote: adminNote || null },
    });
    return { cancellationRequest: reviewed, reservation };
  }

  let reservation = await reservationSql.findById(existing.reservationId);
  let refundResult = null;

  if (reservation && reservation.status !== 'cancelled') {
    if (REFUNDABLE_STATUSES.includes(reservation.status)) {
      try {
        refundResult = await requestReservationRefund(req, {
          reservationId: existing.reservationId,
          reason: adminNote || 'cancellation_request_approved',
        });
        reservation = refundResult.reservation;
      } catch (err) {
        if (err.code === 'REFUND_NO_PAYMENT_INTENT' || err.code === 'REFUND_NO_AMOUNT') {
          const result = await changeStatus({
            reservationId: existing.reservationId,
            newStatus: 'cancelled',
            reason: adminNote || 'cancellation_request_approved',
            actor: { type: 'admin', req, userId: req.session?.user?.id },
            metadata: { cancellationRequestId: requestId },
          });
          reservation = result.reservation;
        } else {
          throw err;
        }
      }
    } else {
      const result = await changeStatus({
        reservationId: existing.reservationId,
        newStatus: 'cancelled',
        reason: adminNote || 'cancellation_request_approved',
        actor: { type: 'admin', req, userId: req.session?.user?.id },
        metadata: { cancellationRequestId: requestId },
      });
      reservation = result.reservation;
    }
  }

  const reviewed = await cancellationSql.review({
    id: requestId,
    status: 'approved',
    adminNote,
    reviewedByUserId: req.session?.user?.id ?? null,
  });

  await logAdminAction(req, {
    action: 'admin.cancellation_request_approved',
    entityType: 'reservation',
    entityId: existing.reservationId,
    metadata: {
      requestId,
      adminNote: adminNote || null,
      refundOperationId: refundResult?.refundOperation?.id || null,
      refundStatus: refundResult?.status || null,
    },
  });

  return { cancellationRequest: reviewed, reservation };
}

module.exports = {
  listCancellationRequests,
  reviewCancellationRequest,
};
