const express = require('express');
const calendarController = require('./calendar.controller');
const { requireStaffApi, requireAnyPermission, requirePermission } = require('../../middleware/auth');
const validateRequest = require('../../middleware/validateRequest');
const {
  rangeQuery,
  dayParam,
  carParam,
  eventIdParam,
  moveBody,
  manualEventBody,
  taskBody,
  taskStatusBody,
  manualEventIdParam,
  manualEventPatchBody,
  taskIdParam,
  taskPatchBody,
  taskListQuery,
  reservationIdParam,
} = require('./calendar.validators');
const { CALENDAR_PERMISSIONS } = require('./calendar.permissions');

const router = express.Router();

const canView = [
  requireStaffApi,
  requireAnyPermission([CALENDAR_PERMISSIONS.VIEW, CALENDAR_PERMISSIONS.VIEW_OWN]),
];

const canCreateBlocks = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.CREATE_BLOCKS)];
const canCreateTasks = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.CREATE_TASKS)];
const canAssign = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.ASSIGN_STAFF)];
const canMove = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.MOVE)];
const canResize = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.RESIZE)];
const canCancelReservation = [requireStaffApi, requirePermission('can_cancel_orders')];

// Task status: assignee or task managers (service enforces); route allows view/own or create-tasks
const canUpdateTaskStatus = [
  requireStaffApi,
  requireAnyPermission([
    CALENDAR_PERMISSIONS.VIEW,
    CALENDAR_PERMISSIONS.VIEW_OWN,
    CALENDAR_PERMISSIONS.CREATE_TASKS,
  ]),
];

router.get(
  '/events',
  ...canView,
  rangeQuery,
  validateRequest,
  calendarController.getEvents
);

router.get(
  '/day/:date',
  ...canView,
  dayParam,
  validateRequest,
  calendarController.getDay
);

router.get(
  '/car/:carId',
  ...canView,
  carParam,
  rangeQuery,
  validateRequest,
  calendarController.getCar
);

router.get(
  '/availability',
  ...canView,
  rangeQuery,
  validateRequest,
  calendarController.getAvailability
);

router.get(
  '/conflicts',
  ...canView,
  rangeQuery,
  validateRequest,
  calendarController.getConflicts
);

router.get(
  '/events/:id/details',
  ...canView,
  eventIdParam,
  validateRequest,
  calendarController.getEventDetails
);

router.post(
  '/manual-events',
  ...canCreateBlocks,
  manualEventBody,
  validateRequest,
  calendarController.createManualEvent
);

router.patch(
  '/manual-events/:id',
  ...canCreateBlocks,
  manualEventIdParam,
  manualEventPatchBody,
  validateRequest,
  calendarController.updateManualEvent
);

router.delete(
  '/manual-events/:id',
  ...canCreateBlocks,
  manualEventIdParam,
  validateRequest,
  calendarController.deleteManualEvent
);

router.post(
  '/tasks',
  ...canCreateTasks,
  taskBody,
  validateRequest,
  calendarController.createTask
);

router.get(
  '/tasks',
  ...canView,
  taskListQuery,
  validateRequest,
  calendarController.listTasks
);

router.get(
  '/assignable-staff',
  ...canAssign,
  calendarController.listAssignableStaff
);

router.patch(
  '/tasks/:id/status',
  ...canUpdateTaskStatus,
  taskIdParam,
  taskStatusBody,
  validateRequest,
  calendarController.updateTaskStatus
);

router.patch(
  '/tasks/:id',
  ...canCreateTasks,
  taskIdParam,
  taskPatchBody,
  validateRequest,
  calendarController.updateTask
);

router.delete(
  '/tasks/:id',
  ...canCreateTasks,
  taskIdParam,
  validateRequest,
  calendarController.deleteTask
);

router.patch(
  '/events/:id/move',
  ...canMove,
  eventIdParam,
  moveBody,
  validateRequest,
  calendarController.moveEvent
);

router.patch(
  '/events/:id/resize',
  ...canResize,
  eventIdParam,
  moveBody,
  validateRequest,
  calendarController.resizeEvent
);

router.post(
  '/reservations/:id/cancel',
  ...canCancelReservation,
  reservationIdParam,
  validateRequest,
  calendarController.cancelReservation
);

module.exports = router;
