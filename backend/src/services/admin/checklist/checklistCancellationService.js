/**
 * Admin review of customer cancellation requests. Approving a paid reservation
 * requires can_refund_payments and triggers Stripe refund when a payment exists;
 * otherwise falls back to a status-only cancel.
 */
const cancellationSql = require('../../sql/cancellationRequestSqlService');
// Require the '../../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../sql/reservationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../reservation/reservationStatusService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../adminAuditService');
// Destructure object properties into local variables.
const { REFUNDABLE_STATUSES } = require('../../payment/refund/refundPolicy');
// Destructure object properties into local variables.
const { requestReservationRefund } = require('../../payment/refund/reservationRefundService');
// Require the '../../rbac/rbacService' module as rbacService.
const rbacService = require('../../rbac/rbacService');

/** Normalize session roles/permissions for RBAC checks. */
function sessionAccess(req) {
  // Create the user constant.
  const user = req?.session?.user || {};
  // Return the resulting value to the caller.
  return {
    // Provide the roles field value.
    roles: Array.isArray(user.roles) ? user.roles : [],
    // Provide the permissions field value.
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

/** Gate paid-cancellation approval behind refund permission. */
function assertCanRefundPaidCancellation(req) {
  // Evaluate the condition and enter the branch when it is true.
  if (rbacService.userHasPermission(sessionAccess(req), 'can_refund_payments')) {
    // Return control to the caller with the following value.
    return;
  }
  // Create the err constant.
  const err = new Error(
    // Supply the literal value used by the enclosing expression.
    'Refund permission is required to approve cancellation of a paid reservation.'
  );
  // Update err.code with the right-hand side value.
  err.code = 'FORBIDDEN';
  // Update err.status with the right-hand side value.
  err.status = 403;
  // Throw an error to stop the current control flow.
  throw err;
}

/** Pending cancellation requests for the ops queue. */
async function listCancellationRequests() {
  // Return the resulting value to the caller.
  return cancellationSql.listPending({ limit: 50 });
}

/**
 * Approve (cancel + optional refund) or reject a pending cancellation request.
 * @param {import('express').Request} req
 * @param {number|string} requestId
 * @param {{approve: boolean, adminNote?: string}} decision
 */
async function reviewCancellationRequest(req, requestId, { approve, adminNote }) {
  // Create the existing constant.
  const existing = await cancellationSql.findById(requestId);
  // Idempotency guard: return early when work was already applied.
  if (!existing || existing.status !== 'pending') {
    // Create the err constant.
    const err = new Error('Cancellation request not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!approve) {
    // Create the reviewed constant.
    const reviewed = await cancellationSql.review({
      // Provide the id field value.
      id: requestId,
      // Provide the status field value.
      status: 'rejected',
      // Contribute this line to the enclosing declaration or statement.
      adminNote,
      // Provide the reviewed by user id field value.
      reviewedByUserId: req.session?.user?.id ?? null,
    });
    // Create the reservation constant.
    const reservation = await reservationSql.findById(existing.reservationId);
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.cancellation_request_rejected',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: existing.reservationId,
      // Provide the metadata field value.
      metadata: { requestId, adminNote: adminNote || null },
    });
    // Return the resulting value to the caller.
    return { cancellationRequest: reviewed, reservation };
  }

  // Initialize the mutable reservation variable.
  let reservation = await reservationSql.findById(existing.reservationId);
  // Initialize the mutable refund result variable.
  let refundResult = null;

  // Status / lifecycle guard before mutating domain state.
  if (reservation && reservation.status !== 'cancelled') {
    // Status / lifecycle guard before mutating domain state.
    if (REFUNDABLE_STATUSES.includes(reservation.status)) {
      // Call assertCanRefundPaidCancellation to perform this step.
      assertCanRefundPaidCancellation(req);
      // Start a try block for operations that may fail.
      try {
        // Store the awaited result in refundResult.
        refundResult = await requestReservationRefund(req, {
          // Provide the reservation id field value.
          reservationId: existing.reservationId,
          // Provide the reason field value.
          reason: adminNote || 'cancellation_request_approved',
        });
        // Update reservation with the right-hand side value.
        reservation = refundResult.reservation;
      // Continue the surrounding logic with this statement.
      } catch (err) {
        // Evaluate the condition and enter the branch when it is true.
        if (err.code === 'REFUND_NO_PAYMENT_INTENT' || err.code === 'REFUND_NO_AMOUNT') {
          // Create the result constant.
          const result = await changeStatus({
            // Provide the reservation id field value.
            reservationId: existing.reservationId,
            // Provide the new status field value.
            newStatus: 'cancelled',
            // Provide the reason field value.
            reason: adminNote || 'cancellation_request_approved',
            // Provide the actor field value.
            actor: { type: 'admin', req, userId: req.session?.user?.id },
            // Provide the metadata field value.
            metadata: { cancellationRequestId: requestId },
          });
          // Update reservation with the right-hand side value.
          reservation = result.reservation;
        // Contribute this line to the enclosing declaration or statement.
        } else {
          // Throw an error to stop the current control flow.
          throw err;
        }
      }
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Create the result constant.
      const result = await changeStatus({
        // Provide the reservation id field value.
        reservationId: existing.reservationId,
        // Provide the new status field value.
        newStatus: 'cancelled',
        // Provide the reason field value.
        reason: adminNote || 'cancellation_request_approved',
        // Provide the actor field value.
        actor: { type: 'admin', req, userId: req.session?.user?.id },
        // Provide the metadata field value.
        metadata: { cancellationRequestId: requestId },
      });
      // Update reservation with the right-hand side value.
      reservation = result.reservation;
    }
  }

  // Create the reviewed constant.
  const reviewed = await cancellationSql.review({
    // Provide the id field value.
    id: requestId,
    // Provide the status field value.
    status: 'approved',
    // Contribute this line to the enclosing declaration or statement.
    adminNote,
    // Provide the reviewed by user id field value.
    reviewedByUserId: req.session?.user?.id ?? null,
  });

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.cancellation_request_approved',
    // Provide the entity type field value.
    entityType: 'reservation',
    // Provide the entity id field value.
    entityId: existing.reservationId,
    // Provide the metadata field value.
    metadata: {
      // Contribute this line to the enclosing declaration or statement.
      requestId,
      // Provide the admin note field value.
      adminNote: adminNote || null,
      // Provide the refund operation id field value.
      refundOperationId: refundResult?.refundOperation?.id || null,
      // Provide the refund status field value.
      refundStatus: refundResult?.status || null,
    },
  });

  // Return the resulting value to the caller.
  return { cancellationRequest: reviewed, reservation };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCancellationRequests,
  // Contribute this line to the enclosing declaration or statement.
  reviewCancellationRequest,
};
