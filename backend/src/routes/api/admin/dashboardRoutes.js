/**
 * Admin dashboard summary endpoint (staff session required).
 */
const express = require('express');
// Require the '../../../controllers/api/admin/dashboardController' module as dashboardController.
const dashboardController = require('../../../controllers/api/admin/dashboardController');
// Destructure object properties into local variables.
const { requireStaffApi } = require('../../../middleware/auth');

// Create the router constant.
const router = express.Router();

// Aggregated KPI / widget payload for the admin home screen.
router.get('/dashboard', requireStaffApi, dashboardController.getDashboard);

// Assign the CommonJS module exports.
module.exports = router;
