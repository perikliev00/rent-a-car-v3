const { submitPickupChecklist } = require('./checklist/checklistPickupService');
const { submitReturnChecklist } = require('./checklist/checklistReturnService');
const {
  listCancellationRequests,
  reviewCancellationRequest,
} = require('./checklist/checklistCancellationService');
const {
  downloadReservationPdf,
  getChecklists,
} = require('./checklist/checklistReadService');

module.exports = {
  submitPickupChecklist,
  submitReturnChecklist,
  listCancellationRequests,
  reviewCancellationRequest,
  downloadReservationPdf,
  getChecklists,
};
