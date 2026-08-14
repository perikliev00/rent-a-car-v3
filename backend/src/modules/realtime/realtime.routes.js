const express = require('express');
const realtimeController = require('./realtime.controller');
const { requireStaffApi } = require('../../middleware/auth');

const router = express.Router();

router.get('/stream', requireStaffApi, realtimeController.stream);

module.exports = router;
