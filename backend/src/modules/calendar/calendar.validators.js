const { body, param, query } = require('express-validator');
const { TASK_TYPES, TASK_STATUSES } = require('./calendar.taskDomain');

const rangeQuery = [
  query('from').isISO8601().withMessage('from is required'),
  query('to').isISO8601().withMessage('to is required'),
];

const dayParam = [param('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD')];

const carParam = [param('carId').isInt({ min: 1 }).withMessage('Invalid car id')];

const eventIdParam = [param('id').isString().notEmpty()];

const moveBody = [
  body('start').isISO8601().withMessage('start is required'),
  body('end').isISO8601().withMessage('end is required'),
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  body('force').optional().isBoolean(),
];

const manualEventBody = [
  body('carId').isInt({ min: 1 }),
  body('start').isISO8601(),
  body('end').isISO8601(),
  body('blockType').optional().isIn(['manual', 'maintenance', 'other']),
  body('reason').optional().isString().isLength({ max: 500 }),
  body('notes').optional().isString().isLength({ max: 2000 }),
  body('force').optional().isBoolean(),
];

const taskBody = [
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  body('taskType').isIn(TASK_TYPES).withMessage('Invalid task type'),
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  body('reservationId').optional({ nullable: true }).isInt({ min: 1 }),
  body('assignedToUserId').optional({ nullable: true }).isInt({ min: 1 }),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('dueAt').optional({ nullable: true }).isISO8601(),
  body('notes').optional().isString().isLength({ max: 2000 }),
  body('locationText').optional().isString().isLength({ max: 500 }),
];

const taskStatusBody = [
  body('status').isIn([...TASK_STATUSES]),
];

const manualEventIdParam = [param('id').isInt({ min: 1 })];

const manualEventPatchBody = [
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  body('start').optional().isISO8601(),
  body('end').optional().isISO8601(),
  body('blockType').optional().isIn(['manual', 'maintenance', 'other']),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('force').optional().isBoolean(),
];

const taskIdParam = [param('id').isInt({ min: 1 })];

const reservationIdParam = [param('id').isInt({ min: 1 }).withMessage('Invalid reservation id')];

const taskPatchBody = [
  body('title').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('taskType').optional().isIn(TASK_TYPES),
  body('carId').optional({ nullable: true }).isInt({ min: 1 }),
  body('reservationId').optional({ nullable: true }).isInt({ min: 1 }),
  body('assignedToUserId').optional({ nullable: true }).isInt({ min: 1 }),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('dueAt').optional({ nullable: true }).isISO8601(),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('locationText').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

const taskListQuery = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('assignee').optional().isString().isLength({ max: 32 }),
  query('type').optional().isIn(TASK_TYPES),
  query('types')
    .optional()
    .customSanitizer((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
      return undefined;
    })
    .custom((arr) => {
      if (arr == null) return true;
      if (!Array.isArray(arr)) return false;
      return arr.every((t) => TASK_TYPES.includes(t));
    })
    .withMessage('Invalid types'),
  query('status').optional().isIn(TASK_STATUSES),
  query('carId').optional().isInt({ min: 1 }),
  query('unassigned').optional().isIn(['true', 'false', '1', '0']),
  query('includeCancelled').optional().isIn(['true', 'false', '1', '0']),
];

module.exports = {
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
  reservationIdParam,
  taskPatchBody,
  taskListQuery,
};
