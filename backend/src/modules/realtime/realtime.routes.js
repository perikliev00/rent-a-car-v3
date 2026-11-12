/**
 * Staff realtime routes (SSE stream).
 */

const express = require('express');
// Require the './realtime.controller' module as realtimeController.
const realtimeController = require('./realtime.controller');
// Destructure object properties into local variables.
const { requireStaffApi } = require('../../middleware/auth');

// Create the router constant.
const router = express.Router();

// Call router.get to perform this step.
router.get('/stream', requireStaffApi, realtimeController.stream);

// Assign the CommonJS module exports.
module.exports = router;
