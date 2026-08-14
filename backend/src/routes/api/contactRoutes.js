const express = require('express');
const contactController = require('../../controllers/api/contactController');
const validateRequest = require('../../middleware/validateRequest');
const { contactBodyValidationRules } = require('../../validators/contactBodyValidationRules');

const router = express.Router();

router.post('/', contactBodyValidationRules, validateRequest, contactController.createContact);

module.exports = router;
