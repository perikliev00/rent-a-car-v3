/**
 * Customer reservation release and release-and-rehold endpoints.
 */
const express = require('express');
// Require the '../../controllers/api/reservationController' module as reservationController.
const reservationController = require('../../controllers/api/reservationController');
// Destructure object properties into local variables.
const { reholdBodyValidationRules } = require('../../validators/reholdBodyValidationRules');

// Create the router constant.
const router = express.Router();

// Drop the session's active unpaid hold.
router.post('/release', reservationController.releaseActiveReservation);
// Atomically release current hold and create a new one (car/date change).
router.post('/release-and-rehold', reholdBodyValidationRules, reservationController.releaseAndReholdReservation);

// Assign the CommonJS module exports.
module.exports = router;
