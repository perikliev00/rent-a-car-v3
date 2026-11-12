/**
 * express-validator chains for calendar routes.
 *
 * Keep request shape validation here; domain rules live in services.
 */

const { body, param, query } = require('express-validator');
// Destructure object properties into local variables.
const { TASK_TYPES, TASK_STATUSES } = require('./calendar.taskDomain');

/** ISO8601 from/to query pair for range endpoints. */
const rangeQuery = [
  // Call query to perform this step.
  query('from').isISO8601().withMessage('from is required'),
  // Call query to perform this step.
  query('to').isISO8601().withMessage('to is required'),
];

// Create the day param constant.
const dayParam = [param('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD')];

// Create the car param constant.
const carParam = [param('carId').isInt({ min: 1 }).withMessage('Invalid car id')];

// Create the event id param constant.
const eventIdParam = [param('id').isString().notEmpty()];

/** Body for move and resize (start/end required; carId/force optional). */
const moveBody = [
  // Call body to perform this step.
  body('start').isISO8601().withMessage('start is required'),
  // Call body to perform this step.
  body('end').isISO8601().withMessage('end is required'),
  // Call body to perform this step.
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('force').optional().isBoolean(),
];

// Create the manual event body constant.
const manualEventBody = [
  // Call body to perform this step.
  body('carId').isInt({ min: 1 }),
  // Call body to perform this step.
  body('start').isISO8601(),
  // Call body to perform this step.
  body('end').isISO8601(),
  // Call body to perform this step.
  body('blockType').optional().isIn(['manual', 'maintenance', 'other']),
  // Call body to perform this step.
  body('reason').optional().isString().isLength({ max: 500 }),
  // Call body to perform this step.
  body('notes').optional().isString().isLength({ max: 2000 }),
  // Call body to perform this step.
  body('force').optional().isBoolean(),
];

// Create the task body constant.
const taskBody = [
  // Call body to perform this step.
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  // Call body to perform this step.
  body('taskType').isIn(TASK_TYPES).withMessage('Invalid task type'),
  // Call body to perform this step.
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('reservationId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('assignedToUserId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('startsAt').optional({ nullable: true }).isISO8601(),
  // Call body to perform this step.
  body('dueAt').optional({ nullable: true }).isISO8601(),
  // Call body to perform this step.
  body('notes').optional().isString().isLength({ max: 2000 }),
  // Call body to perform this step.
  body('locationText').optional().isString().isLength({ max: 500 }),
];

// Create the task status body constant.
const taskStatusBody = [
  // Call body to perform this step.
  body('status').isIn([...TASK_STATUSES]),
];

// Create the manual event id param constant.
const manualEventIdParam = [param('id').isInt({ min: 1 })];

// Create the manual event patch body constant.
const manualEventPatchBody = [
  // Call body to perform this step.
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('start').optional().isISO8601(),
  // Call body to perform this step.
  body('end').optional().isISO8601(),
  // Call body to perform this step.
  body('blockType').optional().isIn(['manual', 'maintenance', 'other']),
  // Call body to perform this step.
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
  // Call body to perform this step.
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  // Call body to perform this step.
  body('force').optional().isBoolean(),
];

// Create the task id param constant.
const taskIdParam = [param('id').isInt({ min: 1 })];

// Create the reservation id param constant.
const reservationIdParam = [param('id').isInt({ min: 1 }).withMessage('Invalid reservation id')];

// Create the task patch body constant.
const taskPatchBody = [
  // Call body to perform this step.
  body('title').optional().isString().trim().isLength({ min: 1, max: 255 }),
  // Call body to perform this step.
  body('taskType').optional().isIn(TASK_TYPES),
  // Call body to perform this step.
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('reservationId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('assignedToUserId').optional({ nullable: true }).isInt({ min: 1 }),
  // Call body to perform this step.
  body('startsAt').optional({ nullable: true }).isISO8601(),
  // Call body to perform this step.
  body('dueAt').optional({ nullable: true }).isISO8601(),
  // Call body to perform this step.
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  // Call body to perform this step.
  body('locationText').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

/** List filters; `types` accepts comma-separated or repeated query values. */
const taskListQuery = [
  // Call query to perform this step.
  query('from').optional().isISO8601(),
  // Call query to perform this step.
  query('to').optional().isISO8601(),
  // Call query to perform this step.
  query('assignee').optional().isString().isLength({ max: 32 }),
  // Call query to perform this step.
  query('type').optional().isIn(TASK_TYPES),
  // Call query to perform this step.
  query('types')
    // Call .optional to perform this step.
    .optional()
    // Call .customSanitizer to perform this step.
    .customSanitizer((v) => {
      // Evaluate the condition and enter the branch when it is true.
      if (Array.isArray(v)) return v;
      // Evaluate the condition and enter the branch when it is true.
      if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
      // Return the resulting value to the caller.
      return undefined;
    })
    // Call .custom to perform this step.
    .custom((arr) => {
      // Evaluate the condition and enter the branch when it is true.
      if (arr == null) return true;
      // Evaluate the condition and enter the branch when it is true.
      if (!Array.isArray(arr)) return false;
      // Return the resulting value to the caller.
      return arr.every((t) => TASK_TYPES.includes(t));
    })
    // Call .withMessage to perform this step.
    .withMessage('Invalid types'),
  // Call query to perform this step.
  query('status').optional().isIn(TASK_STATUSES),
  // Call query to perform this step.
  query('carId').optional().isInt({ min: 1 }),
  // Call query to perform this step.
  query('unassigned').optional().isIn(['true', 'false', '1', '0']),
  // Call query to perform this step.
  query('includeCancelled').optional().isIn(['true', 'false', '1', '0']),
];

// Assign the CommonJS module exports.
module.exports = {
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
  reservationIdParam,
  // Contribute this line to the enclosing declaration or statement.
  taskPatchBody,
  // Contribute this line to the enclosing declaration or statement.
  taskListQuery,
};
