const express = require('express');
const notificationsController = require('./notifications.controller');
const { requireStaffApi, requirePermission } = require('../../middleware/auth');
const validateRequest = require('../../middleware/validateRequest');
const { query } = require('express-validator');

const router = express.Router();

const listQuery = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'sent', 'failed', 'cancelled']),
];

router.get(
  '/',
  requireStaffApi,
  requirePermission('can_manage_notifications'),
  listQuery,
  validateRequest,
  notificationsController.list
);

router.post(
  '/run-scheduler',
  requireStaffApi,
  requirePermission('can_manage_notifications'),
  notificationsController.runScheduler
);

module.exports = router;
