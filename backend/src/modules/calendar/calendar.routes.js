/**
 * Express routes for the staff calendar API.
 *
 * Permission middleware is applied per route; task status updates allow
 * VIEW/VIEW_OWN/CREATE_TASKS — finer assignee checks live in the service.
 */

const express = require('express');
// Require the './calendar.controller' module as calendarController.
const calendarController = require('./calendar.controller');
// Destructure object properties into local variables.
const { requireStaffApi, requireAnyPermission, requirePermission } = require('../../middleware/auth');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  rangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  dayParam,
  // Contribute this line to the enclosing declaration or statement.
  carParam,
  // Contribute this line to the enclosing declaration or statement.
  eventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  moveBody,
  // Contribute this line to the enclosing declaration or statement.
  manualEventBody,
  // Contribute this line to the enclosing declaration or statement.
  taskBody,
  // Contribute this line to the enclosing declaration or statement.
  taskStatusBody,
  // Contribute this line to the enclosing declaration or statement.
  manualEventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  manualEventPatchBody,
  // Contribute this line to the enclosing declaration or statement.
  taskIdParam,
  // Contribute this line to the enclosing declaration or statement.
  taskPatchBody,
  // Contribute this line to the enclosing declaration or statement.
  taskListQuery,
  // Contribute this line to the enclosing declaration or statement.
  reservationIdParam,
// Continue the surrounding logic with this statement.
} = require('./calendar.validators');
// Destructure object properties into local variables.
const { CALENDAR_PERMISSIONS } = require('./calendar.permissions');

// Create the router constant.
const router = express.Router();

// Create the can view constant.
const canView = [
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Call requireAnyPermission to perform this step.
  requireAnyPermission([CALENDAR_PERMISSIONS.VIEW, CALENDAR_PERMISSIONS.VIEW_OWN]),
];

// Create the can create blocks constant.
const canCreateBlocks = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.CREATE_BLOCKS)];
// Create the can create tasks constant.
const canCreateTasks = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.CREATE_TASKS)];
// Create the can assign constant.
const canAssign = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.ASSIGN_STAFF)];
// Create the can move constant.
const canMove = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.MOVE)];
// Create the can resize constant.
const canResize = [requireStaffApi, requirePermission(CALENDAR_PERMISSIONS.RESIZE)];
// Create the can cancel reservation constant.
const canCancelReservation = [requireStaffApi, requirePermission('can_cancel_orders')];

// Task status: assignee or task managers (service enforces); route allows view/own or create-tasks
const canUpdateTaskStatus = [
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Call requireAnyPermission to perform this step.
  requireAnyPermission([
    // Contribute this line to the enclosing declaration or statement.
    CALENDAR_PERMISSIONS.VIEW,
    // Contribute this line to the enclosing declaration or statement.
    CALENDAR_PERMISSIONS.VIEW_OWN,
    // Contribute this line to the enclosing declaration or statement.
    CALENDAR_PERMISSIONS.CREATE_TASKS,
  ]),
];

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/events',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  rangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.getEvents
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/day/:date',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  dayParam,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.getDay
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/car/:carId',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  carParam,
  // Contribute this line to the enclosing declaration or statement.
  rangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.getCar
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/availability',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  rangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.getAvailability
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/conflicts',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  rangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.getConflicts
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/events/:id/details',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  eventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.getEventDetails
);

// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/manual-events',
  // Spread canCreateBlocks into the surrounding structure.
  ...canCreateBlocks,
  // Contribute this line to the enclosing declaration or statement.
  manualEventBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.createManualEvent
);

// Call router.patch to perform this step.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/manual-events/:id',
  // Spread canCreateBlocks into the surrounding structure.
  ...canCreateBlocks,
  // Contribute this line to the enclosing declaration or statement.
  manualEventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  manualEventPatchBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.updateManualEvent
);

// Call router.delete to perform this step.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/manual-events/:id',
  // Spread canCreateBlocks into the surrounding structure.
  ...canCreateBlocks,
  // Contribute this line to the enclosing declaration or statement.
  manualEventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.deleteManualEvent
);

// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/tasks',
  // Spread canCreateTasks into the surrounding structure.
  ...canCreateTasks,
  // Contribute this line to the enclosing declaration or statement.
  taskBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.createTask
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/tasks',
  // Spread canView into the surrounding structure.
  ...canView,
  // Contribute this line to the enclosing declaration or statement.
  taskListQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.listTasks
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/assignable-staff',
  // Spread canAssign into the surrounding structure.
  ...canAssign,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.listAssignableStaff
);

// Call router.patch to perform this step.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/tasks/:id/status',
  // Spread canUpdateTaskStatus into the surrounding structure.
  ...canUpdateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  taskIdParam,
  // Contribute this line to the enclosing declaration or statement.
  taskStatusBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.updateTaskStatus
);

// Call router.patch to perform this step.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/tasks/:id',
  // Spread canCreateTasks into the surrounding structure.
  ...canCreateTasks,
  // Contribute this line to the enclosing declaration or statement.
  taskIdParam,
  // Contribute this line to the enclosing declaration or statement.
  taskPatchBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.updateTask
);

// Call router.delete to perform this step.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/tasks/:id',
  // Spread canCreateTasks into the surrounding structure.
  ...canCreateTasks,
  // Contribute this line to the enclosing declaration or statement.
  taskIdParam,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.deleteTask
);

// Call router.patch to perform this step.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/events/:id/move',
  // Spread canMove into the surrounding structure.
  ...canMove,
  // Contribute this line to the enclosing declaration or statement.
  eventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  moveBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.moveEvent
);

// Call router.patch to perform this step.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/events/:id/resize',
  // Spread canResize into the surrounding structure.
  ...canResize,
  // Contribute this line to the enclosing declaration or statement.
  eventIdParam,
  // Contribute this line to the enclosing declaration or statement.
  moveBody,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.resizeEvent
);

// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/reservations/:id/cancel',
  // Spread canCancelReservation into the surrounding structure.
  ...canCancelReservation,
  // Contribute this line to the enclosing declaration or statement.
  reservationIdParam,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  calendarController.cancelReservation
);

// Assign the CommonJS module exports.
module.exports = router;
