const repo = require('./calendar.repository');
const mapper = require('./calendar.eventMapper');
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');
const { logAdminAction } = require('../../services/admin/adminAuditService');
const reservationSql = require('../../services/sql/reservationSqlService');
const { clientQuery } = require('../../db/transaction');
const { changeStatus } = require('../../services/reservation/reservationStatusService');
const { canTransition } = require('../../domain/reservationStatus');
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');

async function getEventDetails(access, eventId) {
  const parsed = mapper.parseEventId(eventId);
  if (!parsed) throw createHttpError('VALIDATION_ERROR', 'Invalid event id.', 422);

  if (
    ['reservation', 'pickup', 'return', 'manual_review', 'payment_issue'].includes(parsed.type)
  ) {
    const reservation = await repo.findReservationById(parsed.id);
    if (!reservation) throw createHttpError('NOT_FOUND', 'Not found.', 404);

    if (isOwnTasksOnly(access)) {
      const allowed = await repo.hasAssignedTask(access.userId, reservation.id);
      if (!allowed) {
        throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
      }
    }

    const canPhone = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_PHONE);
    const canDocs = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_DOCS);
    const canRevenue = rbacService.userHasPermission(access, 'can_view_revenue');
    const canAudit = rbacService.userHasPermission(access, 'can_view_audit_logs');

    let documents = [];
    if (canDocs) {
      try {
        const docs = await clientQuery(
          null,
          `
          SELECT id, doc_type, original_filename, created_at
          FROM customer_documents
          WHERE reservation_id = $1
             OR (user_id IS NOT NULL AND user_id = $2)
          ORDER BY created_at DESC
          LIMIT 20
          `,
          [reservation.id, reservation.user_id]
        );
        documents = docs.rows.map((d) => ({
          id: String(d.id),
          docType: d.doc_type,
          fileName: d.original_filename,
          createdAt: d.created_at,
        }));
      } catch {
        documents = [];
      }
    }

    let auditHistory = [];
    if (canAudit) {
      try {
        const logs = await clientQuery(
          null,
          `
          SELECT id, action, entity_type, created_at, metadata
          FROM admin_audit_logs
          WHERE entity_type IN ('reservation','order') AND entity_id = $1
          ORDER BY created_at DESC
          LIMIT 30
          `,
          [String(reservation.id)]
        );
        auditHistory = logs.rows.map((l) => ({
          id: String(l.id),
          action: l.action,
          entityType: l.entity_type,
          createdAt: l.created_at,
          metadata: l.metadata,
        }));
      } catch {
        auditHistory = [];
      }
    }

    return {
      eventId,
      type: parsed.type,
      reservation: {
        id: String(reservation.id),
        status: reservation.status,
        pickupDate: reservation.pickup_date,
        returnDate: reservation.return_date,
        pickupLocation: reservation.pickup_location,
        returnLocation: reservation.return_location,
        fullName: reservation.full_name,
        email: reservation.email,
        phoneNumber: canPhone ? reservation.phone_number : null,
        totalPrice:
          canRevenue && reservation.total_price != null ? Number(reservation.total_price) : null,
        carId: String(reservation.car_id),
        carName: reservation.car_name,
        specialRequests: reservation.special_requests || null,
        flightNumber: reservation.flight_number || null,
      },
      documents,
      auditHistory,
      actions: {
        canMove: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.MOVE),
        canResize: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.RESIZE),
        canMarkPickup: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.MARK_PICKUP),
        canMarkReturn: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.MARK_RETURN),
        canRefund: rbacService.userHasPermission(access, 'can_refund_payments'),
        canChangeStatus: rbacService.userHasPermission(
          access,
          'can_change_reservation_status'
        ),
        canCancel:
          rbacService.userHasPermission(access, 'can_cancel_orders') &&
          canTransition(reservation.status, 'cancelled'),
      },
    };
  }

  if (parsed.type === 'task') {
    const row = await repo.findTaskById(parsed.id);
    if (!row) throw createHttpError('NOT_FOUND', 'Not found.', 404);
    if (isOwnTasksOnly(access)) {
      if (String(row.assigned_to_user_id) !== String(access.userId)) {
        throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
      }
    }
    return { eventId, type: 'task', task: repo.mapTask(row) };
  }

  if (parsed.type === 'blocked') {
    if (isOwnTasksOnly(access)) {
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    const row = await repo.findBlockById(parsed.id);
    if (!row) throw createHttpError('NOT_FOUND', 'Not found.', 404);
    return { eventId, type: 'blocked', block: mapper.mapBlockEvent(row) };
  }

  throw createHttpError('NOT_FOUND', 'Not found.', 404);
}

async function cancelReservationFromCalendar(access, reservationId, req) {
  if (!rbacService.userHasPermission(access, 'can_cancel_orders')) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }

  const existing = await reservationSql.findById(reservationId);
  if (!existing) {
    throw createHttpError('NOT_FOUND', 'Reservation not found.', 404);
  }

  if (!canTransition(existing.status, 'cancelled')) {
    throw createHttpError(
      'INVALID_STATUS_TRANSITION',
      `Cannot cancel reservation from status ${existing.status}.`,
      422
    );
  }

  const result = await changeStatus({
    reservationId,
    newStatus: 'cancelled',
    reason: 'calendar_cancel',
    actor: {
      type: 'admin',
      req,
      userId: access.userId ?? req?.session?.user?.id ?? null,
    },
    metadata: { source: 'calendar' },
  });

  await logAdminAction(req, {
    action: 'calendar.reservation.cancel',
    entityType: 'reservation',
    entityId: String(reservationId),
    metadata: { previousStatus: result.oldStatus },
  });

  emitCalendarUpdated({
    action: 'reservation_cancelled',
    entityType: 'reservation',
    entityId: reservationId,
  });

  return {
    reservation: result.reservation,
    changed: result.changed,
    oldStatus: result.oldStatus,
    newStatus: result.newStatus,
  };
}

module.exports = {
  getEventDetails,
  cancelReservationFromCalendar,
};
