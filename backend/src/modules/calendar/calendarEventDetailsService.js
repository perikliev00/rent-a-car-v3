/**
 * Event detail drawer + calendar-initiated reservation cancel.
 *
 * Redacts phone/docs/revenue/audit by permission. VIEW_OWN may only open
 * reservations they have an assigned task on, or their own tasks.
 */

const repo = require('./calendar.repository');
// Require the './calendar.eventMapper' module as mapper.
const mapper = require('./calendar.eventMapper');
// Destructure object properties into local variables.
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
// Require the '../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../services/rbac/rbacService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../services/admin/adminAuditService');
// Require the '../../services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../services/sql/reservationSqlService');
// Destructure object properties into local variables.
const { clientQuery } = require('../../db/transaction');
// Destructure object properties into local variables.
const { changeStatus } = require('../../services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const { canTransition } = require('../../domain/reservationStatus');
// Destructure object properties into local variables.
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');

/**
 * Load detail payload for a `type:id` calendar event.
 * @param {object} access
 * @param {string} eventId
 */
async function getEventDetails(access, eventId) {
  // Create the parsed constant.
  const parsed = mapper.parseEventId(eventId);
  // Evaluate the condition and enter the branch when it is true.
  if (!parsed) throw createHttpError('VALIDATION_ERROR', 'Invalid event id.', 422);

  // Reservation-family events share one detail payload (markers include pickup/return).
  if (
    // Continue the surrounding logic with this statement.
    ['reservation', 'pickup', 'return', 'manual_review', 'payment_issue'].includes(parsed.type)
  // Continue the surrounding logic with this statement.
  ) {
    // Create the reservation constant.
    const reservation = await repo.findReservationById(parsed.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!reservation) throw createHttpError('NOT_FOUND', 'Not found.', 404);

    // VIEW_OWN: only reservations where the caller has an assigned task.
    if (isOwnTasksOnly(access)) {
      // Create the allowed constant.
      const allowed = await repo.hasAssignedTask(access.userId, reservation.id);
      // Evaluate the condition and enter the branch when it is true.
      if (!allowed) {
        // Throw an error to stop the current control flow.
        throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
      }
    }

    // Field-level redaction flags for the drawer.
    const canPhone = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_PHONE);
    // Create the can docs constant.
    const canDocs = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_DOCS);
    // Create the can revenue constant.
    const canRevenue = rbacService.userHasPermission(access, 'can_view_revenue');
    // Create the can audit constant.
    const canAudit = rbacService.userHasPermission(access, 'can_view_audit_logs');

    // Optional customer documents (best-effort if table/query fails).
    let documents = [];
    // Evaluate the condition and enter the branch when it is true.
    if (canDocs) {
      // Start a try block for operations that may fail.
      try {
        // Create the docs constant.
        const docs = await clientQuery(
          // Supply the literal value used by the enclosing expression.
          null,
          // Continue the surrounding logic with this statement.
          `
          SELECT id, doc_type, original_filename, created_at
          FROM customer_documents
          WHERE reservation_id = $1
             OR (user_id IS NOT NULL AND user_id = $2)
          ORDER BY created_at DESC
          LIMIT 20
          `,
          // Contribute this line to the enclosing declaration or statement.
          [reservation.id, reservation.user_id]
        );
        // Update documents with the right-hand side value.
        documents = docs.rows.map((d) => ({
          // Provide the id field value.
          id: String(d.id),
          // Provide the doc type field value.
          docType: d.doc_type,
          // Provide the file name field value.
          fileName: d.original_filename,
          // Provide the created at field value.
          createdAt: d.created_at,
        }));
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // Update documents with the right-hand side value.
        documents = [];
      }
    }

    // Initialize the mutable audit history variable.
    let auditHistory = [];
    // Evaluate the condition and enter the branch when it is true.
    if (canAudit) {
      // Start a try block for operations that may fail.
      try {
        // Create the logs constant.
        const logs = await clientQuery(
          // Supply the literal value used by the enclosing expression.
          null,
          // Continue the surrounding logic with this statement.
          `
          SELECT id, action, entity_type, created_at, metadata
          FROM admin_audit_logs
          WHERE entity_type IN ('reservation','order') AND entity_id = $1
          ORDER BY created_at DESC
          LIMIT 30
          `,
          // Continue the surrounding logic with this statement.
          [String(reservation.id)]
        );
        // Update auditHistory with the right-hand side value.
        auditHistory = logs.rows.map((l) => ({
          // Provide the id field value.
          id: String(l.id),
          // Provide the action field value.
          action: l.action,
          // Provide the entity type field value.
          entityType: l.entity_type,
          // Provide the created at field value.
          createdAt: l.created_at,
          // Provide the metadata field value.
          metadata: l.metadata,
        }));
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // Update auditHistory with the right-hand side value.
        auditHistory = [];
      }
    }

    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      eventId,
      // Provide the type field value.
      type: parsed.type,
      // Provide the reservation field value.
      reservation: {
        // Provide the id field value.
        id: String(reservation.id),
        // Provide the status field value.
        status: reservation.status,
        // Provide the pickup date field value.
        pickupDate: reservation.pickup_date,
        // Provide the return date field value.
        returnDate: reservation.return_date,
        // Provide the pickup location field value.
        pickupLocation: reservation.pickup_location,
        // Provide the return location field value.
        returnLocation: reservation.return_location,
        // Provide the full name field value.
        fullName: reservation.full_name,
        // Provide the email field value.
        email: reservation.email,
        // Provide the phone number field value.
        phoneNumber: canPhone ? reservation.phone_number : null,
        // Provide the total price field value.
        totalPrice:
          // Continue the surrounding logic with this statement.
          canRevenue && reservation.total_price != null ? Number(reservation.total_price) : null,
        // Provide the car id field value.
        carId: String(reservation.car_id),
        // Provide the car name field value.
        carName: reservation.car_name,
        // Provide the special requests field value.
        specialRequests: reservation.special_requests || null,
        // Provide the flight number field value.
        flightNumber: reservation.flight_number || null,
      },
      // Contribute this line to the enclosing declaration or statement.
      documents,
      // Contribute this line to the enclosing declaration or statement.
      auditHistory,
      // Provide the actions field value.
      actions: {
        // Provide the can move field value.
        canMove: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.MOVE),
        // Provide the can resize field value.
        canResize: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.RESIZE),
        // Provide the can mark pickup field value.
        canMarkPickup: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.MARK_PICKUP),
        // Provide the can mark return field value.
        canMarkReturn: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.MARK_RETURN),
        // Provide the can refund field value.
        canRefund: rbacService.userHasPermission(access, 'can_refund_payments'),
        // Provide the can change status field value.
        canChangeStatus: rbacService.userHasPermission(
          // Contribute this line to the enclosing declaration or statement.
          access,
          // Supply the literal value used by the enclosing expression.
          'can_change_reservation_status'
        ),
        // Provide the can cancel field value.
        canCancel:
          // Call rbacService.userHasPermission to perform this step.
          rbacService.userHasPermission(access, 'can_cancel_orders') &&
          // Call canTransition to perform this step.
          canTransition(reservation.status, 'cancelled'),
      },
    };
  }

  // Task detail — VIEW_OWN may only open their own assignee.
  if (parsed.type === 'task') {
    // Create the row constant.
    const row = await repo.findTaskById(parsed.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!row) throw createHttpError('NOT_FOUND', 'Not found.', 404);
    // Evaluate the condition and enter the branch when it is true.
    if (isOwnTasksOnly(access)) {
      // Evaluate the condition and enter the branch when it is true.
      if (String(row.assigned_to_user_id) !== String(access.userId)) {
        // Throw an error to stop the current control flow.
        throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
      }
    }
    // Return the resulting value to the caller.
    return { eventId, type: 'task', task: repo.mapTask(row) };
  }

  // Block detail — fleet managers only (not VIEW_OWN).
  if (parsed.type === 'blocked') {
    // Evaluate the condition and enter the branch when it is true.
    if (isOwnTasksOnly(access)) {
      // Throw an error to stop the current control flow.
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    // Create the row constant.
    const row = await repo.findBlockById(parsed.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!row) throw createHttpError('NOT_FOUND', 'Not found.', 404);
    // Return the resulting value to the caller.
    return { eventId, type: 'blocked', block: mapper.mapBlockEvent(row) };
  }

  // Throw an error to stop the current control flow.
  throw createHttpError('NOT_FOUND', 'Not found.', 404);
}

/**
 * Cancel via reservation status service (reason calendar_cancel) and notify UI.
 * @param {object} access
 * @param {string|number} reservationId
 * @param {object} req
 */
async function cancelReservationFromCalendar(access, reservationId, req) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rbacService.userHasPermission(access, 'can_cancel_orders')) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }

  // Create the existing constant.
  const existing = await reservationSql.findById(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!existing) {
    // Throw an error to stop the current control flow.
    throw createHttpError('NOT_FOUND', 'Reservation not found.', 404);
  }

  // Domain status machine must allow cancelled from the current status.
  if (!canTransition(existing.status, 'cancelled')) {
    // Throw an error to stop the current control flow.
    throw createHttpError(
      // Supply the literal value used by the enclosing expression.
      'INVALID_STATUS_TRANSITION',
      // Continue the surrounding logic with this statement.
      `Cannot cancel reservation from status ${existing.status}.`,
      // Supply the literal value used by the enclosing expression.
      422
    );
  }

  // Route through reservationStatusService so side effects/listeners stay consistent.
  const result = await changeStatus({
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Provide the new status field value.
    newStatus: 'cancelled',
    // Provide the reason field value.
    reason: 'calendar_cancel',
    // Provide the actor field value.
    actor: {
      // Provide the type field value.
      type: 'admin',
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Provide the user id field value.
      userId: access.userId ?? req?.session?.user?.id ?? null,
    },
    // Provide the metadata field value.
    metadata: { source: 'calendar' },
  });

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.reservation.cancel',
    // Provide the entity type field value.
    entityType: 'reservation',
    // Provide the entity id field value.
    entityId: String(reservationId),
    // Provide the metadata field value.
    metadata: { previousStatus: result.oldStatus },
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'reservation_cancelled',
    // Provide the entity type field value.
    entityType: 'reservation',
    // Provide the entity id field value.
    entityId: reservationId,
  });

  // Return the resulting value to the caller.
  return {
    // Provide the reservation field value.
    reservation: result.reservation,
    // Provide the changed field value.
    changed: result.changed,
    // Provide the old status field value.
    oldStatus: result.oldStatus,
    // Provide the new status field value.
    newStatus: result.newStatus,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getEventDetails,
  // Contribute this line to the enclosing declaration or statement.
  cancelReservationFromCalendar,
};
