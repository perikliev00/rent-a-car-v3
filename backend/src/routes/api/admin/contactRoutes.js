/**
 * Admin contact-message list, status update, and delete routes.
 */
const express = require('express');
const contactController = require('../../../controllers/api/admin/contactController');
const { requirePermission } = require('../../../middleware/auth');
const { adminContactIdParamValidation } = require('../../../validators/adminContactIdParamValidation');
const { adminContactStatusValidation } = require('../../../validators/adminContactStatusValidation');

const router = express.Router();
const canManage = requirePermission('can_manage_contacts');

// Inbox of public contact-form submissions.
router.get('/', canManage, contactController.listContacts);
// Mark a contact as new / in progress / closed.
router.patch(
  '/:id/status',
  canManage,
  adminContactIdParamValidation,
  adminContactStatusValidation,
  contactController.updateContactStatus
);
// Permanently remove a contact message.
router.delete(
  '/:id',
  canManage,
  adminContactIdParamValidation,
  contactController.deleteContact
);

module.exports = router;
