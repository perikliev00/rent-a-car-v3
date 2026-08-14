const express = require('express');
const dashboardController = require('../../../controllers/api/admin/dashboardController');
const { requireStaffApi } = require('../../../middleware/auth');

const router = express.Router();

router.get('/dashboard', requireStaffApi, dashboardController.getDashboard);

module.exports = router;
