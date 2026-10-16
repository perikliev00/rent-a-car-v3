/**
 * Admin dashboard summary endpoint (staff session required).
 */
const express = require('express');
const dashboardController = require('../../../controllers/api/admin/dashboardController');
const { requireStaffApi } = require('../../../middleware/auth');

const router = express.Router();

// Aggregated KPI / widget payload for the admin home screen.
router.get('/dashboard', requireStaffApi, dashboardController.getDashboard);

module.exports = router;
