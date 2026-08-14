const express = require('express');
const reservationController = require('../../controllers/api/reservationController');
const { reholdBodyValidationRules } = require('../../validators/reholdBodyValidationRules');

const router = express.Router();

router.post('/release', reservationController.releaseActiveReservation);
router.post('/release-and-rehold', reholdBodyValidationRules, reservationController.releaseAndReholdReservation);

module.exports = router;
