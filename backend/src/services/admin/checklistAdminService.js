/**
 * Public facade for admin pickup/return checklists and cancellation reviews.
 */
const { submitPickupChecklist } = require('./checklist/checklistPickupService');
// Destructure object properties into local variables.
const { submitReturnChecklist } = require('./checklist/checklistReturnService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listCancellationRequests,
  // Contribute this line to the enclosing declaration or statement.
  reviewCancellationRequest,
// Continue the surrounding logic with this statement.
} = require('./checklist/checklistCancellationService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  downloadReservationPdf,
  // Contribute this line to the enclosing declaration or statement.
  getChecklists,
// Continue the surrounding logic with this statement.
} = require('./checklist/checklistReadService');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  submitPickupChecklist,
  // Contribute this line to the enclosing declaration or statement.
  submitReturnChecklist,
  // Contribute this line to the enclosing declaration or statement.
  listCancellationRequests,
  // Contribute this line to the enclosing declaration or statement.
  reviewCancellationRequest,
  // Contribute this line to the enclosing declaration or statement.
  downloadReservationPdf,
  // Contribute this line to the enclosing declaration or statement.
  getChecklists,
};
