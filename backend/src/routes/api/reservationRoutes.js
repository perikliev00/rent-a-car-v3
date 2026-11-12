/**
 * Customer reservation release and release-and-rehold endpoints.
 */
const express = require('express');
const reservationController = require('../../controllers/api/reservationController');
const { reholdBodyValidationRules } = require('../../validators/reholdBodyValidationRules');

const router = express.Router();

// Drop the session's active unpaid hold.
router.post('/release', reservationController.releaseActiveReservation);
// Atomically release current hold and create a new one (car/date change).
router.post('/release-and-rehold', reholdBodyValidationRules, reservationController.releaseAndReholdReservation);

module.exports = router;
