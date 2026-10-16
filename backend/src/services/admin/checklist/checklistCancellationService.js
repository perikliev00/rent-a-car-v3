/**
 * Admin review of customer cancellation requests. Approving a paid reservation
 * requires can_refund_payments and triggers Stripe refund when a payment exists;
 * otherwise falls back to a status-only cancel.
 */
const cancellationSql = require('../../sql/cancellationRequestSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { logAdminAction } = require('../adminAuditService');
const { REFUNDABLE_STATUSES } = require('../../payment/refund/refundPolicy');
const { requestReservationRefund } = require('../../payment/refund/reservationRefundService');
const rbacService = require('../../rbac/rbacService');

/** Normalize session roles/permissions for RBAC checks. */
function sessionAccess(req) {
  const user = req?.session?.user || {};
  return {
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

/** Gate paid-cancellation approval behind refund permission. */
function assertCanRefundPaidCancellation(req) {
  if (rbacService.userHasPermission(sessionAccess(req), 'can_refund_payments')) {
    return;
  }
  const err = new Error(
    'Refund permission is required to approve cancellation of a paid reservation.'
  );
  err.code = 'FORBIDDEN';
  err.status = 403;
  throw err;
}

/** Pending cancellation requests for the ops queue. */
async function listCancellationRequests() {
  return cancellationSql.listPending({ limit: 50 });
}

/**
 * Approve (cancel + optional refund) or reject a pending cancellation request.
 * @param {import('express').Request} req
 * @param {number|string} requestId
 * @param {{approve: boolean, adminNote?: string}} decision
 */
async function reviewCancellationRequest(req, requestId, { approve, adminNote }) {
  const existing = await cancellationSql.findById(requestId);
  // Idempotency guard: return early when work was already applied.
  if (!existing || existing.status !== 'pending') {
    const err = new Error('Cancellation request not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Guard: early-return or throw when required input is missing/invalid.
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

  // Status / lifecycle guard before mutating domain state.
  if (reservation && reservation.status !== 'cancelled') {
    // Status / lifecycle guard before mutating domain state.
    if (REFUNDABLE_STATUSES.includes(reservation.status)) {
      assertCanRefundPaidCancellation(req);
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
