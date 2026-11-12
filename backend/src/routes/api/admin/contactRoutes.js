/**
 * Admin contact-message list, status update, and delete routes.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/contactController' module as contactController.
const contactController = require('../../../controllers/api/admin/contactController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');
// Destructure object properties into local variables.
const { adminContactIdParamValidation } = require('../../../validators/adminContactIdParamValidation');
// Destructure object properties into local variables.
const { adminContactStatusValidation } = require('../../../validators/adminContactStatusValidation');

// Create the router constant.
const router = express.Router();
// Create the can manage constant.
const canManage = requirePermission('can_manage_contacts');

// Inbox of public contact-form submissions.
router.get('/', canManage, contactController.listContacts);
// Mark a contact as new / in progress / closed.
router.patch(
  // Supply the literal value used by the enclosing expression.
  '/:id/status',
  // Contribute this line to the enclosing declaration or statement.
  canManage,
  // Contribute this line to the enclosing declaration or statement.
  adminContactIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  adminContactStatusValidation,
  // Contribute this line to the enclosing declaration or statement.
  contactController.updateContactStatus
);
// Permanently remove a contact message.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/:id',
  // Contribute this line to the enclosing declaration or statement.
  canManage,
  // Contribute this line to the enclosing declaration or statement.
  adminContactIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  contactController.deleteContact
);

// Assign the CommonJS module exports.
module.exports = router;
