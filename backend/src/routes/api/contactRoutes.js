/**
 * Public contact-form submission endpoint.
 */
const express = require('express');
// Require the '../../controllers/api/contactController' module as contactController.
const contactController = require('../../controllers/api/contactController');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { contactBodyValidationRules } = require('../../validators/contactBodyValidationRules');

// Create the router constant.
const router = express.Router();

// Persist an inbound contact message for staff follow-up.
router.post('/', contactBodyValidationRules, validateRequest, contactController.createContact);

// Assign the CommonJS module exports.
module.exports = router;
