const express = require('express');
const contactController = require('../../../controllers/api/admin/contactController');
const { requirePermission } = require('../../../middleware/auth');
const { adminContactIdParamValidation } = require('../../../validators/adminContactIdParamValidation');
const { adminContactStatusValidation } = require('../../../validators/adminContactStatusValidation');

const router = express.Router();
const canManage = requirePermission('can_manage_contacts');

router.get('/', canManage, contactController.listContacts);
router.patch(
  '/:id/status',
  canManage,
  adminContactIdParamValidation,
  adminContactStatusValidation,
  contactController.updateContactStatus
);
router.delete(
  '/:id',
  canManage,
  adminContactIdParamValidation,
  contactController.deleteContact
);

module.exports = router;
